import { Box, Button, Chip, CircularProgress, Typography } from '@mui/material';
import type { ApiStudent } from '@nivela/api-contract';
import { penShadow } from '@nivela/design-tokens';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { ResourceState } from 'src/components/ResourceState';
import { PageHeader } from 'src/components/PageHeader';
import { StatusChip } from 'src/components/StatusChip';
import { CategoryPerformanceChart, CoinStatement } from 'src/features/dashboard';
import { StudentPlans } from 'src/features/leveling-plans';
import { getStudentAction } from 'src/features/students/api/students.action';
import { useRemoteList } from 'src/hooks/useRemoteList';
import { useNivelaColors } from 'src/lib/theme/useNivelaColors';
import { formatDate } from 'src/utils/format';
import { validId } from 'src/utils/ids';

const BACK = { to: '/alunos', label: 'Voltar' };

const days = (count: number) => `${count} ${count === 1 ? 'dia' : 'dias'}`;

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box>
      <Typography variant="overline" color="text.secondary" component="p" sx={{ lineHeight: 1.4 }}>
        {label}
      </Typography>
      <Typography component="div" sx={{ fontWeight: 700 }}>
        {children}
      </Typography>
    </Box>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  const colors = useNivelaColors();
  return (
    <Box
      component="section"
      aria-label={title}
      sx={{
        p: 3,
        border: `${penShadow.width}px solid ${colors.border}`,
        borderRadius: 2,
        boxShadow: `${penShadow.offset}px ${penShadow.offset}px 0 ${colors.shadow}`,
        backgroundColor: 'background.paper',
      }}
    >
      <Typography variant="h4" component="h2" sx={{ mb: 2 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

function StudentView({ student }: { student: ApiStudent }) {
  return (
    <>
      <Button component={Link} to="/alunos" color="inherit" sx={{ mb: 1, ml: -1 }}>
        ← Alunos
      </Button>
      <PageHeader title={student.name} subtitle={student.email} />

      <Box sx={{ display: 'grid', gap: 3 }}>
        <Card title="Dados">
          <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' } }}>
            <Fact label="Situação">
              <StatusChip active={student.active} />
            </Fact>
            <Fact label="Cadastro">{formatDate(student.created_at)}</Fact>
            <Fact label="Moedas">{student.coins_balance}</Fact>
            <Fact label="Sequência atual">{days(student.current_streak)}</Fact>
            <Fact label="Melhor sequência">{days(student.best_streak)}</Fact>
          </Box>
        </Card>

        <Card title="Turmas">
          {student.classrooms.length === 0 ? (
            <Typography color="text.secondary">Este aluno ainda não está em nenhuma turma.</Typography>
          ) : (
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {student.classrooms.map((classroom) => (
                <Chip
                  key={classroom.id}
                  label={classroom.name}
                  component={Link}
                  to={`/turmas/${classroom.id}`}
                  clickable
                  variant="outlined"
                />
              ))}
            </Box>
          )}
        </Card>

        <Card title="Desempenho">
          <CategoryPerformanceChart scope="student" id={student.id} />
        </Card>
        <Card title="Planos de estudo">
          <StudentPlans studentId={student.id} />
        </Card>
        <Card title="Extrato de moedas">
          <CoinStatement studentId={student.id} />
        </Card>
      </Box>
    </>
  );
}

function StudentLoader({ id }: { id: number }) {
  const { rows, loading, error, errorStatus, reload } = useRemoteList<ApiStudent>(
    async (signal) => [await getStudentAction(id, signal)],
    String(id),
  );
  if (error) {
    return (
      <ResourceState
        kind={errorStatus === 404 ? 'not-found' : 'error'}
        message={error}
        onRetry={() => void reload()}
        backTo={BACK}
      />
    );
  }
  if (loading || !rows[0]) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress aria-label="Carregando" />
      </Box>
    );
  }
  return <StudentView student={rows[0]} />;
}

/** Ficha do aluno: dados, turmas, moedas e sequência; desempenho por categoria; planos de estudo; extrato de moedas. */
export function StudentDetail() {
  const { id } = useParams();
  if (!validId(id)) return <ResourceState kind="not-found" message="Aluno não encontrado." backTo={BACK} />;
  return <StudentLoader key={id} id={Number(id)} />;
}
