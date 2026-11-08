import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import EditIcon from '@mui/icons-material/EditOutlined';
import { Box, Button, CircularProgress, IconButton, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { penShadow, subjectColors } from '@nivela/design-tokens';
import { parseApiError } from '@nivela/api-contract';
import type { ApiSubject } from '@nivela/api-contract';
import { useState } from 'react';
import { ConfirmDialog } from 'src/components/ConfirmDialog';
import { EmptyState } from 'src/components/EmptyState';
import { PageHeader } from 'src/components/PageHeader';
import { useRemoteList } from 'src/hooks/useRemoteList';
import { deleteSubjectAction, listSubjectsAction } from 'src/features/subjects/api/subjects.action';
import { SubjectFormDialog } from 'src/features/subjects/components/SubjectFormDialog';
import { SubjectIcon } from 'src/features/subjects/components/SubjectIcon';
import { subjectMarker } from 'src/features/subjects/components/subjectStyles';
import { useNotify } from 'src/lib/notify/useNotify';
import { useColorMode } from 'src/lib/theme/ColorModeProvider';
import { useNivelaColors } from 'src/lib/theme/useNivelaColors';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function SubjectCard({
  subject,
  onEdit,
  onDelete,
}: {
  subject: ApiSubject;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { mode } = useColorMode();
  const colors = useNivelaColors();
  const color = subjectColors[mode][subject.color];
  const marker = subjectMarker(mode, subject.color);

  return (
    <Box
      component="article"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        p: 2.5,
        borderRadius: 2,
        backgroundColor: 'background.paper',
        border: `${penShadow.width}px solid ${colors.border}`,
        boxShadow: `${penShadow.offset}px ${penShadow.offset}px 0 ${colors.shadow}`,
        transition: 'transform 140ms ease, box-shadow 140ms ease',
        '&:hover, &:focus-within': {
          transform: 'translate(-2px, -3px)',
          boxShadow: `${penShadow.offset + 2}px ${penShadow.offset + 3}px 0 ${colors.shadow}`,
        },
        '@media (prefers-reduced-motion: reduce)': {
          transition: 'none',
          '&:hover, &:focus-within': { transform: 'none' },
        },
      }}
    >
      <Box
        aria-hidden
        sx={{
          flexShrink: 0,
          display: 'grid',
          placeItems: 'center',
          width: 56,
          height: 56,
          borderRadius: '50%',
          backgroundColor: color.background,
          color: color.foreground,
          border: `${penShadow.width}px solid ${alpha(color.foreground, 0.5)}`,
        }}
      >
        <SubjectIcon icon={subject.icon} fontSize="medium" />
      </Box>

      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography
          variant="h5"
          component="h2"
          sx={{
            display: 'inline',
            overflowWrap: 'anywhere',
            // marca-texto na cor da disciplina atrás do nome
            backgroundImage: `linear-gradient(transparent 50%, ${marker} 50%, ${marker} 92%, transparent 92%)`,
            px: 0.5,
            mx: -0.5,
            boxDecorationBreak: 'clone',
            WebkitBoxDecorationBreak: 'clone',
          }}
        >
          {subject.name}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {plural(subject.categories_count, 'categoria', 'categorias')} ·{' '}
          {plural(subject.questions_count, 'questão', 'questões')}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexShrink: 0 }}>
        <IconButton aria-label={`Editar ${subject.name}`} onClick={onEdit}>
          <EditIcon />
        </IconButton>
        <IconButton aria-label={`Excluir ${subject.name}`} onClick={onDelete}>
          <DeleteIcon />
        </IconButton>
      </Box>
    </Box>
  );
}

/** Disciplinas: grade de cards do caderno com cor, ícone e contagens. */
export function SubjectList() {
  const notify = useNotify();
  const { rows, loading, error, reload } = useRemoteList(listSubjectsAction);
  const [editing, setEditing] = useState<ApiSubject | 'new' | null>(null);
  const [deleting, setDeleting] = useState<ApiSubject | null>(null);
  // mantém o último item no texto do diálogo durante a animação de saída
  const [lastDeleting, setLastDeleting] = useState<ApiSubject | null>(null);
  const askDelete = (subject: ApiSubject) => {
    setLastDeleting(subject);
    setDeleting(subject);
  };
  const [removing, setRemoving] = useState(false);

  async function confirmDelete() {
    if (!deleting) return;
    setRemoving(true);
    try {
      await deleteSubjectAction(deleting.id);
      notify.success('Disciplina excluída.');
      setDeleting(null);
      await reload();
    } catch (err) {
      notify.error(parseApiError(err).message);
      setDeleting(null);
    } finally {
      setRemoving(false);
    }
  }

  let content;
  if (error) {
    content = (
      <EmptyState
        title="Não deu para carregar."
        description={error}
        action={
          <Button variant="contained" onClick={() => void reload()}>
            Tentar de novo
          </Button>
        }
      />
    );
  } else if (loading && rows.length === 0) {
    content = (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress aria-label="Carregando" />
      </Box>
    );
  } else if (rows.length === 0) {
    content = <EmptyState title="Nenhuma disciplina ainda. Que tal começar por Matemática?" />;
  } else {
    content = (
      <Box
        sx={{
          display: 'grid',
          gap: 3,
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', xl: 'repeat(3, 1fr)' },
          opacity: loading ? 0.6 : 1,
        }}
      >
        {rows.map((subject) => (
          <SubjectCard
            key={subject.id}
            subject={subject}
            onEdit={() => setEditing(subject)}
            onDelete={() => askDelete(subject)}
          />
        ))}
      </Box>
    );
  }

  return (
    <>
      <PageHeader
        title="Disciplinas"
        subtitle="As matérias do caderno: cada uma com a sua cor e o seu ícone."
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing('new')}>
            Nova disciplina
          </Button>
        }
      />
      {content}

      {editing ? (
        <SubjectFormDialog
          subject={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            notify.success(message);
            setEditing(null);
            void reload();
          }}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        title="Excluir disciplina?"
        description={`A disciplina "${lastDeleting?.name ?? ''}" será excluída. Isso não pode ser desfeito.`}
        confirmLabel="Excluir"
        tone="danger"
        loading={removing}
        onConfirm={() => void confirmDelete()}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
