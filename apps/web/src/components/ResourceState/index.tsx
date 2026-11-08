import { Box, Button } from '@mui/material';
import { Link } from 'react-router';
import { EmptyState } from 'src/components/EmptyState';

interface ResourceStateProps {
  /** `not-found`: o recurso não existe (id inválido ou 404); `error`: a busca falhou. */
  kind: 'not-found' | 'error';
  /**
   * `not-found`: vira o título ("Turma não encontrada.");
   * `error`: aparece abaixo de "Não deu para carregar." (a mensagem do erro).
   */
  message: string;
  /** Só para `error`: tentar a busca de novo. */
  onRetry?: () => void;
  /** Link de volta para a lista. */
  backTo?: { to: string; label: string };
}

/** Tela inteira de "não encontrado" ou "não deu para carregar" de uma página de recurso. */
export function ResourceState({ kind, message, onRetry, backTo }: ResourceStateProps) {
  const retry = kind === 'error' && onRetry;
  const actions =
    retry || backTo ? (
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
        {retry ? (
          <Button variant="contained" onClick={onRetry}>
            Tentar de novo
          </Button>
        ) : null}
        {backTo ? (
          <Button variant={retry ? 'outlined' : 'contained'} component={Link} to={backTo.to}>
            {backTo.label}
          </Button>
        ) : null}
      </Box>
    ) : undefined;

  return kind === 'not-found' ? (
    <EmptyState title={message} action={actions} />
  ) : (
    <EmptyState title="Não deu para carregar." description={message} action={actions} />
  );
}
