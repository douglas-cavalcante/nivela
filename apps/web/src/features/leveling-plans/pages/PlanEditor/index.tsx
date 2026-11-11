import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/EditOutlined';
import { Alert, Box, Button, CircularProgress, Typography } from '@mui/material';
import { parseApiError } from '@nivela/api-contract';
import type { ApiPlan, ApiPlanChapter } from '@nivela/api-contract';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ConfirmDialog } from 'src/components/ConfirmDialog';
import { EmptyState } from 'src/components/EmptyState';
import { PageHeader } from 'src/components/PageHeader';
import { ResourceState } from 'src/components/ResourceState';
import {
  getPlanAction,
  publishPlanAction,
  removeChapterAction,
  reorderChaptersAction,
  setChapterQuestionsAction,
} from 'src/features/leveling-plans/api/plans.action';
import { ChapterCard } from 'src/features/leveling-plans/components/ChapterCard';
import { ChapterFormDialog } from 'src/features/leveling-plans/components/ChapterFormDialog';
import { PlanFormDialog } from 'src/features/leveling-plans/components/PlanFormDialog';
import { PlanStatusChip } from 'src/features/leveling-plans/components/PlanStatusChip';
import { QuestionPicker } from 'src/features/leveling-plans/components/QuestionPicker';
import { SubjectBadge, listSubjectsAction } from 'src/features/subjects';
import { useRemoteList } from 'src/hooks/useRemoteList';
import { useAuth } from 'src/lib/auth/AuthContext';
import { useNotify } from 'src/lib/notify/useNotify';
import { validId } from 'src/utils/ids';

const BACK = { to: '/planos', label: 'Voltar' };

/** Troca dois vizinhos de lugar (`index` e `index + direction`); devolve a lista nova. */
function swapped<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const next = [...items];
  const target = index + direction;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

interface PlanViewProps {
  plan: ApiPlan;
  onPlan: (plan: ApiPlan) => void;
}

function PlanView({ plan, onPlan }: PlanViewProps) {
  const notify = useNotify();
  const isAdmin = useAuth().user?.role === 'admin';
  const { rows: subjects } = useRemoteList((signal) => listSubjectsAction(signal), 'subjects');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  // `'new'`: capítulo novo; um capítulo: renomear
  const [chapterForm, setChapterForm] = useState<ApiPlanChapter | 'new' | null>(null);
  const [deleting, setDeleting] = useState<ApiPlanChapter | null>(null);
  // mantém o último capítulo no texto do diálogo durante a animação de saída
  const [lastDeleting, setLastDeleting] = useState<ApiPlanChapter | null>(null);
  const [picking, setPicking] = useState<ApiPlanChapter | null>(null);

  /** Roda uma alteração: o plano devolvido pela API vira o plano da tela; erros (inclusive 409) viram aviso. */
  async function run(change: () => Promise<ApiPlan>, success?: string): Promise<boolean> {
    setBusy(true);
    try {
      onPlan(await change());
      if (success) notify.success(success);
      return true;
    } catch (error) {
      notify.error(parseApiError(error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  function moveChapter(index: number, direction: -1 | 1) {
    const ids = swapped(
      plan.chapters.map((chapter) => chapter.id),
      index,
      direction,
    );
    void run(() => reorderChaptersAction(plan.id, ids));
  }

  function changeQuestions(chapter: ApiPlanChapter, ids: number[]) {
    void run(() => setChapterQuestionsAction(plan.id, chapter.id, ids));
  }

  async function confirmDelete() {
    if (!deleting) return;
    await run(() => removeChapterAction(plan.id, deleting.id), 'Capítulo excluído.');
    setDeleting(null);
  }

  async function confirmPublish() {
    await run(() => publishPlanAction(plan.id), 'Plano publicado.');
    setPublishing(false);
  }

  const draft = plan.status === 'draft';

  return (
    <>
      <Button component={Link} to="/planos" color="inherit" sx={{ mb: 1, ml: -1 }}>
        ← Planos
      </Button>
      <PageHeader
        title={plan.title}
        actions={
          <>
            <Button variant="outlined" color="inherit" startIcon={<EditIcon />} onClick={() => setEditing(true)}>
              Editar plano
            </Button>
            {draft ? (
              <Button variant="contained" disabled={busy} onClick={() => setPublishing(true)}>
                Publicar
              </Button>
            ) : null}
          </>
        }
      />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 1 }}>
        <SubjectBadge subject={plan.subject} />
        <PlanStatusChip status={plan.status} />
        <Typography color="text.secondary">Bônus de conclusão: {plan.completion_bonus} moedas.</Typography>
        {isAdmin ? <Typography color="text.secondary">Professor: {plan.teacher.name}</Typography> : null}
      </Box>
      {plan.description ? (
        <Typography sx={{ mb: 3, maxWidth: 720, whiteSpace: 'pre-line' }}>{plan.description}</Typography>
      ) : (
        <Box sx={{ mb: 3 }} />
      )}

      <Box component="section" aria-labelledby="chapters-title">
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mb: 2 }}>
          <Typography id="chapters-title" variant="h3" component="h2">
            Capítulos ({plan.chapters.length})
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} disabled={busy} onClick={() => setChapterForm('new')}>
            Novo capítulo
          </Button>
        </Box>

        {plan.has_progress ? (
          <Alert severity="info" role="note" sx={{ mb: 2 }}>
            Este plano já tem progresso de alunos: dá para adicionar e reordenar, mas não para remover capítulos ou questões.
          </Alert>
        ) : null}

        {plan.chapters.length === 0 ? (
          <EmptyState
            title="Nenhum capítulo ainda."
            description="Adicione o primeiro capítulo para montar o plano."
          />
        ) : (
          <Box sx={{ display: 'grid', gap: 3 }}>
            {plan.chapters.map((chapter, index) => (
              <ChapterCard
                key={chapter.id}
                number={index + 1}
                total={plan.chapters.length}
                chapter={chapter}
                busy={busy}
                onMove={(direction) => moveChapter(index, direction)}
                onRename={() => setChapterForm(chapter)}
                onDelete={() => {
                  setLastDeleting(chapter);
                  setDeleting(chapter);
                }}
                onAddQuestions={() => setPicking(chapter)}
                onMoveQuestion={(questionIndex, direction) =>
                  changeQuestions(
                    chapter,
                    swapped(
                      chapter.questions.map((question) => question.id),
                      questionIndex,
                      direction,
                    ),
                  )
                }
                onRemoveQuestion={(questionIndex) =>
                  changeQuestions(
                    chapter,
                    chapter.questions.filter((_question, position) => position !== questionIndex).map((question) => question.id),
                  )
                }
              />
            ))}
          </Box>
        )}
      </Box>

      {editing ? (
        <PlanFormDialog
          plan={plan}
          subjects={subjects}
          onClose={() => setEditing(false)}
          onSaved={(saved) => {
            onPlan(saved);
            notify.success('Plano atualizado.');
            setEditing(false);
          }}
        />
      ) : null}

      {chapterForm !== null ? (
        <ChapterFormDialog
          planId={plan.id}
          chapter={chapterForm === 'new' ? undefined : chapterForm}
          onClose={() => setChapterForm(null)}
          onSaved={(saved) => {
            onPlan(saved);
            notify.success(chapterForm === 'new' ? 'Capítulo adicionado.' : 'Capítulo renomeado.');
            setChapterForm(null);
          }}
        />
      ) : null}

      {picking ? (
        <QuestionPicker
          planId={plan.id}
          subjectId={plan.subject.id}
          chapter={picking}
          onClose={() => setPicking(null)}
          onSaved={(saved) => {
            onPlan(saved);
            notify.success('Questões adicionadas.');
            setPicking(null);
          }}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        title="Excluir o capítulo?"
        description={`O capítulo "${lastDeleting?.title ?? ''}" e a lista de questões dele saem do plano. As questões continuam no banco.`}
        confirmLabel="Excluir capítulo"
        tone="danger"
        loading={busy}
        onConfirm={() => void confirmDelete()}
        onClose={() => setDeleting(null)}
      />

      <ConfirmDialog
        open={publishing}
        title="Publicar o plano?"
        description="Depois de publicado, o plano pode ser atribuído às turmas."
        confirmLabel="Publicar"
        loading={busy}
        onConfirm={() => void confirmPublish()}
        onClose={() => setPublishing(false)}
      />
    </>
  );
}

function PlanLoader({ id }: { id: number }) {
  const { rows, loading, error, errorStatus, reload } = useRemoteList<ApiPlan>(
    async (signal) => [await getPlanAction(id, signal)],
    String(id),
  );
  const notify = useNotify();
  // O plano em tela: nasce da busca e é trocado pelas respostas das alterações (a API devolve o plano inteiro).
  const [plan, setPlan] = useState<ApiPlan | null>(null);
  const [seen, setSeen] = useState<ApiPlan | null>(null);
  if (rows[0] && rows[0] !== seen) {
    setSeen(rows[0]);
    setPlan(rows[0]);
  }

  useEffect(() => {
    if (error && plan) notify.error(error);
  }, [error, plan, notify]);

  if (error && !plan) {
    return (
      <ResourceState
        kind={errorStatus === 404 ? 'not-found' : 'error'}
        message={error}
        onRetry={() => void reload()}
        backTo={BACK}
      />
    );
  }
  if (loading && !plan) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress aria-label="Carregando" />
      </Box>
    );
  }
  if (!plan) return null;
  return <PlanView plan={plan} onPlan={setPlan} />;
}

/** Editor do plano: dados, capítulos em fichas de caderno e a lista ordenável de questões de cada um. */
export function PlanEditor() {
  const { id } = useParams();
  if (!validId(id)) return <ResourceState kind="not-found" message="Plano não encontrado." backTo={BACK} />;
  return <PlanLoader key={id} id={Number(id)} />;
}
