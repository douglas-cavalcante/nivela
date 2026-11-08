import { zodResolver } from '@hookform/resolvers/zod';
import { FormHelperText, MenuItem, TextField } from '@mui/material';
import { parseApiError } from '@nivela/api-contract';
import type { ApiCategory, ApiSubject } from '@nivela/api-contract';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { FormDialog } from 'src/components/FormDialog';
import { createCategoryAction, updateCategoryAction } from 'src/features/categories/api/categories.action';
import { createCategorySchema, updateCategorySchema } from 'src/features/categories/schemas/category.schema';
import type { CategoryFormValues } from 'src/features/categories/schemas/category.schema';

interface CategoryFormDialogProps {
  /** Categoria em edição; sem ela, cria uma nova. */
  category?: ApiCategory;
  subjects: ApiSubject[];
  /** Disciplina já escolhida no filtro da lista (pré-seleciona na criação). */
  defaultSubjectId?: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}

export function CategoryFormDialog({ category, subjects, defaultSubjectId = '', onClose, onSaved }: CategoryFormDialogProps) {
  const editing = Boolean(category);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormValues>({
    // na edição a disciplina não existe no formulário
    resolver: zodResolver(editing ? updateCategorySchema : createCategorySchema),
    defaultValues: { name: category?.name ?? '', subject_id: defaultSubjectId },
  });

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      if (category) await updateCategoryAction(category.id, { name: values.name });
      else await createCategoryAction({ name: values.name, subject_id: Number(values.subject_id) });
      onSaved(category ? 'Categoria atualizada.' : 'Categoria criada.');
    } catch (error) {
      const info = parseApiError(error);
      let matched = false;
      for (const [field, messages] of Object.entries(info.fieldErrors)) {
        if (field === 'name' || (field === 'subject_id' && !editing)) {
          setError(field, { message: messages.join(' ') });
          matched = true;
        }
      }
      if (!matched) setFormError(info.message);
    }
  });

  const { ref, ...nameField } = register('name');
  const { ref: subjectRef, ...subjectField } = register('subject_id');

  return (
    <FormDialog
      open
      title={category ? 'Editar categoria' : 'Nova categoria'}
      submitLabel={category ? 'Salvar' : 'Criar categoria'}
      loading={isSubmitting}
      onSubmit={() => void submit()}
      onClose={onClose}
    >
      <TextField
        label="Nome"
        autoFocus
        autoComplete="off"
        inputRef={ref}
        {...nameField}
        error={Boolean(errors.name)}
        helperText={errors.name?.message}
      />

      {category ? null : (
        <TextField
          select
          label="Disciplina"
          inputRef={subjectRef}
          {...subjectField}
          error={Boolean(errors.subject_id)}
          helperText={errors.subject_id?.message}
        >
          {subjects.map((subject) => (
            <MenuItem key={subject.id} value={String(subject.id)}>
              {subject.name}
            </MenuItem>
          ))}
        </TextField>
      )}

      {formError ? (
        <FormHelperText error role="alert">
          {formError}
        </FormHelperText>
      ) : null}
    </FormDialog>
  );
}
