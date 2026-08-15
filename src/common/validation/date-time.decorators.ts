import { applyDecorators } from '@nestjs/common';
import { IsDateString, IsISO8601, Matches, ValidationOptions } from 'class-validator';

export function IsLocalDate(validationOptions?: ValidationOptions): PropertyDecorator {
  return applyDecorators(
    Matches(/^\d{4}-\d{2}-\d{2}$/, validationOptions),
    IsDateString({ strict: true }, validationOptions),
  );
}

export function IsIsoInstant(validationOptions?: ValidationOptions): PropertyDecorator {
  return applyDecorators(
    Matches(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/,
      validationOptions,
    ),
    IsISO8601({ strict: true, strictSeparator: true }, validationOptions),
  );
}
