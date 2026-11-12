import type { ApiDashboardSummary } from '@nivela/api-contract';
import { Box, CircularProgress, Link as MuiLink, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { PageHeader } from 'src/components/PageHeader';
import { ResourceState } from 'src/components/ResourceState';
import {
  getSummaryAction,
  listActivityAction,
  listNeedingHelpAction,
  listRecentQuestionsAction,
} from 'src/features/dashboard/api/dashboard.action';
import { ActivityChart } from 'src/features/dashboard/components/ActivityChart';
import { Panel } from 'src/features/dashboard/components/Panel';
import { StatCard } from 'src/features/dashboard/components/StatCard';
import { SubjectBadge } from 'src/features/subjects';
import { useRemoteList } from 'src/hooks/useRemoteList';
import { useAuth } from 'src/lib/auth/AuthContext';
import { useNivelaColors } from 'src/lib/theme/useNivelaColors';

const ACTIVITY_DAYS = 14;

const spinner = (
  <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
    <CircularProgress size={28} aria-label="Carregando" />
  </Box>
);

function List({ children }: { children: ReactNode }) {
  return (
    <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid' }}>
      {children}
    </Box>
  );
}

function ListItem({ children }: { children: ReactNode }) {
  const colors = useNivelaColors();
  return (
    <Box
      component="li"
      sx={{ py: 1.5, borderTop: `1px solid ${colors.rule}`, '&:first-of-type': { borderTop: 0, pt: 0 } }}
    >
      {children}
    </Box>
  );
}

function Activity() {
  const { rows, loading, error, reload } = useRemoteList((signal) => listActivityAction(ACTIVITY_DAYS, signal));
  return (
    <Panel title={`Atividade dos últimos ${ACTIVITY_DAYS} dias`}>
      {error ? (
        <ResourceState kind="error" message={error} onRetry={() => void reload()} />
      ) : loading ? (
        spinner
      ) : (
        <ActivityChart days={rows} />
      )}
    </Panel>
  );
}

/** `total` vem do indicador do resumo, que conta todos; a lista traz só os primeiros. */
function NeedingHelp({ total }: { total: number | undefined }) {
  const { rows, loading, error, reload } = useRemoteList((signal) => listNeedingHelpAction(signal));
  return (
    <Panel title="Precisam de ajuda" id="precisam-de-ajuda">
      {error ? (
        <ResourceState kind="error" message={error} onRetry={() => void reload()} />
      ) : loading ? (
        spinner
      ) : rows.length === 0 ? (
        <Typography color="text.secondary">Nenhum aluno precisa de ajuda agora.</Typography>
      ) : (
        <List>
          {rows.map((row) => (
            <ListItem key={row.student.id}>
              <Typography component={Link} to={`/alunos/${row.student.id}`} sx={{ color: 'inherit', fontWeight: 700 }}>
                {row.student.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {row.accuracy}% de acerto em {row.finished} questões terminadas.
              </Typography>
            </ListItem>
          ))}
        </List>
      )}
      {!loading && !error && total !== undefined && total > rows.length ? (
        <Typography variant="body2" color="text.secondary">
          Mostrando {rows.length} de {total}.
        </Typography>
      ) : null}
    </Panel>
  );
}

function RecentQuestions() {
  const { rows, loading, error, reload } = useRemoteList((signal) => listRecentQuestionsAction(signal));
  return (
    <Panel title="Questões recentes">
      {error ? (
        <ResourceState kind="error" message={error} onRetry={() => void reload()} />
      ) : loading ? (
        spinner
      ) : rows.length === 0 ? (
        <Typography color="text.secondary">Ainda não há questões cadastradas.</Typography>
      ) : (
        <List>
          {rows.map((row) => (
            <ListItem key={row.id}>
              <Typography component={Link} to={`/questoes/${row.id}`} sx={{ color: 'inherit', fontWeight: 700 }}>
                {row.statement_excerpt}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
                <SubjectBadge subject={row.subject} />
                <Typography variant="body2" color="text.secondary">
                  {row.subject.name} · {row.category.name}
                </Typography>
              </Box>
            </ListItem>
          ))}
        </List>
      )}
    </Panel>
  );
}

interface SummaryProps {
  summary: ApiDashboardSummary | undefined;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void> | void;
}

function Summary({ summary, loading, error, reload }: SummaryProps) {
  if (error) return <ResourceState kind="error" message={error} onRetry={() => void reload()} />;
  if (loading || !summary) return spinner;

  return (
    <>
      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' } }}>
        <StatCard label="Alunos ativos" value={String(summary.active_students)} />
        <StatCard label="Questões ativas" value={String(summary.active_questions)} />
        <StatCard
          label="Taxa de acerto (30 dias)"
          value={summary.accuracy === null ? '—' : `${summary.accuracy}%`}
        />
        <StatCard
          label="Precisam de ajuda"
          value={String(summary.students_needing_help)}
          footer={
            <MuiLink href="#precisam-de-ajuda" color="inherit">
              Ver a lista.
            </MuiLink>
          }
        />
      </Box>
      <Typography>
        Resgates pendentes: {summary.pending_redemptions}.{' '}
        <MuiLink component={Link} to="/loja?tab=resgates" color="inherit">
          Ver a fila de resgates.
        </MuiLink>
      </Typography>
    </>
  );
}

/** Início da equipe: indicadores, atividade dos últimos 14 dias, quem precisa de ajuda e questões recentes. */
export function Home() {
  const { user } = useAuth();
  const firstName = user?.name.split(' ')[0];
  const { rows, loading, error, reload } = useRemoteList((signal) => getSummaryAction(signal).then((data) => [data]));
  const summary = rows[0];

  return (
    <>
      <PageHeader title="Início" subtitle={firstName ? `Olá, ${firstName}! Bom ver você por aqui.` : undefined} />
      <Box sx={{ display: 'grid', gap: 3 }}>
        <Summary summary={summary} loading={loading} error={error} reload={reload} />
        <Activity />
        <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, alignItems: 'start' }}>
          <NeedingHelp total={summary?.students_needing_help} />
          <RecentQuestions />
        </Box>
      </Box>
    </>
  );
}
