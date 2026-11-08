import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

/** Valida que o campo é igual a outro campo do mesmo DTO (ex.: confirmação de senha). */
export function MatchesField(
  other: string,
  validationOptions?: ValidationOptions,
) {
  return (target: object, propertyName: string) => {
    registerDecorator({
      name: 'matchesField',
      target: target.constructor,
      propertyName,
      constraints: [other],
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const [otherName] = args.constraints as [string];
          return value === (args.object as Record<string, unknown>)[otherName];
        },
      },
    });
  };
}
