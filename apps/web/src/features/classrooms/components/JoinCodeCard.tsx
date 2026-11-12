import AutorenewIcon from '@mui/icons-material/Autorenew';
import ContentCopyIcon from '@mui/icons-material/ContentCopyOutlined';
import { Box, Button, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { fonts, penShadow } from '@nivela/design-tokens';
import { parseApiError } from '@nivela/api-contract';
import { useRef, useState } from 'react';
import { ConfirmDialog } from 'src/components/ConfirmDialog';
import { useNotify } from 'src/lib/notify/useNotify';
import { useNivelaColors } from 'src/lib/theme/useNivelaColors';

interface JoinCodeCardProps {
  code: string;
  /** Gera o código novo e atualiza a tela; rejeita se a API falhar. */
  onRegenerate: () => Promise<void>;
}

/** Código de entrada da turma: o destaque da ficha (grande, manuscrito, com marca-texto). */
export function JoinCodeCard({ code, onRegenerate }: JoinCodeCardProps) {
  const colors = useNivelaColors();
  const notify = useNotify();
  const codeRef = useRef<HTMLSpanElement>(null);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  // marca-texto cheio some no escuro: vira translúcido, como no cabeçalho
  const marker = useTheme().palette.mode === 'dark' ? alpha(colors.highlight, 0.4) : colors.highlight;

  function selectCode() {
    const node = codeRef.current;
    const selection = window.getSelection();
    if (!node || !selection) return;
    const range = document.createRange();
    range.selectNodeContents(node);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  async function copy() {
    try {
      if (!navigator.clipboard) throw new Error('clipboard indisponível');
      await navigator.clipboard.writeText(code);
      notify.success('Código copiado.');
    } catch {
      selectCode();
      notify.error('Copie o código manualmente.');
    }
  }

  async function regenerate() {
    setSaving(true);
    try {
      await onRegenerate();
      notify.success('Novo código gerado.');
    } catch (error) {
      notify.error(parseApiError(error).message);
    } finally {
      setSaving(false);
      setConfirming(false);
    }
  }

  return (
    <Box
      component="section"
      aria-label="Código da turma"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 1,
        p: { xs: 2.5, sm: 3 },
        border: `${penShadow.width}px solid ${colors.border}`,
        borderRadius: 2,
        boxShadow: `${penShadow.offset}px ${penShadow.offset}px 0 ${colors.shadow}`,
        backgroundColor: 'background.paper',
      }}
    >
      <Typography variant="overline" color="text.secondary" component="p" sx={{ lineHeight: 1.4 }}>
        Código da turma
      </Typography>
      <Box
        component="span"
        ref={codeRef}
        sx={{
          fontFamily: `${fonts.heading}, cursive`,
          fontWeight: 700,
          fontSize: { xs: '3rem', sm: '4.5rem' },
          lineHeight: 1.1,
          letterSpacing: '0.04em',
          px: 1,
          mx: -1,
          color: 'text.primary',
          backgroundImage: `linear-gradient(transparent 55%, ${marker} 55%, ${marker} 92%, transparent 92%)`,
          userSelect: 'all',
          wordBreak: 'break-all',
        }}
      >
        {code}
      </Box>
      <Typography color="text.secondary">Os alunos entram no app Nivela com este código.</Typography>
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mt: 1 }}>
        <Button variant="contained" startIcon={<ContentCopyIcon />} onClick={() => void copy()}>
          Copiar código
        </Button>
        <Button variant="outlined" color="inherit" startIcon={<AutorenewIcon />} onClick={() => setConfirming(true)}>
          Gerar novo código
        </Button>
      </Box>

      <ConfirmDialog
        open={confirming}
        title="Gerar novo código?"
        description="O código antigo deixa de funcionar."
        confirmLabel="Gerar novo código"
        tone="danger"
        loading={saving}
        onConfirm={() => void regenerate()}
        onClose={() => setConfirming(false)}
      />
    </Box>
  );
}
