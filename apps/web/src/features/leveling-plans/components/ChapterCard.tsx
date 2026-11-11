import AddIcon from '@mui/icons-material/Add';
import ArrowDownIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpIcon from '@mui/icons-material/ArrowUpward';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import EditIcon from '@mui/icons-material/EditOutlined';
import { Box, Button, Chip, IconButton, Tooltip, Typography } from '@mui/material';
import type { ApiPlanChapter } from '@nivela/api-contract';
import { penShadow } from '@nivela/design-tokens';
import { DifficultyChip } from 'src/features/questions';
import { useNivelaColors } from 'src/lib/theme/useNivelaColors';

interface ChapterCardProps {
  /** Posição do capítulo na lista (começa em 1). */
  number: number;
  total: number;
  chapter: ApiPlanChapter;
  /** Uma operação está em andamento: trava os botões. */
  busy: boolean;
  onMove: (direction: -1 | 1) => void;
  onRename: () => void;
  onDelete: () => void;
  onAddQuestions: () => void;
  onMoveQuestion: (index: number, direction: -1 | 1) => void;
  onRemoveQuestion: (index: number) => void;
}

/** Ficha de caderno de um capítulo: número, título e a lista ordenável de questões. */
export function ChapterCard({
  number,
  total,
  chapter,
  busy,
  onMove,
  onRename,
  onDelete,
  onAddQuestions,
  onMoveQuestion,
  onRemoveQuestion,
}: ChapterCardProps) {
  const colors = useNivelaColors();
  const count = chapter.questions.length;

  return (
    <Box
      component="section"
      aria-label={`Capítulo ${number}: ${chapter.title}`}
      sx={{
        border: `${penShadow.width}px solid ${colors.border}`,
        // margem vermelha do caderno
        borderLeft: `6px solid ${colors.secondary}`,
        borderRadius: 2,
        boxShadow: `${penShadow.offset}px ${penShadow.offset}px 0 ${colors.shadow}`,
        backgroundColor: 'background.paper',
        p: { xs: 2, sm: 3 },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <Box
          aria-hidden
          sx={{
            width: 36,
            height: 36,
            flexShrink: 0,
            display: 'grid',
            placeItems: 'center',
            borderRadius: '50%',
            border: `${penShadow.width}px solid ${colors.border}`,
            backgroundColor: colors.highlight,
            color: colors.onHighlight,
            fontWeight: 800,
          }}
        >
          {number}
        </Box>
        <Box sx={{ flex: 1, minWidth: 160 }}>
          <Typography variant="h3" component="h3">
            {chapter.title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {count === 0 ? 'Nenhuma questão ainda.' : count === 1 ? '1 questão.' : `${count} questões.`}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Subir capítulo">
            <span>
              <IconButton aria-label={`Subir capítulo ${number}`} disabled={busy || number === 1} onClick={() => onMove(-1)}>
                <ArrowUpIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Descer capítulo">
            <span>
              <IconButton
                aria-label={`Descer capítulo ${number}`}
                disabled={busy || number === total}
                onClick={() => onMove(1)}
              >
                <ArrowDownIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Renomear capítulo">
            <span>
              <IconButton aria-label={`Renomear capítulo ${number}`} disabled={busy} onClick={onRename}>
                <EditIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Excluir capítulo">
            <span>
              <IconButton aria-label={`Excluir capítulo ${number}`} disabled={busy} onClick={onDelete}>
                <DeleteIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>

      {count > 0 ? (
        <Box component="ol" sx={{ listStyle: 'none', m: 0, mt: 2, p: 0 }}>
          {chapter.questions.map((question, index) => (
            <Box
              component="li"
              key={question.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                py: 0.75,
                borderTop: `1px solid ${colors.rule}`,
                // as linhas da pauta: a questão inativa fica apagada
                opacity: question.active ? 1 : 0.7,
              }}
            >
              <Typography component="span" color="text.secondary" sx={{ width: 24, flexShrink: 0, fontWeight: 700 }}>
                {index + 1}.
              </Typography>
              <Typography component="span" sx={{ flex: 1, minWidth: 0 }}>
                {question.statement_excerpt}
              </Typography>
              {question.active ? null : (
                <Chip size="small" variant="outlined" label="Inativa" sx={{ '& .MuiChip-label': { px: 1.25 } }} />
              )}
              <DifficultyChip difficulty={question.difficulty} />
              <Box sx={{ display: 'flex', flexShrink: 0 }}>
                <IconButton
                  size="small"
                  aria-label={`Subir questão ${index + 1}`}
                  disabled={busy || index === 0}
                  onClick={() => onMoveQuestion(index, -1)}
                >
                  <ArrowUpIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  aria-label={`Descer questão ${index + 1}`}
                  disabled={busy || index === count - 1}
                  onClick={() => onMoveQuestion(index, 1)}
                >
                  <ArrowDownIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  aria-label={`Remover questão ${index + 1}`}
                  disabled={busy}
                  onClick={() => onRemoveQuestion(index)}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            </Box>
          ))}
        </Box>
      ) : null}

      <Button variant="outlined" color="inherit" startIcon={<AddIcon />} disabled={busy} onClick={onAddQuestions} sx={{ mt: 2 }}>
        Adicionar questões
      </Button>
    </Box>
  );
}
