import { Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { useId } from 'react';
import type { FormEvent, ReactNode } from 'react';

interface FormDialogProps {
  open: boolean;
  title: string;
  submitLabel: string;
  loading?: boolean;
  onSubmit: () => void;
  onClose: () => void;
  children: ReactNode;
}

/** Diálogo com formulário: Enter envia; Esc e clique fora só fecham quando não está enviando. */
export function FormDialog({ open, title, submitLabel, loading = false, onSubmit, onClose, children }: FormDialogProps) {
  const titleId = useId();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // o diálogo é renderizado num portal, mas o React propaga o evento pela árvore: não deixa vazar para um <form> pai
    event.stopPropagation();
    if (!loading) onSubmit();
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!loading) onClose();
      }}
      aria-labelledby={titleId}
      fullWidth
      maxWidth="sm"
    >
      <Box component="form" noValidate onSubmit={handleSubmit} aria-busy={loading || undefined}>
        <DialogTitle id={titleId} component="h2" variant="h4">
          {title}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
          {children}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={onClose} disabled={loading} color="inherit">
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} color="inherit" aria-hidden /> : undefined}
          >
            {submitLabel}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
