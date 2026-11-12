import CancelIcon from '@mui/icons-material/Cancel';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormHelperText,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import { parseApiError } from '@nivela/api-contract';
import type { ApiPlan, ApiPlanChapter, ApiQuestionSummary } from '@nivela/api-contract';
import { useId, useState } from 'react';
import { SearchField } from 'src/components/SearchField';
import { listCategoriesAction } from 'src/features/categories';
import { setChapterQuestionsAction } from 'src/features/leveling-plans/api/plans.action';
import { DifficultyChip, listQuestionsAction } from 'src/features/questions';
import { usePaginatedList } from 'src/hooks/usePaginatedList';
import { useRemoteList } from 'src/hooks/useRemoteList';
import { useNivelaColors } from 'src/lib/theme/useNivelaColors';

const PER_PAGE = 20;

interface QuestionPickerProps {
  planId: number;
  /** Disciplina do plano: só as questões ativas dela aparecem. */
  subjectId: number;
  chapter: ApiPlanChapter;
  onClose: () => void;
  /** Recebe o plano atualizado que a API devolve. */
  onSaved: (plan: ApiPlan) => void;
}

/**
 * Escolha de questões para um capítulo: busca no banco (ativas da disciplina do plano, com categoria e texto),
 * multi-seleção com chips e salvamento da lista completa na ordem do capítulo (as novas entram no fim).
 */
export function QuestionPicker({ planId, subjectId, chapter, onClose, onSaved }: QuestionPickerProps) {
  const titleId = useId();
  const colors = useNivelaColors();
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  // as marcadas ficam guardadas por inteiro: continuam valendo quando a busca muda
  const [selected, setSelected] = useState<ApiQuestionSummary[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { rows: categories } = useRemoteList((signal) => listCategoriesAction(String(subjectId), signal), String(subjectId));
  const term = search.trim();
  const { rows, meta, loading, error: loadError, reload } = usePaginatedList(
    (signal) =>
      listQuestionsAction(
        {
          subject_id: subjectId,
          status: 'active',
          search: term || undefined,
          category_id: categoryId ? Number(categoryId) : undefined,
          per_page: PER_PAGE,
        },
        signal,
      ),
    JSON.stringify([subjectId, term, categoryId]),
  );

  const inChapter = new Set(chapter.questions.map((question) => question.id));
  const available = rows.filter((question) => !inChapter.has(question.id));
  const isSelected = (id: number) => selected.some((question) => question.id === id);
  const categoryValue = categories.some((category) => String(category.id) === categoryId) ? categoryId : '';

  function toggle(question: ApiQuestionSummary) {
    setSelected((current) =>
      current.some((item) => item.id === question.id)
        ? current.filter((item) => item.id !== question.id)
        : [...current, question],
    );
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const ids = [...chapter.questions.map((question) => question.id), ...selected.map((question) => question.id)];
      onSaved(await setChapterQuestionsAction(planId, chapter.id, ids));
    } catch (err) {
      const info = parseApiError(err);
      setError(info.fieldErrors.question_ids?.join(' ') ?? info.message);
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onClose={() => {
        if (!saving) onClose();
      }}
      aria-labelledby={titleId}
      fullWidth
      maxWidth="md"
    >
      <DialogTitle id={titleId} component="h2" variant="h4">
        Adicionar questões
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
        <Typography color="text.secondary">
          Só aparecem questões ativas da disciplina do plano que ainda não estão neste capítulo.
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <SearchField label="Buscar no enunciado" value={search} onChange={setSearch} />
          <TextField
            select
            size="small"
            label="Categoria"
            value={categoryValue}
            onChange={(event) => setCategoryId(event.target.value)}
            slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">Todas</MenuItem>
            {categories.map((category) => (
              <MenuItem key={category.id} value={String(category.id)}>
                {category.name}
              </MenuItem>
            ))}
          </TextField>
        </Box>

        {selected.length > 0 ? (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {selected.map((question) => (
              <Chip
                key={question.id}
                label={question.statement_excerpt}
                onDelete={() => toggle(question)}
                deleteIcon={<CancelIcon titleAccess={`Desmarcar questão ${question.id}`} />}
                sx={{ maxWidth: 280 }}
              />
            ))}
          </Box>
        ) : null}

        <Box
          sx={{
            border: `1px solid ${colors.border}`,
            borderRadius: 1,
            minHeight: 160,
            maxHeight: 340,
            overflowY: 'auto',
            p: 1,
          }}
        >
          {loadError ? (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <Typography color="text.secondary" sx={{ mb: 1 }}>
                {loadError}
              </Typography>
              <Button variant="outlined" onClick={() => void reload()}>
                Tentar de novo
              </Button>
            </Box>
          ) : loading && rows.length === 0 ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress aria-label="Carregando" />
            </Box>
          ) : available.length === 0 ? (
            <Typography color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
              {term || categoryId ? 'Nenhuma questão encontrada.' : 'Não há questões ativas para adicionar.'}
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', opacity: loading ? 0.6 : 1 }}>
              {available.map((question) => (
                <FormControlLabel
                  key={question.id}
                  sx={{ alignItems: 'flex-start', m: 0, py: 0.5, borderBottom: `1px solid ${colors.rule}` }}
                  control={<Checkbox checked={isSelected(question.id)} onChange={() => toggle(question)} />}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', pt: 0.75 }}>
                      <Typography component="span">{question.statement_excerpt}</Typography>
                      <DifficultyChip difficulty={question.difficulty} />
                      <Typography component="span" variant="body2" color="text.secondary">
                        {question.category.name}
                      </Typography>
                    </Box>
                  }
                />
              ))}
            </Box>
          )}
        </Box>
        {meta && meta.total > PER_PAGE ? (
          <Typography variant="body2" color="text.secondary">
            Mostrando as primeiras {PER_PAGE} questões. Refine a busca para ver as outras.
          </Typography>
        ) : null}

        {error ? (
          <FormHelperText error role="alert">
            {error}
          </FormHelperText>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} disabled={saving} color="inherit">
          Cancelar
        </Button>
        <Button
          variant="contained"
          disabled={saving || selected.length === 0}
          onClick={() => void save()}
          startIcon={saving ? <CircularProgress size={16} color="inherit" aria-hidden /> : undefined}
        >
          Adicionar selecionadas
        </Button>
      </DialogActions>
    </Dialog>
  );
}
