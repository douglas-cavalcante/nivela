import AddIcon from '@mui/icons-material/Add';
import BlockIcon from '@mui/icons-material/BlockOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircleOutlined';
import EditIcon from '@mui/icons-material/EditOutlined';
import LockResetIcon from '@mui/icons-material/LockResetOutlined';
import { Box, Button, IconButton, MenuItem, TextField, Tooltip } from '@mui/material';
import { parseApiError } from '@nivela/api-contract';
import type { ApiTeacher } from '@nivela/api-contract';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ConfirmDialog } from 'src/components/ConfirmDialog';
import { DataTable } from 'src/components/DataTable';
import type { DataTableColumn } from 'src/components/DataTable';
import { PageHeader } from 'src/components/PageHeader';
import { SearchField } from 'src/components/SearchField';
import { StatusChip } from 'src/components/StatusChip';
import { listTeachersAction, setTeacherStatusAction } from 'src/features/teachers/api/teachers.action';
import { TeacherFormDialog } from 'src/features/teachers/components/TeacherFormDialog';
import { TeacherPasswordDialog } from 'src/features/teachers/components/TeacherPasswordDialog';
import { useListQuery } from 'src/hooks/useListQuery';
import { usePaginatedList } from 'src/hooks/usePaginatedList';
import { useNotify } from 'src/lib/notify/useNotify';

type StatusFilter = '' | 'active' | 'inactive';

const statusOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: '', label: 'Todos' },
  { value: 'active', label: 'Ativos' },
  { value: 'inactive', label: 'Inativos' },
];

interface RowActionProps {
  label: string;
  onClick: () => void;
  children: ReactNode;
}

function RowAction({ label, onClick, children }: RowActionProps) {
  return (
    <Tooltip title={label}>
      <IconButton aria-label={label} onClick={onClick}>
        {children}
      </IconButton>
    </Tooltip>
  );
}

/** Professores (só admin): tabela paginada com busca e situação na URL (`?search=ana&status=inactive&page=2`). */
export function TeacherList() {
  const notify = useNotify();
  const { page, filters, setPage, setFilter } = useListQuery({ search: '', status: '' });
  const search = filters.search.trim();
  // `?status=xyz` na URL é ignorado: só valores conhecidos vão para a API
  const status: StatusFilter = filters.status === 'active' || filters.status === 'inactive' ? filters.status : '';
  const { rows, meta, loading, error, reload } = usePaginatedList(
    (signal) =>
      listTeachersAction(
        { page: page > 1 ? page : undefined, search: search || undefined, status: status || undefined },
        signal,
      ),
    JSON.stringify([page, search, status]),
  );

  const [editing, setEditing] = useState<ApiTeacher | 'new' | null>(null);
  const [resetting, setResetting] = useState<ApiTeacher | null>(null);
  const [toggling, setToggling] = useState<ApiTeacher | null>(null);
  // mantém o último professor no texto do diálogo durante a animação de saída
  const [lastToggling, setLastToggling] = useState<ApiTeacher | null>(null);
  const [saving, setSaving] = useState(false);
  const askToggle = (teacher: ApiTeacher) => {
    setLastToggling(teacher);
    setToggling(teacher);
  };

  async function confirmToggle() {
    if (!toggling) return;
    const activate = !toggling.active;
    setSaving(true);
    try {
      await setTeacherStatusAction(toggling.id, activate);
      notify.success(activate ? 'Professor ativado.' : 'Professor desativado.');
      setToggling(null);
      await reload();
    } catch (err) {
      notify.error(parseApiError(err).message);
      setToggling(null);
    } finally {
      setSaving(false);
    }
  }

  const columns: Array<DataTableColumn<ApiTeacher>> = [
    { key: 'name', header: 'Nome', render: (row) => row.name },
    { key: 'email', header: 'E-mail', render: (row) => row.email },
    { key: 'classrooms', header: 'Turmas', width: 100, render: (row) => row.classrooms_count },
    { key: 'status', header: 'Situação', width: 130, render: (row) => <StatusChip active={row.active} /> },
    {
      key: 'actions',
      header: 'Ações',
      width: 160,
      render: (row) => (
        <Box sx={{ display: 'flex' }}>
          <RowAction label={`Editar ${row.name}`} onClick={() => setEditing(row)}>
            <EditIcon />
          </RowAction>
          <RowAction label={`Redefinir senha de ${row.name}`} onClick={() => setResetting(row)}>
            <LockResetIcon />
          </RowAction>
          <RowAction label={`${row.active ? 'Desativar' : 'Ativar'} ${row.name}`} onClick={() => askToggle(row)}>
            {row.active ? <BlockIcon /> : <CheckCircleIcon />}
          </RowAction>
        </Box>
      ),
    },
  ];

  const activating = lastToggling ? !lastToggling.active : false;
  const filtered = Boolean(search || status);

  return (
    <>
      <PageHeader
        title="Professores"
        subtitle="Quem dá aula na Nivela: cadastre, troque a senha e ative ou desative o acesso."
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing('new')}>
            Novo professor
          </Button>
        }
      />

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
        <SearchField
          label="Buscar por nome ou e-mail"
          value={filters.search}
          onChange={(value) => setFilter('search', value)}
        />
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
        emptyTitle={filtered ? 'Nenhum professor encontrado.' : 'Nenhum professor ainda.'}
        emptyDescription={
          filtered ? 'Tente outra busca ou limpe os filtros.' : 'Cadastre o primeiro professor para começar.'
        }
      />

      {editing ? (
        <TeacherFormDialog
          teacher={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            notify.success(message);
            setEditing(null);
            void reload();
          }}
        />
      ) : null}

      {resetting ? (
        <TeacherPasswordDialog
          teacher={resetting}
          onClose={() => setResetting(null)}
          onSaved={(message) => {
            notify.success(message);
            setResetting(null);
          }}
        />
      ) : null}

      <ConfirmDialog
        open={toggling !== null}
        title={activating ? 'Ativar professor?' : 'Desativar professor?'}
        description={
          activating
            ? `${lastToggling?.name ?? ''} poderá entrar de novo no sistema.`
            : `${lastToggling?.name ?? ''} não poderá mais entrar e as sessões abertas serão encerradas na hora. Você pode ativar o acesso de novo depois.`
        }
        confirmLabel={activating ? 'Ativar' : 'Desativar'}
        tone={activating ? 'primary' : 'danger'}
        loading={saving}
        onConfirm={() => void confirmToggle()}
        onClose={() => setToggling(null)}
      />
    </>
  );
}
