import BlockIcon from '@mui/icons-material/BlockOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircleOutlined';
import EditIcon from '@mui/icons-material/EditOutlined';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { resolveAssetUrl } from '@nivela/api-contract';
import type { ApiReward } from '@nivela/api-contract';
import { penShadow } from '@nivela/design-tokens';
import { Mascot } from 'src/components/Mascot';
import { StatusChip } from 'src/components/StatusChip';
import { useNivelaColors } from 'src/lib/theme/useNivelaColors';

interface RewardCardProps {
  reward: ApiReward;
  /** Uma operação está em andamento: trava os botões. */
  busy: boolean;
  onEdit: () => void;
  onToggle: () => void;
}

const pendingText = (count: number): string =>
  count === 0 ? 'Nenhum resgate pendente.' : count === 1 ? '1 resgate pendente.' : `${count} resgates pendentes.`;

/** Cartão de caderno de um prêmio: foto (ou o mascote), nome com marca-texto, preço, estoque e ações de quem pode editar. */
export function RewardCard({ reward, busy, onEdit, onToggle }: RewardCardProps) {
  const colors = useNivelaColors();
  const marker = useTheme().palette.mode === 'dark' ? alpha(colors.highlight, 0.4) : colors.highlight;
  const imageSrc = resolveAssetUrl(import.meta.env.VITE_API_URL, reward.image_url);

  return (
    <Box
      component="article"
      aria-label={reward.name}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        border: `${penShadow.width}px solid ${colors.border}`,
        // margem vermelha do caderno
        borderLeft: `6px solid ${colors.secondary}`,
        borderRadius: 2,
        boxShadow: `${penShadow.offset}px ${penShadow.offset}px 0 ${colors.shadow}`,
        backgroundColor: 'background.paper',
        overflow: 'hidden',
        opacity: reward.active ? 1 : 0.8,
      }}
    >
      <Box
        sx={{
          display: 'grid',
          // a linha precisa ser limitada a 160 px; senão uma foto grande estoura o cartão
          gridTemplateRows: 'minmax(0, 1fr)',
          placeItems: 'center',
          overflow: 'hidden',
          height: 160,
          backgroundColor: colors.rule,
          borderBottom: `${penShadow.width}px solid ${colors.border}`,
        }}
      >
        {imageSrc ? (
          <Box
            component="img"
            src={imageSrc}
            alt={`Foto do prêmio ${reward.name}`}
            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <Mascot size={72} />
        )}
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, p: 2, flex: 1 }}>
        <Typography variant="h3" component="h3">
          <Box
            component="span"
            sx={{
              backgroundImage: `linear-gradient(transparent 58%, ${marker} 58%, ${marker} 92%, transparent 92%)`,
              px: 0.5,
              mx: -0.5,
              boxDecorationBreak: 'clone',
              WebkitBoxDecorationBreak: 'clone',
            }}
          >
            {reward.name}
          </Box>
        </Typography>
        {reward.description ? (
          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
            {reward.description}
          </Typography>
        ) : null}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            flexWrap: 'wrap',
          }}
        >
          <Typography sx={{ fontWeight: 800 }}>
            {reward.price === 1 ? '1 moeda.' : `${reward.price} moedas.`}
          </Typography>
          <Typography color="text.secondary">Estoque: {reward.stock}.</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          {pendingText(reward.pending_redemptions)}
        </Typography>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mt: 'auto',
            pt: 1,
          }}
        >
          <StatusChip active={reward.active} />
          {reward.can_edit ? (
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Tooltip title="Editar prêmio">
                <IconButton aria-label={`Editar ${reward.name}`} disabled={busy} onClick={onEdit}>
                  <EditIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title={reward.active ? 'Desativar prêmio' : 'Ativar prêmio'}>
                <IconButton
                  aria-label={`${reward.active ? 'Desativar' : 'Ativar'} ${reward.name}`}
                  disabled={busy}
                  onClick={onToggle}
                >
                  {reward.active ? <BlockIcon /> : <CheckCircleIcon />}
                </IconButton>
              </Tooltip>
            </Box>
          ) : null}
        </Box>
      </Box>
    </Box>
  );
}
