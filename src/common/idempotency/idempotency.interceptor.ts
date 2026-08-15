import {
  BadRequestException,
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IdempotencyStatus, Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { createHash } from 'node:crypto';
import { lastValueFrom, Observable } from 'rxjs';
import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../../modules/auth/types/authenticated-user.type';
import { IDEMPOTENCY_SCOPE } from './idempotent.decorator';

type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler<unknown>,
  ): Promise<Observable<unknown>> {
    const scope = this.reflector.getAllAndOverride<string>(IDEMPOTENCY_SCOPE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!scope) return next.handle();

    const http = context.switchToHttp();
    const request = http.getRequest<AuthenticatedRequest>();
    const response = http.getResponse<Response>();
    const key = request.headers['idempotency-key'];
    if (key === undefined) return next.handle();
    if (typeof key !== 'string' || !/^[A-Za-z0-9._:-]{8,128}$/.test(key)) {
      throw new BadRequestException(
        'Idempotency-Key must contain 8-128 letters, digits, dots, underscores, colons or hyphens',
      );
    }
    if (!request.user) throw new BadRequestException('Idempotency requires an authenticated user');

    const requestHash = createHash('sha256')
      .update(canonicalJson({ body: request.body as unknown, params: request.params as unknown }))
      .digest('hex');
    const record = await this.reserve(request.user.id, scope, key, requestHash);

    if (!record.created) {
      if (record.requestHash !== requestHash) {
        throw new ConflictException({
          code: 'IDEMPOTENCY_KEY_REUSED',
          message: 'Idempotency-Key was already used with a different request',
        });
      }
      if (record.status === IdempotencyStatus.COMPLETED) {
        response.status(record.responseStatus ?? 200);
        return new Observable((subscriber) => {
          subscriber.next(record.responseBody);
          subscriber.complete();
        });
      }
      throw new ConflictException({
        code: 'IDEMPOTENCY_IN_PROGRESS',
        message: 'A request with this Idempotency-Key is still being processed',
      });
    }

    let result: unknown;
    try {
      result = await lastValueFrom(next.handle());
    } catch (error: unknown) {
      await this.prisma.idempotencyRecord.deleteMany({ where: { id: record.id } });
      throw error;
    }

    // The HTTP representation is the value that must be replayed, including ISO-serialized dates.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const responseBody: Prisma.InputJsonValue = JSON.parse(JSON.stringify(result ?? null));
    await this.prisma.idempotencyRecord.update({
      where: { id: record.id },
      data: {
        status: IdempotencyStatus.COMPLETED,
        responseStatus: response.statusCode,
        responseBody,
      },
    });
    return new Observable((subscriber) => {
      subscriber.next(result);
      subscriber.complete();
    });
  }

  private async reserve(userId: string, scope: string, key: string, requestHash: string) {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    try {
      const created = await this.prisma.idempotencyRecord.create({
        data: { userId, scope, key, requestHash, expiresAt },
      });
      return { ...created, created: true as const };
    } catch (error: unknown) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
        throw error;
      }
    }

    const existing = await this.prisma.idempotencyRecord.findUniqueOrThrow({
      where: { userId_scope_key: { userId, scope, key } },
    });
    if (existing.expiresAt <= new Date()) {
      const reclaimed = await this.prisma.idempotencyRecord.updateMany({
        where: { id: existing.id, expiresAt: { lte: new Date() } },
        data: {
          requestHash,
          status: IdempotencyStatus.PROCESSING,
          responseStatus: null,
          responseBody: Prisma.DbNull,
          expiresAt,
        },
      });
      if (reclaimed.count === 1) {
        return {
          ...existing,
          requestHash,
          status: IdempotencyStatus.PROCESSING,
          created: true as const,
        };
      }
    }
    return { ...existing, created: false as const };
  }
}
