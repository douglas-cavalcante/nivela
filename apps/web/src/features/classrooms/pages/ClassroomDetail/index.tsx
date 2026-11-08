import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/EditOutlined';
import PersonRemoveIcon from '@mui/icons-material/PersonRemoveOutlined';
import { Box, Button, CircularProgress, IconButton, Tooltip, Typography } from '@mui/material';
import { parseApiError } from '@nivela/api-contract';
import type { ApiClassroom, ApiClassroomStudent } from '@nivela/api-contract';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { ConfirmDialog } from 'src/components/ConfirmDialog';
import { DataTable } from 'src/components/DataTable';
import type { DataTableColumn } from 'src/components/DataTable';
import { EmptyState } from 'src/components/EmptyState';
import { PageHeader } from 'src/components/PageHeader';
import { StatusChip } from 'src/components/StatusChip';
import {
  getClassroomAction,
  regenerateJoinCodeAction,
  removeClassroomStudentAction,
} from 'src/features/classrooms/api/classrooms.action';
import { AddStudentDialog } from 'src/features/classrooms/components/AddStudentDialog';
import { ClassroomFormDialog } from 'src/features/classrooms/components/ClassroomFormDialog';
import { JoinCodeCard } from 'src/features/classrooms/components/JoinCodeCard';
import { useRemoteList } from 'src/hooks/useRemoteList';
import { useAuth } from 'src/lib/auth/AuthContext';
import { useNotify } from 'src/lib/notify/useNotify';
import { formatDate } from 'src/utils/format';
import { validId } from 'src/utils/ids';

function NotFound({ message }: { message: string }) {
  return (
    <EmptyState
      title="Não deu para carregar"
      description={message}
      action={
        <Button variant="contained" component={Link} to="/turmas">
          Voltar
        </Button>
      }
    />
  );
}

interface ClassroomViewProps {
  classroom: ApiClassroom;
  reload: () => Promise<void>;
}

function ClassroomView({ classroom, reload }: ClassroomViewProps) {
  const notify = useNotify();
  const isAdmin = useAuth().user?.role === 'admin';
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<ApiClassroomStudent | null>(null);
  // mantém o último aluno no texto do diálogo durante a animação de saída
  const [lastRemoving, setLastRemoving] = useState<ApiClassroomStudent | null>(null);
  const [saving, setSaving] = useState(false);

  async function regenerate() {
    await regenerateJoinCodeAction(classroom.id);
    await reload();
  }

  async function confirmRemove() {
    if (!removing) return;
    setSaving(true);
    try {
      await removeClassroomStudentAction(classroom.id, removing.id);
      notify.success('Aluno removido da turma.');
      setRemoving(null);
      await reload();
    } catch (error) {
      notify.error(parseApiError(error).message);
      setRemoving(null);
    } finally {
      setSaving(false);
    }
  }

  const columns: Array<DataTableColumn<ApiClassroomStudent>> = [
    {
      key: 'name',
      header: 'Nome',
      render: (row) => (
        <Typography component={Link} to={`/alunos/${row.id}`} sx={{ color: 'inherit', fontWeight: 700 }}>
          {row.name}
        </Typography>
      ),
    },
    { key: 'email', header: 'E-mail', render: (row) => row.email },
    { key: 'joined', header: 'Entrou em', width: 130, render: (row) => formatDate(row.joined_at) },
    { key: 'status', header: 'Situação', width: 120, render: (row) => <StatusChip active={row.active} /> },
    {
      key: 'actions',
      header: 'Ações',
      width: 90,
      render: (row) => (
        <Tooltip title="Remover da turma">
          <IconButton
            aria-label={`Remover ${row.name} da turma`}
            onClick={() => {
              setLastRemoving(row);
              setRemoving(row);
            }}
          >
            <PersonRemoveIcon />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  const details = [
    classroom.school_year ? `Ano letivo ${classroom.school_year}` : null,
    isAdmin ? `Professor: ${classroom.teacher.name}` : null,
    classroom.active ? null : 'Turma inativa',
  ].filter(Boolean);

  return (
    <>
      <Button component={Link} to="/turmas" color="inherit" sx={{ mb: 1, ml: -1 }}>
        ← Turmas
      </Button>
      <PageHeader
        title={classroom.name}
        subtitle={details.length > 0 ? details.join(' · ') : undefined}
        actions={
          <Button variant="outlined" color="inherit" startIcon={<EditIcon />} onClick={() => setEditing(true)}>
            Editar turma
          </Button>
        }
      />

      <Box sx={{ display: 'grid', gap: 3 }}>
        <JoinCodeCard code={classroom.join_code} onRegenerate={regenerate} />

        <EmptyState title="Desempenho da turma — disponível em breve." />

        <Box component="section" aria-labelledby="students-title">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mb: 2 }}>
            <Typography id="students-title" variant="h3" component="h2">
              Alunos ({classroom.students.length})
            </Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAdding(true)}>
              Adicionar aluno
            </Button>
          </Box>
          <DataTable
            columns={columns}
            rows={classroom.students}
            getRowId={(row) => row.id}
            loading={false}
            emptyTitle="Nenhum aluno nesta turma ainda"
            emptyDescription="Adicione um aluno ou passe o código da turma para que ele entre pelo app."
          />
        </Box>
      </Box>

      {editing ? (
        <ClassroomFormDialog
          classroom={classroom}
          isAdmin={isAdmin}
          onClose={() => setEditing(false)}
          onSaved={() => {
            notify.success('Turma atualizada.');
            setEditing(false);
            void reload();
          }}
        />
      ) : null}

      {adding ? (
        <AddStudentDialog
          classroomId={classroom.id}
          onClose={() => setAdding(false)}
          onSaved={() => {
            notify.success('Aluno adicionado à turma.');
            setAdding(false);
            void reload();
          }}
        />
      ) : null}

      <ConfirmDialog
        open={removing !== null}
        title="Remover da turma?"
        description={`${lastRemoving?.name ?? ''} deixa de ver esta turma, mas a conta dele continua existindo. Ele pode voltar pelo código.`}
        confirmLabel="Remover da turma"
        tone="danger"
        loading={saving}
        onConfirm={() => void confirmRemove()}
        onClose={() => setRemoving(null)}
      />
    </>
  );
}

function ClassroomLoader({ id }: { id: number }) {
  const { rows, loading, error, reload } = useRemoteList<ApiClassroom>(
    async (signal) => [await getClassroomAction(id, signal)],
    String(id),
  );
  if (error) return <NotFound message={error} />;
  if (loading && !rows[0]) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress aria-label="Carregando" />
      </Box>
    );
  }
  if (!rows[0]) return null;
  return <ClassroomView classroom={rows[0]} reload={reload} />;
}

/** Ficha da turma: código de entrada, alunos matriculados e (em breve) desempenho. */
export function ClassroomDetail() {
  const { id } = useParams();
  if (!validId(id)) return <NotFound message="Turma não encontrada." />;
  return <ClassroomLoader key={id} id={Number(id)} />;
}
