import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, FormHelperText, TextField } from '@mui/material';
import { parseApiError } from '@nivela/api-contract';
import type { ApiTeacher } from '@nivela/api-contract';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { FormDialog } from 'src/components/FormDialog';
import { PasswordField } from 'src/components/PasswordField';
import { createTeacherAction, updateTeacherAction } from 'src/features/teachers/api/teachers.action';
import { createTeacherSchema, updateTeacherSchema } from 'src/features/teachers/schemas/teacher.schema';
import type { TeacherFormValues } from 'src/features/teachers/schemas/teacher.schema';

interface TeacherFormDialogProps {
  /** Professor em edição; sem ele, cria um novo. */
  teacher?: ApiTeacher;
  onClose: () => void;
  onSaved: (message: string) => void;
}

export function TeacherFormDialog({ teacher, onClose, onSaved }: TeacherFormDialogProps) {
  const editing = Boolean(teacher);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<TeacherFormValues>({
    // na edição a senha não existe no formulário (tem diálogo próprio)
    resolver: zodResolver(editing ? updateTeacherSchema : createTeacherSchema),
    defaultValues: { name: teacher?.name ?? '', email: teacher?.email ?? '', password: '' },
  });

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      if (teacher) await updateTeacherAction(teacher.id, { name: values.name, email: values.email });
      else await createTeacherAction({ name: values.name, email: values.email, password: values.password ?? '' });
      onSaved(teacher ? 'Professor atualizado.' : 'Professor cadastrado.');
    } catch (error) {
      const info = parseApiError(error);
      let matched = false;
      for (const [field, messages] of Object.entries(info.fieldErrors)) {
        if (field === 'name' || field === 'email' || (field === 'password' && !editing)) {
          setError(field, { message: messages.join(' ') });
          matched = true;
        }
      }
      if (!matched) setFormError(info.message);
    }
  });

  const { ref: nameRef, ...nameField } = register('name');
  const { ref: emailRef, ...emailField } = register('email');
  const { ref: passwordRef, ...passwordField } = register('password');

  return (
    <FormDialog
      open
      title={teacher ? 'Editar professor' : 'Novo professor'}
      submitLabel={teacher ? 'Salvar' : 'Cadastrar professor'}
      loading={isSubmitting}
      onSubmit={() => void submit()}
      onClose={onClose}
    >
      <TextField
        label="Nome"
        autoFocus
        autoComplete="off"
        inputRef={nameRef}
        {...nameField}
        error={Boolean(errors.name)}
        helperText={errors.name?.message}
      />
      <TextField
        label="E-mail"
        type="email"
        autoComplete="off"
        inputRef={emailRef}
        {...emailField}
        error={Boolean(errors.email)}
        helperText={errors.email?.message}
      />

      {teacher ? null : (
        <>
          <PasswordField
            label="Senha inicial"
            autoComplete="new-password"
            inputRef={passwordRef}
            {...passwordField}
            error={Boolean(errors.password)}
            helperText={errors.password?.message}
          />
          <Alert severity="info">Combine com o professor para trocar a senha no primeiro acesso.</Alert>
        </>
      )}

      {formError ? (
        <FormHelperText error role="alert">
          {formError}
        </FormHelperText>
      ) : null}
    </FormDialog>
  );
}
