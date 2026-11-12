import { zodResolver } from '@hookform/resolvers/zod';
import { FormHelperText, MenuItem, TextField } from '@mui/material';
import { parseApiError } from '@nivela/api-contract';
import type { ApiPlan, ApiSubject } from '@nivela/api-contract';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { FormDialog } from 'src/components/FormDialog';
import { createPlanAction, updatePlanAction } from 'src/features/leveling-plans/api/plans.action';
import { planSchema } from 'src/features/leveling-plans/schemas/plan.schema';
import type { PlanFormValues } from 'src/features/leveling-plans/schemas/plan.schema';

const DEFAULT_BONUS = 50;

interface PlanFormDialogProps {
  /** Plano em edição; sem ele, cria um novo. */
  plan?: ApiPlan;
  subjects: ApiSubject[];
  onClose: () => void;
  onSaved: (saved: ApiPlan, created: boolean) => void;
}

const FIELDS = ['title', 'description', 'subject_id', 'completion_bonus'] as const;

/** Dados do plano (título, descrição, disciplina e bônus de conclusão). */
export function PlanFormDialog({ plan, subjects, onClose, onSaved }: PlanFormDialogProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PlanFormValues>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      title: plan?.title ?? '',
      description: plan?.description ?? '',
      subject_id: plan ? String(plan.subject.id) : '',
      completion_bonus: String(plan?.completion_bonus ?? DEFAULT_BONUS),
    },
  });

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    const payload = {
      title: values.title,
      description: values.description || null,
      subject_id: Number(values.subject_id),
      completion_bonus: Number(values.completion_bonus),
    };
    try {
      if (plan) onSaved(await updatePlanAction(plan.id, payload), false);
      else onSaved(await createPlanAction(payload), true);
    } catch (error) {
      const info = parseApiError(error);
      let matched = false;
      for (const [field, messages] of Object.entries(info.fieldErrors)) {
        const known = FIELDS.find((name) => name === field);
        if (known) {
          setError(known, { message: messages.join(' ') });
          matched = true;
        }
      }
      if (!matched) setFormError(info.message);
    }
  });

  const { ref: titleRef, ...titleField } = register('title');
  const { ref: descriptionRef, ...descriptionField } = register('description');
  const { ref: subjectRef, ...subjectField } = register('subject_id');
  const { ref: bonusRef, ...bonusField } = register('completion_bonus');

  return (
    <FormDialog
      open
      title={plan ? 'Editar plano' : 'Novo plano'}
      submitLabel={plan ? 'Salvar' : 'Criar plano'}
      loading={isSubmitting}
      onSubmit={() => void submit()}
      onClose={onClose}
    >
      <TextField
        label="Título"
        autoFocus
        autoComplete="off"
        inputRef={titleRef}
        {...titleField}
        error={Boolean(errors.title)}
        helperText={errors.title?.message}
      />
      <TextField
        label="Descrição"
        multiline
        minRows={2}
        autoComplete="off"
        inputRef={descriptionRef}
        {...descriptionField}
        error={Boolean(errors.description)}
        helperText={errors.description?.message ?? 'Opcional. Aparece para o aluno junto com o plano.'}
      />
      <TextField
        select
        label="Disciplina"
        inputRef={subjectRef}
        {...subjectField}
        // o `defaultValue` do register é do react-hook-form: o select precisa receber o valor para exibi-lo
        defaultValue={plan ? String(plan.subject.id) : ''}
        error={Boolean(errors.subject_id)}
        helperText={errors.subject_id?.message}
      >
        {subjects.map((subject) => (
          <MenuItem key={subject.id} value={String(subject.id)}>
            {subject.name}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        label="Bônus de conclusão (moedas)"
        autoComplete="off"
        inputRef={bonusRef}
        {...bonusField}
        slotProps={{ htmlInput: { inputMode: 'numeric' } }}
        error={Boolean(errors.completion_bonus)}
        helperText={errors.completion_bonus?.message ?? 'Moedas que o aluno ganha ao concluir o plano, de 0 a 500.'}
      />

      {formError ? (
        <FormHelperText error role="alert">
          {formError}
        </FormHelperText>
      ) : null}
    </FormDialog>
  );
}
