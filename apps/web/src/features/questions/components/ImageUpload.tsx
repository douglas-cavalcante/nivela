import AddPhotoIcon from '@mui/icons-material/AddPhotoAlternateOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import SwapIcon from '@mui/icons-material/SwapHorizOutlined';
import { Box, Button, CircularProgress, FormHelperText, Typography } from '@mui/material';
import { parseApiError, resolveAssetUrl } from '@nivela/api-contract';
import { penShadow } from '@nivela/design-tokens';
import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { ConfirmDialog } from 'src/components/ConfirmDialog';
import {
  deleteQuestionImageAction,
  uploadQuestionImageAction,
} from 'src/features/questions/api/questions.action';
import { validateImageFile } from 'src/features/questions/schemas/question.schema';
import { useNivelaColors } from 'src/lib/theme/useNivelaColors';
import { useNotify } from 'src/lib/notify/useNotify';

interface ImageUploadProps {
  /** Sem id a questão ainda não existe: a imagem só pode ser enviada depois de salvar. */
  questionId?: number;
  /** `image_url` da API: caminho relativo à raiz (`/uploads/...`), resolvido na origem de VITE_API_URL. */
  imageUrl: string | null;
  /** Falso no modo leitura: mostra a imagem, sem botões. */
  canEdit: boolean;
  onChange: (imageUrl: string | null) => void;
}

/** Imagem opcional da questão: prévia, trocar e remover (com confirmação). */
export function ImageUpload({ questionId, imageUrl, canEdit, onChange }: ImageUploadProps) {
  const colors = useNivelaColors();
  const notify = useNotify();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [replacement, setReplacement] = useState<File | null>(null);
  const [removing, setRemoving] = useState(false);

  async function send(file: File) {
    if (questionId === undefined) return;
    setBusy(true);
    setError(null);
    try {
      const url = await uploadQuestionImageAction(questionId, file);
      notify.success(imageUrl ? 'Imagem trocada.' : 'Imagem enviada.');
      onChange(url);
    } catch (err) {
      const info = parseApiError(err);
      setError(info.fieldErrors.image?.join(' ') ?? info.message);
    } finally {
      setBusy(false);
      setReplacement(null);
    }
  }

  function handlePick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ''; // permite escolher o mesmo arquivo de novo
    if (!file) return;
    const problem = validateImageFile(file);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    if (imageUrl) setReplacement(file);
    else void send(file);
  }

  async function confirmRemove() {
    if (questionId === undefined) return;
    setBusy(true);
    try {
      await deleteQuestionImageAction(questionId);
      notify.success('Imagem removida.');
      setError(null);
      onChange(null);
    } catch (err) {
      notify.error(parseApiError(err).message);
    } finally {
      setBusy(false);
      setRemoving(false);
    }
  }

  return (
    <Box>
      <Typography variant="h6" component="h3" sx={{ mb: 0.5 }}>
        Imagem
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Opcional. JPG, PNG ou WEBP, até 2 MB.
      </Typography>

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 1.5,
          p: 2,
          border: `2px dashed ${colors.textMuted}`,
          borderRadius: 2,
        }}
      >
        {questionId === undefined ? (
          <Typography color="text.secondary">Salve a questão para adicionar uma imagem.</Typography>
        ) : imageUrl ? (
          <Box
            component="img"
            src={resolveAssetUrl(import.meta.env.VITE_API_URL, imageUrl) ?? undefined}
            alt="Imagem da questão"
            sx={{
              display: 'block',
              maxWidth: '100%',
              maxHeight: 280,
              borderRadius: 1,
              border: `${penShadow.width}px solid ${colors.border}`,
              backgroundColor: colors.surface,
            }}
          />
        ) : (
          <Typography color="text.secondary">Nenhuma imagem.</Typography>
        )}

        {questionId !== undefined && canEdit ? (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              variant={imageUrl ? 'outlined' : 'contained'}
              startIcon={
                busy ? <CircularProgress size={16} color="inherit" aria-hidden /> : imageUrl ? <SwapIcon /> : <AddPhotoIcon />
              }
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              {imageUrl ? 'Trocar imagem' : 'Adicionar imagem'}
            </Button>
            {imageUrl ? (
              <Button color="error" variant="outlined" startIcon={<DeleteIcon />} disabled={busy} onClick={() => setRemoving(true)}>
                Remover imagem
              </Button>
            ) : null}
            <input
              ref={inputRef}
              hidden
              type="file"
              aria-label="Arquivo da imagem"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              onChange={handlePick}
            />
          </Box>
        ) : null}

        {error ? (
          <FormHelperText error role="alert" sx={{ m: 0 }}>
            {error}
          </FormHelperText>
        ) : null}
      </Box>

      <ConfirmDialog
        open={replacement !== null}
        title="Trocar a imagem?"
        description="A imagem atual será substituída pela nova e não poderá ser recuperada."
        confirmLabel="Trocar"
        loading={busy}
        onConfirm={() => {
          if (replacement) void send(replacement);
        }}
        onClose={() => setReplacement(null)}
      />
      <ConfirmDialog
        open={removing}
        title="Remover a imagem?"
        description="A questão ficará sem imagem. Você pode enviar outra depois."
        confirmLabel="Remover"
        tone="danger"
        loading={busy}
        onConfirm={() => void confirmRemove()}
        onClose={() => setRemoving(false)}
      />
    </Box>
  );
}
