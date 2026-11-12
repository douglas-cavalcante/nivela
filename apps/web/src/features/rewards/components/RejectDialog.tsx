import { zodResolver } from '@hookform/resolvers/zod';
import { TextField, Typography } from '@mui/material';
import { parseApiError } from '@nivela/api-contract';
import type { ApiRedemption } from '@nivela/api-contract';
import { useForm } from 'react-hook-form';
import { FormDialog } from 'src/components/FormDialog';
import { rejectRedemptionAction } from 'src/features/rewards/api/rewards.action';
import { rejectSchema } from 'src/features/rewards/schemas/reward.schema';
import type { RejectFormValues } from 'src/features/rewards/schemas/reward.schema';

interface RejectDialogProps {
  redemption: ApiRedemption;
  onClose: () => void;
  onRejected: (redemption: ApiRedemption) => void;
  /** Erro que não é do campo (ex.: 409, resgate já finalizado). */
  onFailed: (message: string) => void;
}

/** Recusa um resgate com o motivo obrigatório; o aluno recebe as moedas de volta. */
export function RejectDialog({ redemption, onClose, onRejected, onFailed }: RejectDialogProps) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RejectFormValues>({
    resolver: zodResolver(rejectSchema),
    defaultValues: { reason: '' },
  });

  const submit = handleSubmit(async (values) => {
    try {
      onRejected(await rejectRedemptionAction(redemption.id, { reason: values.reason }));
    } catch (error) {
      const info = parseApiError(error);
      const messages = info.fieldErrors.reason;
      if (messages) setError('reason', { message: messages.join(' ') });
      else onFailed(info.message);
    }
  });

  const { ref, ...reasonField } = register('reason');

  return (
    <FormDialog
      open
      title="Recusar o resgate?"
      submitLabel="Recusar"
      loading={isSubmitting}
      onSubmit={() => void submit()}
      onClose={onClose}
    >
      <Typography>
        {redemption.student.name} pediu {redemption.reward.name}.
      </Typography>
      <Typography color="text.secondary">O aluno recebe as moedas de volta.</Typography>
      <TextField
        label="Motivo"
        autoFocus
        multiline
        minRows={2}
        autoComplete="off"
        inputRef={ref}
        {...reasonField}
        error={Boolean(errors.reason)}
        helperText={errors.reason?.message ?? 'O aluno vê o motivo na lista de resgates.'}
      />
    </FormDialog>
  );
}
