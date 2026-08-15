import { ConflictException } from '@nestjs/common';

export class VersionConflictException extends ConflictException {
  constructor(expectedVersion: number) {
    super({
      code: 'VERSION_CONFLICT',
      message: 'The resource was changed by another request; refresh and try again',
      details: { expectedVersion },
    });
  }
}
