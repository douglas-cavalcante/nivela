import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import { Box, Button, IconButton, Tooltip, Typography } from '@mui/material';
import { parseApiError } from '@nivela/api-contract';
import type { ApiPlanAssignment } from '@nivela/api-contract';
import { useState } from 'react';
import { ConfirmDialog } from 'src/components/ConfirmDialog';
import { DataTable } from 'src/components/DataTable';
import type { DataTableColumn } from 'src/components/DataTable';
import { deleteAssignmentAction, listAssignmentsAction } from 'src/features/leveling-plans/api/plans.action';
import { AssignDialog } from 'src/features/leveling-plans/components/AssignDialog';
import { useRemoteList } from 'src/hooks/useRemoteList';
import { useNotify } from 'src/lib/notify/useNotify';
import { formatDate, formatDay } from 'src/utils/format';

interface AssignmentsPanelProps {
  planId: number;
  /** Só plano publicado pode ser atribuído. */
  published: boolean;
}

/** Atribuições do plano (turmas e alunos), com prazo, e o botão de atribuir. */
export function AssignmentsPanel({ planId, published }: AssignmentsPanelProps) {
  const notify = useNotify();
  const { rows, loading, error, reload } = useRemoteList((signal) => listAssignmentsAction(planId, signal), String(planId));
  const [assigning, setAssigning] = useState(false);
  const [removing, setRemoving] = useState<ApiPlanAssignment | null>(null);
  // mantém a última atribuição no texto do diálogo durante a animação de saída
  const [lastRemoving, setLastRemoving] = useState<ApiPlanAssignment | null>(null);
  const [saving, setSaving] = useState(false);

  async function confirmRemove() {
    if (!removing) return;
    setSaving(true);
    try {
      await deleteAssignmentAction(planId, removing.id);
      notify.success('Atribuição removida.');
      await reload();
    } catch (err) {
      notify.error(parseApiError(err).message);
    } finally {
      setSaving(false);
      setRemoving(null);
    }
  }

  const columns: Array<DataTableColumn<ApiPlanAssignment>> = [
    { key: 'target', header: 'Atribuído a', render: (row) => row.target.name },
    { key: 'type', header: 'Tipo', width: 120, render: (row) => (row.target.type === 'classroom' ? 'Turma' : 'Aluno') },
    { key: 'due', header: 'Prazo', width: 140, render: (row) => (row.due_date ? formatDay(row.due_date) : 'Sem prazo') },
    { key: 'created', header: 'Atribuído em', width: 150, render: (row) => formatDate(row.created_at) },
    {
      key: 'actions',
      header: 'Ações',
      width: 90,
      render: (row) => (
        <Tooltip title="Remover atribuição">
          <IconButton
            aria-label={`Remover atribuição de ${row.target.name}`}
            onClick={() => {
              setLastRemoving(row);
              setRemoving(row);
            }}
          >
            <DeleteIcon />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mb: 2 }}>
        <Typography color="text.secondary">
          {published ? 'Quem recebe este plano e até quando.' : 'Publique o plano para atribuir.'}
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} disabled={!published} onClick={() => setAssigning(true)}>
          Atribuir
        </Button>
      </Box>

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        loading={loading}
        error={error}
        onRetry={() => void reload()}
        emptyTitle="Nenhuma atribuição ainda."
        emptyDescription="Atribua o plano a uma turma ou a um aluno para ele aparecer no app."
      />

      {assigning ? (
        <AssignDialog
          planId={planId}
          onClose={() => setAssigning(false)}
          onSaved={() => {
            notify.success('Plano atribuído.');
            setAssigning(false);
            void reload();
          }}
        />
      ) : null}

      <ConfirmDialog
        open={removing !== null}
        title="Remover a atribuição?"
        description={`${lastRemoving?.target.name ?? ''} deixa de receber este plano.`}
        confirmLabel="Remover atribuição"
        tone="danger"
        loading={saving}
        onConfirm={() => void confirmRemove()}
        onClose={() => setRemoving(null)}
      />
    </>
  );
}
