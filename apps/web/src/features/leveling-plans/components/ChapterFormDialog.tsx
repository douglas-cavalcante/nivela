import { zodResolver } from '@hookform/resolvers/zod';
import { FormHelperText, TextField } from '@mui/material';
import { parseApiError } from '@nivela/api-contract';
import type { ApiPlan, ApiPlanChapter } from '@nivela/api-contract';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { FormDialog } from 'src/components/FormDialog';
import { addChapterAction, renameChapterAction } from 'src/features/leveling-plans/api/plans.action';
import { chapterSchema } from 'src/features/leveling-plans/schemas/plan.schema';
import type { ChapterFormValues } from 'src/features/leveling-plans/schemas/plan.schema';

interface ChapterFormDialogProps {
  planId: number;
  /** Capítulo em edição; sem ele, cria um novo no fim do plano. */
  chapter?: ApiPlanChapter;
  onClose: () => void;
  /** Recebe o plano atualizado que a API devolve. */
  onSaved: (plan: ApiPlan) => void;
}

/** Título de um capítulo: novo ou renomeado. */
export function ChapterFormDialog({ planId, chapter, onClose, onSaved }: ChapterFormDialogProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ChapterFormValues>({
    resolver: zodResolver(chapterSchema),
    defaultValues: { title: chapter?.title ?? '' },
  });

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      onSaved(
        chapter
          ? await renameChapterAction(planId, chapter.id, values.title)
          : await addChapterAction(planId, values.title),
      );
    } catch (error) {
      const info = parseApiError(error);
      const titleErrors = info.fieldErrors.title;
      if (titleErrors) setError('title', { message: titleErrors.join(' ') });
      else setFormError(info.message);
    }
  });

  const { ref, ...titleField } = register('title');

  return (
    <FormDialog
      open
      title={chapter ? 'Renomear capítulo' : 'Novo capítulo'}
      submitLabel={chapter ? 'Salvar' : 'Adicionar capítulo'}
      loading={isSubmitting}
      onSubmit={() => void submit()}
      onClose={onClose}
    >
      <TextField
        label="Título"
        autoFocus
        autoComplete="off"
        inputRef={ref}
        {...titleField}
        error={Boolean(errors.title)}
        helperText={errors.title?.message}
      />

      {formError ? (
        <FormHelperText error role="alert">
          {formError}
        </FormHelperText>
      ) : null}
    </FormDialog>
  );
}
