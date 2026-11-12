import { Box, Button, CircularProgress, Typography } from '@mui/material';
import { Link } from 'react-router';
import { listStudentPlansAction } from 'src/features/leveling-plans/api/plans.action';
import { ChapterProgressBar } from 'src/features/leveling-plans/components/ChapterProgressBar';
import { SubjectBadge } from 'src/features/subjects';
import { useRemoteList } from 'src/hooks/useRemoteList';
import { useNivelaColors } from 'src/lib/theme/useNivelaColors';
import { formatDate, formatDay } from 'src/utils/format';

/** Planos de um aluno (ficha do aluno): título, disciplina, capítulos concluídos, prazo e conclusão. */
export function StudentPlans({ studentId }: { studentId: number }) {
  const colors = useNivelaColors();
  const { rows, loading, error, reload } = useRemoteList(
    (signal) => listStudentPlansAction(studentId, signal),
    String(studentId),
  );

  if (error) {
    return (
      <Box>
        <Typography color="text.secondary" sx={{ mb: 1 }}>
          {error}
        </Typography>
        <Button variant="outlined" onClick={() => void reload()}>
          Tentar de novo
        </Button>
      </Box>
    );
  }
  if (loading && rows.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
        <CircularProgress size={28} aria-label="Carregando" />
      </Box>
    );
  }
  if (rows.length === 0) {
    return <Typography color="text.secondary">Este aluno ainda não tem planos atribuídos.</Typography>;
  }

  return (
    <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid' }}>
      {rows.map((row) => (
        <Box
          component="li"
          key={row.plan.id}
          sx={{
            display: 'grid',
            gap: 1,
            py: 1.5,
            borderTop: `1px solid ${colors.rule}`,
            '&:first-of-type': { borderTop: 0, pt: 0 },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <Typography component={Link} to={`/planos/${row.plan.id}`} sx={{ color: 'inherit', fontWeight: 700 }}>
              {row.plan.title}
            </Typography>
            <SubjectBadge subject={row.plan.subject} />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, maxWidth: 420 }}>
            <ChapterProgressBar
              completed={row.completed_chapters}
              total={row.total_chapters}
              label={`Capítulos concluídos de ${row.plan.title}`}
            />
            <Typography component="span" sx={{ whiteSpace: 'nowrap' }}>
              {row.completed_chapters} de {row.total_chapters} capítulos
            </Typography>
          </Box>
          {row.due_date || row.completed_at ? (
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              {row.due_date ? (
                <Typography variant="body2" color="text.secondary">
                  Prazo: {formatDay(row.due_date)}.
                </Typography>
              ) : null}
              {row.completed_at ? (
                <Typography variant="body2" color="text.secondary">
                  Concluído em {formatDate(row.completed_at)}.
                </Typography>
              ) : null}
            </Box>
          ) : null}
        </Box>
      ))}
    </Box>
  );
}
