import { zodResolver } from '@hookform/resolvers/zod';
import { FormHelperText, TextField } from '@mui/material';
import { parseApiError } from '@nivela/api-contract';
import type { ApiReward } from '@nivela/api-contract';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { FormDialog } from 'src/components/FormDialog';
import { ImageUpload } from 'src/components/ImageUpload';
import {
  createRewardAction,
  deleteRewardImageAction,
  updateRewardAction,
  uploadRewardImageAction,
} from 'src/features/rewards/api/rewards.action';
import { rewardSchema, toRewardPayload } from 'src/features/rewards/schemas/reward.schema';
import type { RewardFormValues } from 'src/features/rewards/schemas/reward.schema';

interface RewardFormDialogProps {
  /** Prêmio em edição; sem ele, cria um novo. */
  reward?: ApiReward;
  onClose: () => void;
  /** Chamado a cada gravação (dados ou imagem): a lista deve ser recarregada. */
  onSaved: (saved: ApiReward, created: boolean) => void;
}

const FIELDS = ['name', 'description', 'price', 'stock'] as const;

const IMAGE_TEXTS = {
  savePrompt: 'Salve o prêmio para adicionar uma imagem.',
  altText: 'Imagem do prêmio',
  removedNotice: 'O prêmio ficará sem imagem. Você pode enviar outra depois.',
};

/** Dados do prêmio (nome, descrição, preço e estoque); a imagem entra depois de salvar. */
export function RewardFormDialog({ reward, onClose, onSaved }: RewardFormDialogProps) {
  // depois de criar, o diálogo continua aberto como edição, para enviar a imagem
  const [current, setCurrent] = useState<ApiReward | undefined>(reward);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RewardFormValues>({
    resolver: zodResolver(rewardSchema),
    defaultValues: {
      name: reward?.name ?? '',
      description: reward?.description ?? '',
      price: reward ? String(reward.price) : '',
      stock: reward ? String(reward.stock) : '',
    },
  });

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    const payload = toRewardPayload(values);
    try {
      if (current) {
        const saved = await updateRewardAction(current.id, payload);
        setCurrent(saved);
        onSaved(saved, false);
      } else {
        const saved = await createRewardAction(payload);
        setCurrent(saved);
        onSaved(saved, true);
      }
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

  function imageChanged(imageUrl: string | null) {
    if (!current) return;
    const next = { ...current, image_url: imageUrl };
    setCurrent(next);
    onSaved(next, false);
  }

  const { ref: nameRef, ...nameField } = register('name');
  const { ref: descriptionRef, ...descriptionField } = register('description');
  const { ref: priceRef, ...priceField } = register('price');
  const { ref: stockRef, ...stockField } = register('stock');

  return (
    <FormDialog
      open
      title={current ? 'Editar prêmio' : 'Novo prêmio'}
      submitLabel={current ? 'Salvar' : 'Criar prêmio'}
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
        label="Descrição (opcional)"
        multiline
        minRows={2}
        autoComplete="off"
        inputRef={descriptionRef}
        {...descriptionField}
        error={Boolean(errors.description)}
        helperText={errors.description?.message ?? 'O aluno vê o texto na loja.'}
      />
      <TextField
        label="Preço (moedas)"
        autoComplete="off"
        inputRef={priceRef}
        {...priceField}
        slotProps={{ htmlInput: { inputMode: 'numeric' } }}
        error={Boolean(errors.price)}
        helperText={errors.price?.message ?? 'De 1 a 100000 moedas.'}
      />
      <TextField
        label="Estoque"
        autoComplete="off"
        inputRef={stockRef}
        {...stockField}
        slotProps={{ htmlInput: { inputMode: 'numeric' } }}
        error={Boolean(errors.stock)}
        helperText={errors.stock?.message ?? 'Unidades disponíveis para resgate.'}
      />

      <ImageUpload
        ownerId={current?.id}
        upload={(file) => uploadRewardImageAction(current?.id ?? 0, file)}
        remove={() => deleteRewardImageAction(current?.id ?? 0)}
        texts={IMAGE_TEXTS}
        imageUrl={current?.image_url ?? null}
        canEdit
        onChange={imageChanged}
      />

      {formError ? (
        <FormHelperText error role="alert">
          {formError}
        </FormHelperText>
      ) : null}
    </FormDialog>
  );
}
