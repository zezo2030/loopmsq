import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { isValidSaudiPhone } from '../../utils/phone.util';

@ValidatorConstraint({ name: 'isSaudiPhone', async: false })
export class IsSaudiPhoneConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value === null || value === undefined || value === '') return true;
    if (typeof value !== 'string') return false;
    return isValidSaudiPhone(value);
  }

  defaultMessage(): string {
    return 'Invalid Saudi phone number. Enter 9 digits starting with 5';
  }
}

export function IsSaudiPhone(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: IsSaudiPhoneConstraint,
    });
  };
}
