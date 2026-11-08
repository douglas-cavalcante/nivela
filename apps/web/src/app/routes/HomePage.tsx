import { PageHeader } from 'src/components/PageHeader';
import { EmptyState } from 'src/components/EmptyState';
import { useAuth } from 'src/lib/auth/AuthContext';

export function HomePage() {
  const { user } = useAuth();
  const firstName = user?.name.split(' ')[0];

  return (
    <>
      <PageHeader title="Início" subtitle={firstName ? `Olá, ${firstName}! Bom ver você por aqui.` : undefined} />
      <EmptyState title="Em breve" description="Os indicadores da sua turma vão aparecer aqui." />
    </>
  );
}
