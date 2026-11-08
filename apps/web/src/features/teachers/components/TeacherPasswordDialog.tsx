import { zodResolver } from '@hookform/resolvers/zod';
import { FormHelperText } from '@mui/material';
import { parseApiError } from '@nivela/api-contract';
import type { ApiTeacher } from '@nivela/api-contract';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { FormDialog } from 'src/components/FormDialog';
import { PasswordField } from 'src/components/PasswordField';
import { resetTeacherPasswordAction } from 'src/features/teachers/api/teachers.action';
import { teacherPasswordSchema } from 'src/features/teachers/schemas/teacher.schema';
import type { TeacherPasswordValues } from 'src/features/teachers/schemas/teacher.schema';

interface TeacherPasswordDialogProps {
  teacher: ApiTeacher;
  onClose: () => void;
  onSaved: (message: string) => void;
}

export function TeacherPasswordDialog({ teacher, onClose, onSaved }: TeacherPasswordDialogProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<TeacherPasswordValues>({
    resolver: zodResolver(teacherPasswordSchema),
    defaultValues: { password: '', password_confirmation: '' },
  });

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await resetTeacherPasswordAction(teacher.id, values);
      onSaved('Senha redefinida.');
    } catch (error) {
      const info = parseApiError(error);
      let matched = false;
      for (const [field, messages] of Object.entries(info.fieldErrors)) {
        if (field === 'password' || field === 'password_confirmation') {
          setError(field, { message: messages.join(' ') });
          matched = true;
        }
      }
      if (!matched) setFormError(info.message);
    }
  });

  const { ref: passwordRef, ...passwordField } = register('password');
  const { ref: confirmRef, ...confirmField } = register('password_confirmation');

  return (
    <FormDialog
      open
      title={`Redefinir senha de ${teacher.name}`}
      submitLabel="Redefinir senha"
      loading={isSubmitting}
      onSubmit={() => void submit()}
      onClose={onClose}
    >
      <PasswordField
        label="Nova senha"
        autoFocus
        autoComplete="new-password"
        inputRef={passwordRef}
        {...passwordField}
        error={Boolean(errors.password)}
        helperText={errors.password?.message}
      />
      <PasswordField
        label="Confirmar nova senha"
        autoComplete="new-password"
        inputRef={confirmRef}
        {...confirmField}
        error={Boolean(errors.password_confirmation)}
        helperText={errors.password_confirmation?.message}
      />
      {formError ? (
        <FormHelperText error role="alert">
          {formError}
        </FormHelperText>
      ) : null}
    </FormDialog>
  );
}
