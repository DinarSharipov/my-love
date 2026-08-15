import { BadRequestException, createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export const ConcurrencyVersion = createParamDecorator(
  (_data: unknown, context: ExecutionContext): number | undefined => {
    const value = context.switchToHttp().getRequest<Request>().headers['if-match'];
    if (value === undefined) return undefined;
    if (typeof value !== 'string') {
      throw new BadRequestException('If-Match must contain one positive integer version');
    }

    const normalized = value.replace(/^W\//, '').replace(/^"|"$/g, '');
    if (!/^[1-9]\d*$/.test(normalized)) {
      throw new BadRequestException('If-Match must contain one positive integer version');
    }

    const version = Number(normalized);
    if (!Number.isSafeInteger(version)) {
      throw new BadRequestException('If-Match version is too large');
    }
    return version;
  },
);
