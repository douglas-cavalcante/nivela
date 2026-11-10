import { zodResolver } from '@hookform/resolvers/zod';
import { FormControlLabel, FormHelperText, Switch, TextField } from '@mui/material';
import { parseApiError } from '@nivela/api-contract';
import type { ApiClassroom, ApiClassroomSummary, ApiTeacher } from '@nivela/api-contract';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { Control, FieldErrors } from 'react-hook-form';
import { AsyncAutocomplete } from 'src/components/AsyncAutocomplete';
import { FormDialog } from 'src/components/FormDialog';
import { createClassroomAction, updateClassroomAction } from 'src/features/classrooms/api/classrooms.action';
import { adminClassroomSchema, classroomSchema } from 'src/features/classrooms/schemas/classroom.schema';
import type { ClassroomFormValues, ClassroomPayload } from 'src/features/classrooms/schemas/classroom.schema';
import { listTeachersAction } from 'src/features/teachers';

interface ClassroomFormDialogProps {
  /** Turma em edição; sem ela, cria uma nova. */
  classroom?: ApiClassroomSummary;
  /** Administrador escolhe o professor ao criar; o professor cria sempre para si. */
  isAdmin: boolean;
  onClose: () => void;
  onSaved: (saved: ApiClassroom, created: boolean) => void;
}

interface TeacherSelectProps {
  control: Control<ClassroomFormValues>;
  errors: FieldErrors<ClassroomFormValues>;
}

/** Professores ativos para o administrador escolher o dono da turma (busca no servidor). */
function TeacherSelect({ control, errors }: TeacherSelectProps) {
  const [selected, setSelected] = useState<ApiTeacher | null>(null);

  return (
    <Controller
      control={control}
      name="teacher_id"
      render={({ field }) => (
        <AsyncAutocomplete<ApiTeacher>
          label="Professor"
          value={selected}
          onChange={(teacher) => {
            setSelected(teacher);
            field.onChange(teacher ? String(teacher.id) : '');
          }}
          onBlur={field.onBlur}
          inputRef={field.ref}
          load={async (search, signal) =>
            (await listTeachersAction({ status: 'active', search: search || undefined, per_page: 20 }, signal)).data
          }
          getOptionLabel={(teacher) => teacher.name}
          getOptionKey={(teacher) => teacher.id}
          error={errors.teacher_id?.message}
        />
      )}
    />
  );
}

export function ClassroomFormDialog({ classroom, isAdmin, onClose, onSaved }: ClassroomFormDialogProps) {
  const editing = Boolean(classroom);
  const askTeacher = isAdmin && !editing;
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ClassroomFormValues>({
    resolver: zodResolver(askTeacher ? adminClassroomSchema : classroomSchema),
    defaultValues: {
      name: classroom?.name ?? '',
      school_year: classroom?.school_year ?? '',
      teacher_id: '',
      active: classroom?.active ?? true,
    },
  });

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    const payload: ClassroomPayload = { name: values.name, school_year: values.school_year.trim() || null };
    try {
      if (classroom) {
        const saved = await updateClassroomAction(classroom.id, { ...payload, active: values.active });
        onSaved(saved, false);
      } else {
        if (askTeacher) payload.teacher_id = Number(values.teacher_id);
        onSaved(await createClassroomAction(payload), true);
      }
    } catch (error) {
      const info = parseApiError(error);
      let matched = false;
      for (const [field, messages] of Object.entries(info.fieldErrors)) {
        if (field === 'name' || field === 'school_year' || (field === 'teacher_id' && askTeacher)) {
          setError(field, { message: messages.join(' ') });
          matched = true;
        }
      }
      if (!matched) setFormError(info.message);
    }
  });

  const { ref: nameRef, ...nameField } = register('name');
  const { ref: yearRef, ...yearField } = register('school_year');

  return (
    <FormDialog
      open
      title={classroom ? 'Editar turma' : 'Nova turma'}
      submitLabel={classroom ? 'Salvar' : 'Criar turma'}
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
        label="Ano letivo"
        autoComplete="off"
        inputRef={yearRef}
        {...yearField}
        error={Boolean(errors.school_year)}
        helperText={errors.school_year?.message ?? 'Texto livre, como "9º ano" ou "2026". Opcional.'}
      />

      {askTeacher ? <TeacherSelect control={control} errors={errors} /> : null}

      {editing ? (
        <Controller
          control={control}
          name="active"
          render={({ field }) => (
            <FormControlLabel
              control={<Switch checked={field.value} onChange={(event) => field.onChange(event.target.checked)} />}
              label="Turma ativa"
            />
          )}
        />
      ) : null}

      {formError ? (
        <FormHelperText error role="alert">
          {formError}
        </FormHelperText>
      ) : null}
    </FormDialog>
  );
}
