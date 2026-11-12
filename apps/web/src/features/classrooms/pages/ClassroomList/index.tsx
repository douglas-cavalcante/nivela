import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/EditOutlined';
import { Box, Button, IconButton, MenuItem, TextField, Tooltip } from '@mui/material';
import type { ApiClassroomSummary } from '@nivela/api-contract';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { DataTable } from 'src/components/DataTable';
import type { DataTableColumn } from 'src/components/DataTable';
import { PageHeader } from 'src/components/PageHeader';
import { SearchField } from 'src/components/SearchField';
import { StatusChip } from 'src/components/StatusChip';
import { listClassroomsAction } from 'src/features/classrooms/api/classrooms.action';
import { ClassroomFormDialog } from 'src/features/classrooms/components/ClassroomFormDialog';
import { useListQuery } from 'src/hooks/useListQuery';
import { usePaginatedList } from 'src/hooks/usePaginatedList';
import { useAuth } from 'src/lib/auth/AuthContext';
import { useNotify } from 'src/lib/notify/useNotify';

type StatusFilter = '' | 'active' | 'inactive';

const statusOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: '', label: 'Todas' },
  { value: 'active', label: 'Ativas' },
  { value: 'inactive', label: 'Inativas' },
];

/** Turmas: o professor vê as próprias; o administrador vê todas e escolhe o professor ao criar. */
export function ClassroomList() {
  const notify = useNotify();
  const navigate = useNavigate();
  const isAdmin = useAuth().user?.role === 'admin';
  const { page, filters, setPage, setFilter } = useListQuery({ search: '', status: '' });
  const search = filters.search.trim();
  // `?status=xyz` na URL é ignorado: só valores conhecidos vão para a API
  const status: StatusFilter = filters.status === 'active' || filters.status === 'inactive' ? filters.status : '';
  const { rows, meta, loading, error, reload } = usePaginatedList(
    (signal) =>
      listClassroomsAction(
        { page: page > 1 ? page : undefined, search: search || undefined, status: status || undefined },
        signal,
      ),
    JSON.stringify([page, search, status]),
  );

  const [editing, setEditing] = useState<ApiClassroomSummary | 'new' | null>(null);

  const columns: Array<DataTableColumn<ApiClassroomSummary>> = [
    { key: 'name', header: 'Nome', render: (row) => row.name },
    { key: 'year', header: 'Ano letivo', width: 120, render: (row) => row.school_year ?? '—' },
    { key: 'code', header: 'Código', width: 130, render: (row) => row.join_code },
    { key: 'students', header: 'Alunos', width: 90, render: (row) => row.students_count },
    ...(isAdmin ? [{ key: 'teacher', header: 'Professor', render: (row: ApiClassroomSummary) => row.teacher.name }] : []),
    { key: 'status', header: 'Situação', width: 120, render: (row) => <StatusChip active={row.active} /> },
    {
      key: 'actions',
      header: 'Ações',
      width: 90,
      render: (row) => (
        <Tooltip title={`Editar ${row.name}`}>
          <IconButton aria-label={`Editar ${row.name}`} onClick={() => setEditing(row)}>
            <EditIcon />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  const filtered = Boolean(search || status);

  return (
    <>
      <PageHeader
        title="Turmas"
        subtitle="Cada turma tem um código para os alunos entrarem pelo app."
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing('new')}>
            Nova turma
          </Button>
        }
      />

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
        <SearchField label="Buscar por nome" value={filters.search} onChange={(value) => setFilter('search', value)} />
        <TextField
          select
          size="small"
          label="Situação"
          value={status}
          onChange={(event) => setFilter('status', event.target.value)}
          slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}
          sx={{ minWidth: 160 }}
        >
          {statusOptions.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
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
        onRowClick={(row) => void navigate(`/turmas/${row.id}`)}
        emptyTitle={filtered ? 'Nenhuma turma encontrada.' : 'Nenhuma turma ainda.'}
        emptyDescription={
          filtered ? 'Tente outra busca ou limpe os filtros.' : 'Crie a primeira turma para receber alunos.'
        }
      />

      {editing ? (
        <ClassroomFormDialog
          classroom={editing === 'new' ? undefined : editing}
          isAdmin={isAdmin}
          onClose={() => setEditing(null)}
          onSaved={(saved, created) => {
            setEditing(null);
            if (created) {
              notify.success('Turma criada.');
              void navigate(`/turmas/${saved.id}`);
            } else {
              notify.success('Turma atualizada.');
              void reload();
            }
          }}
        />
      ) : null}
    </>
  );
}
