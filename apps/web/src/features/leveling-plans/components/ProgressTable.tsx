import { Box, Typography } from '@mui/material';
import type { ApiPlanProgressRow } from '@nivela/api-contract';
import { Link } from 'react-router';
import { DataTable } from 'src/components/DataTable';
import type { DataTableColumn } from 'src/components/DataTable';
import { listPlanProgressAction } from 'src/features/leveling-plans/api/plans.action';
import { ChapterProgressBar } from 'src/features/leveling-plans/components/ChapterProgressBar';
import { useRemoteList } from 'src/hooks/useRemoteList';
import { formatDate } from 'src/utils/format';

const columns: Array<DataTableColumn<ApiPlanProgressRow>> = [
  {
    key: 'student',
    header: 'Aluno',
    render: (row) => (
      <Typography component={Link} to={`/alunos/${row.student.id}`} sx={{ color: 'inherit', fontWeight: 700 }}>
        {row.student.name}
      </Typography>
    ),
  },
  {
    key: 'chapters',
    header: 'Capítulos concluídos',
    width: 240,
    render: (row) => (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <ChapterProgressBar
          completed={row.completed_chapters}
          total={row.total_chapters}
          label={`Capítulos concluídos por ${row.student.name}`}
        />
        <Typography component="span" sx={{ whiteSpace: 'nowrap' }}>
          {row.completed_chapters} de {row.total_chapters}
        </Typography>
      </Box>
    ),
  },
  { key: 'score', header: 'Acertos/respondidas', width: 170, render: (row) => `${row.correct}/${row.answered}` },
  {
    key: 'completed',
    header: 'Conclusão',
    width: 200,
    render: (row) => (row.completed_at ? `Concluído em ${formatDate(row.completed_at)}.` : '—'),
  },
];

/** Progresso dos alunos no plano: capítulos concluídos, acertos e quando terminaram. */
export function ProgressTable({ planId }: { planId: number }) {
  const { rows, loading, error, reload } = useRemoteList((signal) => listPlanProgressAction(planId, signal), String(planId));

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowId={(row) => row.student.id}
      loading={loading}
      error={error}
      onRetry={() => void reload()}
      emptyTitle="Nenhum aluno com este plano ainda."
      emptyDescription="Quando o plano for atribuído e os alunos começarem a estudar, o progresso aparece aqui."
    />
  );
}
