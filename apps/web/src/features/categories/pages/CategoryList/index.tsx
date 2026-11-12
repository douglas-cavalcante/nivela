import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import EditIcon from '@mui/icons-material/EditOutlined';
import { Alert, Box, Button, IconButton, MenuItem, TextField } from '@mui/material';
import { parseApiError } from '@nivela/api-contract';
import type { ApiCategory } from '@nivela/api-contract';
import { useState } from 'react';
import { ConfirmDialog } from 'src/components/ConfirmDialog';
import { DataTable } from 'src/components/DataTable';
import type { DataTableColumn } from 'src/components/DataTable';
import { PageHeader } from 'src/components/PageHeader';
import { deleteCategoryAction, listCategoriesAction } from 'src/features/categories/api/categories.action';
import { CategoryFormDialog } from 'src/features/categories/components/CategoryFormDialog';
import { listSubjectsAction, SubjectBadge } from 'src/features/subjects';
import { useListQuery } from 'src/hooks/useListQuery';
import { useRemoteList } from 'src/hooks/useRemoteList';
import { useNotify } from 'src/lib/notify/useNotify';

/** Categorias: tabela com filtro por disciplina (na URL: `?subject_id=3`). */
export function CategoryList() {
  const notify = useNotify();
  const { filters, setFilter } = useListQuery({ subject_id: '' });
  // `?subject_id=abc` na URL é ignorado: só ids numéricos vão para a API
  const subjectId = /^\d+$/.test(filters.subject_id) ? filters.subject_id : '';
  const { rows, loading, error, reload } = useRemoteList((signal) => listCategoriesAction(subjectId, signal), subjectId);
  const subjects = useRemoteList(listSubjectsAction);
  const [editing, setEditing] = useState<ApiCategory | 'new' | null>(null);
  const [deleting, setDeleting] = useState<ApiCategory | null>(null);
  // mantém o último item no texto do diálogo durante a animação de saída
  const [lastDeleting, setLastDeleting] = useState<ApiCategory | null>(null);
  const askDelete = (row: ApiCategory) => {
    setLastDeleting(row);
    setDeleting(row);
  };
  const [removing, setRemoving] = useState(false);

  async function confirmDelete() {
    if (!deleting) return;
    setRemoving(true);
    try {
      await deleteCategoryAction(deleting.id);
      notify.success('Categoria excluída.');
      setDeleting(null);
      await reload();
    } catch (err) {
      notify.error(parseApiError(err).message);
      setDeleting(null);
    } finally {
      setRemoving(false);
    }
  }

  const columns: Array<DataTableColumn<ApiCategory>> = [
    { key: 'name', header: 'Categoria', render: (row) => row.name },
    { key: 'subject', header: 'Disciplina', render: (row) => <SubjectBadge subject={row.subject} /> },
    { key: 'questions', header: 'Questões', width: 120, render: (row) => row.questions_count },
    {
      key: 'actions',
      header: 'Ações',
      width: 120,
      render: (row) => (
        <Box sx={{ display: 'flex' }}>
          <IconButton aria-label={`Editar ${row.name}`} onClick={() => setEditing(row)}>
            <EditIcon />
          </IconButton>
          <IconButton aria-label={`Excluir ${row.name}`} onClick={() => askDelete(row)}>
            <DeleteIcon />
          </IconButton>
        </Box>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Categorias"
        subtitle="Os assuntos de cada disciplina, para organizar as questões."
        actions={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            disabled={subjects.error !== null || subjects.rows.length === 0}
            onClick={() => setEditing('new')}
          >
            Nova categoria
          </Button>
        }
      />

      {subjects.error ? (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => void subjects.reload()}>
              Tentar de novo
            </Button>
          }
        >
          Não deu para carregar as disciplinas. {subjects.error}
        </Alert>
      ) : null}

      <Box sx={{ mb: 3 }}>
        <TextField
          select
          size="small"
          label="Filtrar por disciplina"
          value={subjectId}
          onChange={(event) => setFilter('subject_id', event.target.value)}
          slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}
          sx={{ minWidth: 240 }}
        >
          <MenuItem value="">Todas</MenuItem>
          {subjects.rows.map((subject) => (
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
        emptyTitle="Nenhuma categoria por aqui."
        emptyDescription={subjectId ? 'Essa disciplina ainda não tem categorias.' : 'Crie a primeira categoria para organizar as questões.'}
      />

      {editing ? (
        <CategoryFormDialog
          category={editing === 'new' ? undefined : editing}
          subjects={subjects.rows}
          defaultSubjectId={subjectId}
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
        title="Excluir categoria?"
        description={`A categoria "${lastDeleting?.name ?? ''}" será excluída. Isso não pode ser desfeito.`}
        confirmLabel="Excluir"
        tone="danger"
        loading={removing}
        onConfirm={() => void confirmDelete()}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
