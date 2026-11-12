import { Box, Button, MenuItem, TextField, Typography } from '@mui/material';
import { parseApiError } from '@nivela/api-contract';
import type { ApiClassroomSummary, ApiRedemption, RedemptionStatus } from '@nivela/api-contract';
import { useEffect, useState } from 'react';
import { AsyncAutocomplete } from 'src/components/AsyncAutocomplete';
import { ConfirmDialog } from 'src/components/ConfirmDialog';
import { DataTable } from 'src/components/DataTable';
import type { DataTableColumn } from 'src/components/DataTable';
import { SearchField } from 'src/components/SearchField';
import { getClassroomAction, listClassroomsAction } from 'src/features/classrooms';
import { deliverRedemptionAction, listRedemptionsAction } from 'src/features/rewards/api/rewards.action';
import { RedemptionStatusChip } from 'src/features/rewards/components/RedemptionStatusChip';
import { RejectDialog } from 'src/features/rewards/components/RejectDialog';
import { useListQuery } from 'src/hooks/useListQuery';
import { usePaginatedList } from 'src/hooks/usePaginatedList';
import { useNotify } from 'src/lib/notify/useNotify';
import { formatDateTime } from 'src/utils/format';
import { validId } from 'src/utils/ids';

type ClassroomOption = Pick<ApiClassroomSummary, 'id' | 'name'>;

const STATUSES: Array<{ value: RedemptionStatus; label: string }> = [
  { value: 'pending', label: 'Pendentes' },
  { value: 'delivered', label: 'Entregues' },
  { value: 'rejected', label: 'Recusados' },
];

const PER_PAGE = 20;

/** Aba "Resgates": fila da equipe (pendentes por padrão) com entrega e recusa. */
export function RedemptionsQueue() {
  const notify = useNotify();
  const [delivering, setDelivering] = useState<ApiRedemption | null>(null);
  // mantém o último resgate no texto do diálogo durante a animação de saída
  const [lastDelivering, setLastDelivering] = useState<ApiRedemption | null>(null);
  const [rejecting, setRejecting] = useState<ApiRedemption | null>(null);
  const [saving, setSaving] = useState(false);
  const [classroom, setClassroom] = useState<ClassroomOption | null>(null);
  const { page, filters, setPage, setFilters } = useListQuery({ search: '', status: 'pending', classroom_id: '' });
  const search = filters.search.trim();
  const status = STATUSES.find((item) => item.value === filters.status)?.value ?? 'pending';
  const classroomId = validId(filters.classroom_id);

  // a turma vem da URL (link compartilhado, recarregar a página): busca o nome para mostrar no campo
  useEffect(() => {
    if (!classroomId || classroom?.id === Number(classroomId)) return;
    let stale = false;
    getClassroomAction(Number(classroomId))
      .then((found) => {
        if (!stale) setClassroom({ id: found.id, name: found.name });
      })
      .catch(() => undefined);
    return () => {
      stale = true;
    };
  }, [classroomId, classroom]);

  const { rows, meta, loading, error, reload } = usePaginatedList(
    (signal) =>
      listRedemptionsAction(
        {
          page: page > 1 ? page : undefined,
          status,
          search: search || undefined,
          classroom_id: classroomId ? Number(classroomId) : undefined,
        },
        signal,
      ),
    JSON.stringify([page, status, search, classroomId]),
  );

  async function deliver(redemption: ApiRedemption) {
    setSaving(true);
    try {
      await deliverRedemptionAction(redemption.id);
      notify.success('Prêmio entregue.');
    } catch (err) {
      // inclui o 409 "Este resgate já foi finalizado.": avisa e mostra a fila como está agora
      notify.error(parseApiError(err).message);
    } finally {
      setSaving(false);
      setDelivering(null);
      void reload();
    }
  }

  const columns: Array<DataTableColumn<ApiRedemption>> = [
    {
      key: 'student',
      header: 'Aluno',
      render: (row) => (
        <Box>
          <Typography sx={{ fontWeight: 700 }}>{row.student.name}</Typography>
          <Typography variant="body2" color="text.secondary">
            {row.student.classrooms.map((item) => item.name).join(', ')}
          </Typography>
        </Box>
      ),
    },
    { key: 'reward', header: 'Prêmio', render: (row) => row.reward.name },
    { key: 'price', header: 'Moedas', width: 100, render: (row) => row.price_paid },
    { key: 'created', header: 'Pedido em', width: 160, render: (row) => formatDateTime(row.created_at) },
    {
      key: 'status',
      header: 'Situação',
      width: 200,
      render: (row) => (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.5 }}>
          <RedemptionStatusChip status={row.status} />
          {row.status === 'rejected' && row.rejection_reason ? (
            <Typography variant="body2" color="text.secondary">
              {row.rejection_reason}
            </Typography>
          ) : null}
        </Box>
      ),
    },
    {
      key: 'actions',
      header: 'Ações',
      width: 210,
      render: (row) =>
        row.status === 'pending' ? (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size="small"
              variant="contained"
              aria-label={`Entregar o resgate de ${row.student.name}`}
              disabled={saving}
              onClick={() => {
                setLastDelivering(row);
                setDelivering(row);
              }}
            >
              Entregar
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="error"
              aria-label={`Recusar o resgate de ${row.student.name}`}
              disabled={saving}
              onClick={() => setRejecting(row)}
            >
              Recusar
            </Button>
          </Box>
        ) : null,
    },
  ];

  const selectedClassroom = classroomId && classroom?.id === Number(classroomId) ? classroom : null;
  const filtered = Boolean(search || classroomId);
  const plainQueue = status === 'pending' && !filtered;

  return (
    <Box component="section" aria-label="Fila de resgates">
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
        <SearchField label="Buscar aluno" value={filters.search} onChange={(value) => setFilters({ search: value })} />
        <TextField
          select
          size="small"
          label="Situação"
          value={status}
          onChange={(event) => setFilters({ status: event.target.value })}
          sx={{ minWidth: 150 }}
        >
          {STATUSES.map((item) => (
            <MenuItem key={item.value} value={item.value}>
              {item.label}
            </MenuItem>
          ))}
        </TextField>
        <Box sx={{ minWidth: 220 }}>
          <AsyncAutocomplete<ClassroomOption>
            label="Turma"
            size="small"
            value={selectedClassroom}
            onChange={(next) => {
              setClassroom(next);
              setFilters({ classroom_id: next ? String(next.id) : '' });
            }}
            load={async (text, signal) =>
              (await listClassroomsAction({ search: text || undefined, per_page: PER_PAGE }, signal)).data
            }
            getOptionLabel={(option) => option.name}
            getOptionKey={(option) => option.id}
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
        emptyTitle={plainQueue ? 'Nenhum resgate pendente.' : 'Nenhum resgate encontrado.'}
        emptyDescription={
          plainQueue ? 'Quando um aluno resgatar um prêmio, o pedido aparece aqui.' : 'Tente outra busca ou limpe os filtros.'
        }
      />

      <ConfirmDialog
        open={delivering !== null}
        title="Entregar o prêmio?"
        description={
          lastDelivering ? `Confirme que ${lastDelivering.student.name} recebeu ${lastDelivering.reward.name}.` : ''
        }
        confirmLabel="Entregar"
        loading={saving}
        onConfirm={() => {
          if (delivering) void deliver(delivering);
        }}
        onClose={() => setDelivering(null)}
      />

      {rejecting ? (
        <RejectDialog
          redemption={rejecting}
          onClose={() => setRejecting(null)}
          onRejected={() => {
            notify.success('Resgate recusado.');
            setRejecting(null);
            void reload();
          }}
          onFailed={(message) => {
            notify.error(message);
            setRejecting(null);
            void reload();
          }}
        />
      ) : null}
    </Box>
  );
}
