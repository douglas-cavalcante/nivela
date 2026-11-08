import AddIcon from '@mui/icons-material/Add';
import BlockIcon from '@mui/icons-material/BlockOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircleOutlined';
import ImageIcon from '@mui/icons-material/ImageOutlined';
import { Box, Button, IconButton, Tooltip, Typography } from '@mui/material';
import { parseApiError } from '@nivela/api-contract';
import type { ApiQuestionSummary, Difficulty } from '@nivela/api-contract';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ConfirmDialog } from 'src/components/ConfirmDialog';
import { DataTable } from 'src/components/DataTable';
import type { DataTableColumn } from 'src/components/DataTable';
import { PageHeader } from 'src/components/PageHeader';
import { StatusChip } from 'src/components/StatusChip';
import { listCategoriesAction } from 'src/features/categories';
import { listQuestionsAction, setQuestionStatusAction } from 'src/features/questions/api/questions.action';
import { DifficultyChip } from 'src/features/questions/components/DifficultyChip';
import { QuestionFilters } from 'src/features/questions/components/QuestionFilters';
import type { QuestionFilterValues } from 'src/features/questions/components/QuestionFilters';
import { SubjectBadge, listSubjectsAction } from 'src/features/subjects';
import { useListQuery } from 'src/hooks/useListQuery';
import { usePaginatedList } from 'src/hooks/usePaginatedList';
import { useRemoteList } from 'src/hooks/useRemoteList';
import { useAuth } from 'src/lib/auth/AuthContext';
import { useNotify } from 'src/lib/notify/useNotify';
import { validId } from 'src/utils/ids';

/** Banco de questões: tabela paginada com filtros na URL (`?subject_id=1&category_id=3&difficulty=hard`). */
export function QuestionList() {
  const navigate = useNavigate();
  const notify = useNotify();
  const { user } = useAuth();
  const [toggling, setToggling] = useState<ApiQuestionSummary | null>(null);
  const [saving, setSaving] = useState(false);
  const { page, filters, setPage, setFilters } = useListQuery({
    search: '',
    subject_id: '',
    category_id: '',
    difficulty: '',
    status: '',
  });
  const search = filters.search.trim();
  const subjectId = validId(filters.subject_id);
  // categoria sem disciplina não vale; valores desconhecidos na URL são ignorados
  const categoryId = subjectId ? validId(filters.category_id) : '';
  const difficulty = (['easy', 'medium', 'hard'] as const).find((value) => value === filters.difficulty) ?? '';
  const status = filters.status === 'active' || filters.status === 'inactive' ? filters.status : '';

  const { rows: subjects } = useRemoteList((signal) => listSubjectsAction(signal), 'subjects');
  const { rows: categories } = useRemoteList(
    (signal) => (subjectId ? listCategoriesAction(subjectId, signal) : Promise.resolve([])),
    subjectId,
  );

  const { rows, meta, loading, error, reload } = usePaginatedList(
    (signal) =>
      listQuestionsAction(
        {
          page: page > 1 ? page : undefined,
          search: search || undefined,
          subject_id: subjectId ? Number(subjectId) : undefined,
          category_id: categoryId ? Number(categoryId) : undefined,
          difficulty: (difficulty || undefined) as Difficulty | undefined,
          status: status || undefined,
        },
        signal,
      ),
    JSON.stringify([page, search, subjectId, categoryId, difficulty, status]),
  );

  /** A lista não traz `can_edit`: o autor e o administrador podem mudar a situação. */
  const canEdit = (row: ApiQuestionSummary) => user?.role === 'admin' || (user !== null && row.author.id === user.id);

  async function changeStatus(row: ApiQuestionSummary) {
    const activate = !row.active;
    setSaving(true);
    try {
      await setQuestionStatusAction(row.id, activate);
      notify.success(activate ? 'Questão ativada.' : 'Questão desativada.');
      await reload();
    } catch (err) {
      notify.error(parseApiError(err).message);
    } finally {
      setSaving(false);
      setToggling(null);
    }
  }

  function askToggle(row: ApiQuestionSummary) {
    if (!row.active) void changeStatus(row); // ativar não precisa de confirmação
    else setToggling(row);
  }

  const values: QuestionFilterValues = {
    search: filters.search,
    subject_id: subjectId,
    category_id: categoryId,
    difficulty,
    status,
  };

  const columns: Array<DataTableColumn<ApiQuestionSummary>> = [
    {
      key: 'statement',
      header: 'Enunciado',
      render: (row) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, maxWidth: 480 }}>
          <Typography component="span">{row.statement_excerpt}</Typography>
          {row.has_image ? <ImageIcon fontSize="small" titleAccess="Tem imagem" color="action" /> : null}
        </Box>
      ),
    },
    { key: 'subject', header: 'Disciplina', render: (row) => <SubjectBadge subject={row.subject} /> },
    { key: 'category', header: 'Categoria', render: (row) => row.category.name },
    {
      key: 'difficulty',
      header: 'Dificuldade',
      width: 130,
      render: (row) => <DifficultyChip difficulty={row.difficulty} />,
    },
    { key: 'author', header: 'Autor', render: (row) => row.author.name },
    { key: 'status', header: 'Situação', width: 120, render: (row) => <StatusChip active={row.active} /> },
    {
      key: 'actions',
      header: 'Ações',
      width: 90,
      render: (row) =>
        canEdit(row) ? (
          <Tooltip title={row.active ? 'Desativar questão' : 'Ativar questão'}>
            <IconButton
              aria-label={`${row.active ? 'Desativar' : 'Ativar'} questão ${row.id}`}
              disabled={saving}
              onClick={() => askToggle(row)}
            >
              {row.active ? <BlockIcon /> : <CheckCircleIcon />}
            </IconButton>
          </Tooltip>
        ) : null,
    },
  ];

  const filtered = Boolean(search || subjectId || categoryId || difficulty || status);

  return (
    <>
      <PageHeader
        title="Questões"
        subtitle="O banco de questões da Nivela: filtre por disciplina, categoria e dificuldade."
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => void navigate('/questoes/nova')}>
            Nova questão
          </Button>
        }
      />

      <QuestionFilters values={values} subjects={subjects} categories={categories} onChange={setFilters} />

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        loading={loading}
        error={error}
        onRetry={() => void reload()}
        meta={meta}
        onPageChange={setPage}
        onRowClick={(row) => void navigate(`/questoes/${row.id}`)}
        emptyTitle={filtered ? 'Nenhuma questão encontrada.' : 'Nenhuma questão ainda.'}
        emptyDescription={
          filtered ? 'Tente outra busca ou limpe os filtros.' : 'Cadastre a primeira questão para começar o banco.'
        }
      />

      <ConfirmDialog
        open={toggling !== null}
        title="Desativar a questão?"
        description="Questões inativas não aparecem para os alunos."
        confirmLabel="Desativar"
        tone="danger"
        loading={saving}
        onConfirm={() => {
          if (toggling) void changeStatus(toggling);
        }}
        onClose={() => setToggling(null)}
      />
    </>
  );
}
