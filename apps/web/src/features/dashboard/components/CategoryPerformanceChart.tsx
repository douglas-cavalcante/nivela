import { Box, CircularProgress, Typography } from '@mui/material';
import { subjectColors } from '@nivela/design-tokens';
import { ResourceState } from 'src/components/ResourceState';
import {
  listClassroomPerformanceAction,
  listStudentPerformanceAction,
} from 'src/features/dashboard/api/dashboard.action';
import { EmptyState } from 'src/components/EmptyState';
import { useRemoteList } from 'src/hooks/useRemoteList';
import { useColorMode } from 'src/lib/theme/ColorModeProvider';
import { useNivelaColors } from 'src/lib/theme/useNivelaColors';

interface CategoryPerformanceChartProps {
  /** De quem é o desempenho: de uma turma ou de um aluno (todo o histórico). */
  scope: 'classroom' | 'student';
  id: number;
}

/** Barras horizontais de acerto por categoria, na cor da disciplina; a taxa conta questões terminadas, não tentativas. */
export function CategoryPerformanceChart({ scope, id }: CategoryPerformanceChartProps) {
  const colors = useNivelaColors();
  const { mode } = useColorMode();
  const { rows, loading, error, reload } = useRemoteList(
    (signal) =>
      scope === 'classroom' ? listClassroomPerformanceAction(id, signal) : listStudentPerformanceAction(id, signal),
    `${scope}-${id}`,
  );

  if (error) return <ResourceState kind="error" message={error} onRetry={() => void reload()} />;
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
        <CircularProgress size={28} aria-label="Carregando" />
      </Box>
    );
  }
  if (rows.length === 0) return <EmptyState title="Ainda não há questões terminadas." />;

  return (
    <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 2 }}>
      {rows.map((row) => {
        const color = subjectColors[mode][row.subject.color];
        return (
          <Box component="li" key={row.category.id} sx={{ display: 'grid', gap: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
                <Typography component="span" sx={{ fontWeight: 700 }}>
                  {row.category.name}
                </Typography>
                <Typography component="span" variant="body2" color="text.secondary">
                  {row.subject.name}
                </Typography>
              </Box>
              <Typography component="span">
                {row.accuracy === null ? 'Sem questões terminadas.' : `${row.accuracy}% (${row.correct} de ${row.finished}).`}
              </Typography>
            </Box>
            {row.accuracy === null ? null : (
              <Box
                role="progressbar"
                aria-label={`Acerto em ${row.category.name}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={row.accuracy}
                sx={{ height: 12, borderRadius: 1, backgroundColor: color.background, border: `1px solid ${colors.rule}`, overflow: 'hidden' }}
              >
                <Box sx={{ width: `${row.accuracy}%`, height: '100%', backgroundColor: color.foreground }} />
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
