import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Validates that a date value (ISO string or Date) is not in the future.
 * Reused for birthDate, measuredAt, appliedAt, movedAt, etc.
 */
@ValidatorConstraint({ name: 'isNotFutureDate', async: false })
export class IsNotFutureDateConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value === undefined || value === null) {
      return false;
    }
    const date = value instanceof Date ? value : new Date(value as string);
    if (Number.isNaN(date.getTime())) {
      return false;
    }
    return date.getTime() <= Date.now();
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be a valid date and cannot be in the future`;
  }
}

export function IsNotFutureDate(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsNotFutureDateConstraint,
    });
  };
}
