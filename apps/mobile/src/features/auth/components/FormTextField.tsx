import { Controller } from 'react-hook-form';
import type { Control, FieldValues, Path } from 'react-hook-form';
import { TextField } from 'src/components/TextField';
import type { TextFieldProps } from 'src/components/TextField';

type FormTextFieldProps<T extends FieldValues> = Omit<TextFieldProps, 'value' | 'onChangeText' | 'onBlur' | 'error'> & {
  control: Control<T>;
  name: Path<T>;
  /** Transforma o texto digitado antes de guardar (ex.: código da turma em maiúsculas). */
  format?: (text: string) => string;
};

/** `TextField` ligado ao react-hook-form: valor, blur e mensagem de erro do campo. */
export function FormTextField<T extends FieldValues>({ control, name, format, ...props }: FormTextFieldProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextField
          {...props}
          value={typeof field.value === 'string' ? field.value : ''}
          onChangeText={(text) => field.onChange(format ? format(text) : text)}
          onBlur={field.onBlur}
          error={fieldState.error?.message}
        />
      )}
    />
  );
}
