import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiHeader } from '@nestjs/swagger';

export const IDEMPOTENCY_SCOPE = 'idempotencyScope';

export function Idempotent(scope: string): MethodDecorator {
  return applyDecorators(
    SetMetadata(IDEMPOTENCY_SCOPE, scope),
    ApiHeader({
      name: 'Idempotency-Key',
      required: false,
      description:
        'Retry key for this command (8-128 safe ASCII characters). Reusing it with another payload returns 409.',
    }),
  );
}
