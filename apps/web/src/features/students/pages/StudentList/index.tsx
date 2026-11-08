import { Box, Chip, MenuItem, TextField } from '@mui/material';
import type { ApiStudentSummary } from '@nivela/api-contract';
import { Link, useNavigate } from 'react-router';
import { DataTable } from 'src/components/DataTable';
import type { DataTableColumn } from 'src/components/DataTable';
import { PageHeader } from 'src/components/PageHeader';
import { SearchField } from 'src/components/SearchField';
import { StatusChip } from 'src/components/StatusChip';
import { listClassroomsAction } from 'src/features/classrooms';
import { listStudentsAction } from 'src/features/students/api/students.action';
import { useListQuery } from 'src/hooks/useListQuery';
import { usePaginatedList } from 'src/hooks/usePaginatedList';
import { useRemoteList } from 'src/hooks/useRemoteList';
import { validId } from 'src/utils/ids';

/** Alunos: busca por nome ou e-mail e filtro por turma na URL (`?search=ana&classroom_id=7`). */
export function StudentList() {
  const navigate = useNavigate();
  const { page, filters, setPage, setFilter } = useListQuery({ search: '', classroom_id: '' });
  const search = filters.search.trim();
  // `?classroom_id=abc` na URL é ignorado: só ids válidos vão para a API
  const classroomId = validId(filters.classroom_id);
  const { rows, meta, loading, error, reload } = usePaginatedList(
    (signal) =>
      listStudentsAction(
        {
          page: page > 1 ? page : undefined,
          search: search || undefined,
          classroom_id: classroomId ? Number(classroomId) : undefined,
        },
        signal,
      ),
    JSON.stringify([page, search, classroomId]),
  );
  const classrooms = useRemoteList(
    async (signal) => (await listClassroomsAction({ per_page: 100 }, signal)).data,
    'classrooms',
  );

  const columns: Array<DataTableColumn<ApiStudentSummary>> = [
    { key: 'name', header: 'Nome', render: (row) => row.name },
    { key: 'email', header: 'E-mail', render: (row) => row.email },
    {
      key: 'classrooms',
      header: 'Turmas',
      render: (row) =>
        row.classrooms.length === 0 ? (
          'Sem turma'
        ) : (
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {row.classrooms.map((classroom) => (
              <Chip
                key={classroom.id}
                size="small"
                variant="outlined"
                label={classroom.name}
                component={Link}
                to={`/turmas/${classroom.id}`}
                clickable
              />
            ))}
          </Box>
        ),
    },
    { key: 'coins', header: 'Moedas', width: 100, render: (row) => row.coins_balance },
    { key: 'status', header: 'Situação', width: 120, render: (row) => <StatusChip active={row.active} /> },
  ];

  const filtered = Boolean(search || classroomId);

  return (
    <>
      <PageHeader title="Alunos" subtitle="Quem estuda com a Nivela nas suas turmas." />

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
        <SearchField
          label="Buscar por nome ou e-mail"
          value={filters.search}
          onChange={(value) => setFilter('search', value)}
        />
        <TextField
          select
          size="small"
          label="Turma"
          value={classrooms.rows.some((classroom) => String(classroom.id) === classroomId) ? classroomId : ''}
          onChange={(event) => setFilter('classroom_id', event.target.value)}
          slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="">Todas</MenuItem>
          {classrooms.rows.map((classroom) => (
            <MenuItem key={classroom.id} value={String(classroom.id)}>
              {classroom.name}
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
        onRowClick={(row) => void navigate(`/alunos/${row.id}`)}
        emptyTitle={filtered ? 'Nenhum aluno encontrado.' : 'Nenhum aluno ainda.'}
        emptyDescription={
          filtered ? 'Tente outra busca ou limpe os filtros.' : 'Os alunos aparecem aqui quando entram numa turma.'
        }
      />
    </>
  );
}
