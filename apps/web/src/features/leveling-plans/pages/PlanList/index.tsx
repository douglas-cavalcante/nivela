import AddIcon from '@mui/icons-material/Add';
import { Box, Button, MenuItem, TextField } from '@mui/material';
import type { ApiPlanSummary } from '@nivela/api-contract';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { DataTable } from 'src/components/DataTable';
import type { DataTableColumn } from 'src/components/DataTable';
import { PageHeader } from 'src/components/PageHeader';
import { SearchField } from 'src/components/SearchField';
import { listPlansAction } from 'src/features/leveling-plans/api/plans.action';
import { PlanFormDialog } from 'src/features/leveling-plans/components/PlanFormDialog';
import { PlanStatusChip } from 'src/features/leveling-plans/components/PlanStatusChip';
import { SubjectBadge, listSubjectsAction } from 'src/features/subjects';
import { useListQuery } from 'src/hooks/useListQuery';
import { usePaginatedList } from 'src/hooks/usePaginatedList';
import { useRemoteList } from 'src/hooks/useRemoteList';
import { useAuth } from 'src/lib/auth/AuthContext';
import { validId } from 'src/utils/ids';

const selectProps = { inputLabel: { shrink: true }, select: { displayEmpty: true } } as const;

/** Planos de nivelamento: busca, situação e disciplina na URL (`?search=fra&status=published&subject_id=1`). */
export function PlanList() {
  const navigate = useNavigate();
  const isAdmin = useAuth().user?.role === 'admin';
  const [creating, setCreating] = useState(false);
  const { page, filters, setPage, setFilter } = useListQuery({ search: '', status: '', subject_id: '' });
  const search = filters.search.trim();
  // valores desconhecidos na URL são ignorados: só filtros válidos vão para a API
  const status = filters.status === 'draft' || filters.status === 'published' ? filters.status : '';
  const subjectId = validId(filters.subject_id);

  const { rows: subjects } = useRemoteList((signal) => listSubjectsAction(signal), 'subjects');
  const { rows, meta, loading, error, reload } = usePaginatedList(
    (signal) =>
      listPlansAction(
        {
          page: page > 1 ? page : undefined,
          search: search || undefined,
          status: status || undefined,
          subject_id: subjectId ? Number(subjectId) : undefined,
        },
        signal,
      ),
    JSON.stringify([page, search, status, subjectId]),
  );

  const subjectValue = subjects.some((subject) => String(subject.id) === subjectId) ? subjectId : '';

  const columns: Array<DataTableColumn<ApiPlanSummary>> = [
    { key: 'title', header: 'Título', render: (row) => row.title },
    { key: 'subject', header: 'Disciplina', render: (row) => <SubjectBadge subject={row.subject} /> },
    ...(isAdmin ? [{ key: 'teacher', header: 'Professor', render: (row: ApiPlanSummary) => row.teacher.name }] : []),
    { key: 'chapters', header: 'Capítulos', width: 110, render: (row) => row.chapters_count },
    { key: 'questions', header: 'Questões', width: 110, render: (row) => row.questions_count },
    { key: 'assignments', header: 'Atribuições', width: 120, render: (row) => row.assignments_count },
    { key: 'status', header: 'Situação', width: 130, render: (row) => <PlanStatusChip status={row.status} /> },
  ];

  const filtered = Boolean(search || status || subjectId);

  return (
    <>
      <PageHeader
        title="Planos"
        subtitle="Monte planos de nivelamento com capítulos e questões e atribua às turmas."
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreating(true)}>
            Novo plano
          </Button>
        }
      />

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
        <SearchField
          label="Buscar pelo título"
          value={filters.search}
          onChange={(value) => setFilter('search', value)}
        />
        <TextField
          select
          size="small"
          label="Situação"
          value={status}
          onChange={(event) => setFilter('status', event.target.value)}
          slotProps={selectProps}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="">Todas</MenuItem>
          <MenuItem value="draft">Rascunho</MenuItem>
          <MenuItem value="published">Publicado</MenuItem>
        </TextField>
        <TextField
          select
          size="small"
          label="Disciplina"
          value={subjectValue}
          onChange={(event) => setFilter('subject_id', event.target.value)}
          slotProps={selectProps}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="">Todas</MenuItem>
          {subjects.map((subject) => (
            <MenuItem key={subject.id} value={String(subject.id)}>
              {subject.name}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        loading={loading}
        error={error}
        onRetry={() => void reload()}
        meta={meta}
        onPageChange={setPage}
        onRowClick={(row) => void navigate(`/planos/${row.id}`)}
        emptyTitle={filtered ? 'Nenhum plano encontrado.' : 'Nenhum plano ainda.'}
        emptyDescription={
          filtered ? 'Tente outra busca ou limpe os filtros.' : 'Crie o primeiro plano para começar a nivelar suas turmas.'
        }
      />

      {creating ? (
        <PlanFormDialog
          subjects={subjects}
          onClose={() => setCreating(false)}
          onSaved={(saved) => void navigate(`/planos/${saved.id}`)}
        />
      ) : null}
    </>
  );
}
