import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, FormHelperText, TextField } from '@mui/material';
import { parseApiError } from '@nivela/api-contract';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { FormDialog } from 'src/components/FormDialog';
import { PasswordField } from 'src/components/PasswordField';
import { addClassroomStudentAction } from 'src/features/classrooms/api/classrooms.action';
import { addStudentSchema } from 'src/features/classrooms/schemas/classroom.schema';
import type { AddStudentValues } from 'src/features/classrooms/schemas/classroom.schema';

interface AddStudentDialogProps {
  classroomId: number;
  onClose: () => void;
  onSaved: () => void;
}

/** Matrícula manual: cria a conta do aluno e já o coloca na turma. */
export function AddStudentDialog({ classroomId, onClose, onSaved }: AddStudentDialogProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AddStudentValues>({
    resolver: zodResolver(addStudentSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await addClassroomStudentAction(classroomId, values);
      onSaved();
    } catch (error) {
      const info = parseApiError(error);
      let matched = false;
      for (const [field, messages] of Object.entries(info.fieldErrors)) {
        if (field === 'name' || field === 'email' || field === 'password') {
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
      title="Adicionar aluno"
      submitLabel="Adicionar aluno"
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
      <PasswordField
        label="Senha inicial"
        autoComplete="new-password"
        inputRef={passwordRef}
        {...passwordField}
        error={Boolean(errors.password)}
        helperText={errors.password?.message}
      />
      <Alert severity="info">O aluno entra no app Nivela com este e-mail e esta senha.</Alert>

      {formError ? (
        <FormHelperText error role="alert">
          {formError}
        </FormHelperText>
      ) : null}
    </FormDialog>
  );
}
