import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';

export function isIanaTimeZone(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function IsIanaTimeZone(validationOptions?: ValidationOptions): PropertyDecorator {
  return (target: object, propertyName: string | symbol): void => {
    registerDecorator({
      name: 'isIanaTimeZone',
      target: target.constructor,
      propertyName: propertyName.toString(),
      options: validationOptions,
      validator: {
        validate: isIanaTimeZone,
        defaultMessage: (args: ValidationArguments) =>
          `${args.property} must be an IANA timezone such as Europe/Moscow`,
      },
    });
  };
}
