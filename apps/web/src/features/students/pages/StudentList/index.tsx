import { Box, Chip } from '@mui/material';
import { parseApiError } from '@nivela/api-contract';
import type { ApiClassroomSummary, ApiStudentSummary } from '@nivela/api-contract';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { AsyncAutocomplete } from 'src/components/AsyncAutocomplete';
import { DataTable } from 'src/components/DataTable';
import type { DataTableColumn } from 'src/components/DataTable';
import { PageHeader } from 'src/components/PageHeader';
import { SearchField } from 'src/components/SearchField';
import { StatusChip } from 'src/components/StatusChip';
import { getClassroomAction, listClassroomsAction } from 'src/features/classrooms';
import { listStudentsAction } from 'src/features/students/api/students.action';
import { useListQuery } from 'src/hooks/useListQuery';
import { usePaginatedList } from 'src/hooks/usePaginatedList';
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
  // turma do filtro como objeto (o autocomplete mostra o nome); vinda da URL, é resolvida por GET /classrooms/:id
  const [selected, setSelected] = useState<ApiClassroomSummary | null>(null);
  // id da turma que não deu para resolver (falha que não é 404): o campo avisa em vez de engolir o erro
  const [failedId, setFailedId] = useState('');

  const current = selected && String(selected.id) === classroomId ? selected : null;
  const needsFetch = Boolean(classroomId) && !current;

  useEffect(() => {
    if (!needsFetch) return;
    const controller = new AbortController();
    getClassroomAction(Number(classroomId), controller.signal).then(
      (classroom) => setSelected(classroom),
      (error: unknown) => {
        if (controller.signal.aborted) return;
        // turma que não existe (ou fora do escopo): tira o filtro da URL
        if (parseApiError(error).status === 404) setFilter('classroom_id', '');
        else setFailedId(classroomId);
      },
    );
    return () => controller.abort();
  }, [needsFetch, classroomId, setFilter]);

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
        <Box sx={{ minWidth: 220 }}>
          <AsyncAutocomplete<ApiClassroomSummary>
            label="Turma"
            size="small"
            value={current}
            onChange={(classroom) => {
              setSelected(classroom);
              setFilter('classroom_id', classroom ? String(classroom.id) : '');
            }}
            load={async (text, signal) =>
              (await listClassroomsAction({ search: text || undefined, per_page: 20 }, signal)).data
            }
            getOptionLabel={(classroom) => classroom.name}
            getOptionKey={(classroom) => classroom.id}
            error={failedId === classroomId && !current ? 'Não foi possível carregar a turma.' : undefined}
          />
        </Box>
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
