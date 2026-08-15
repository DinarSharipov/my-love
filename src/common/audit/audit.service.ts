import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';

export type AuditEventInput = {
  actorId?: string;
  familyId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Prisma.InputJsonValue;
  requestId?: string;
};

type AuditClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class AuditService {
  record(input: AuditEventInput, client: AuditClient = this.prisma): Promise<void> {
    return client.auditEvent
      .create({
        data: { id: randomUUID(), ...input },
        select: { id: true },
      })
      .then(() => undefined);
  }
  constructor(private readonly prisma: PrismaService) {}
}
