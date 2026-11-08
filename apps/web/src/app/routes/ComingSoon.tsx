import { EmptyState } from 'src/components/EmptyState';
import { PageHeader } from 'src/components/PageHeader';

/** Tela de rota cuja feature ainda não foi construída. */
export function ComingSoon({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} />
      <EmptyState title="Em breve" description="Esta página do caderno ainda está em branco. Logo ela estará pronta." />
    </>
  );
}
