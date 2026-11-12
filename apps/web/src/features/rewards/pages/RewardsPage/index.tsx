import { PageHeader } from 'src/components/PageHeader';
import { RewardsCatalog } from 'src/features/rewards/components/RewardsCatalog';

/** Loja de prêmios da equipe: por enquanto, o catálogo de prêmios. */
export function RewardsPage() {
  return (
    <>
      <PageHeader
        title="Loja de prêmios"
        subtitle="Cadastre os prêmios que os alunos trocam por moedas."
      />
      <RewardsCatalog />
    </>
  );
}
