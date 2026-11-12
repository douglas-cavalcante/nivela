import { Box, Tab, Tabs } from '@mui/material';
import { useSearchParams } from 'react-router';
import { PageHeader } from 'src/components/PageHeader';
import { RedemptionsQueue } from 'src/features/rewards/components/RedemptionsQueue';
import { RewardsCatalog } from 'src/features/rewards/components/RewardsCatalog';

type TabValue = 'premios' | 'resgates';

const TABS: Array<{ value: TabValue; label: string }> = [
  { value: 'premios', label: 'Prêmios' },
  { value: 'resgates', label: 'Resgates' },
];

/** Loja de prêmios da equipe: catálogo e fila de resgates, em abas na URL (`?tab=premios|resgates`). */
export function RewardsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: TabValue = searchParams.get('tab') === 'resgates' ? 'resgates' : 'premios';

  function changeTab(next: TabValue) {
    // cada aba tem os seus filtros: trocar de aba começa limpo
    setSearchParams(next === 'premios' ? {} : { tab: next });
  }

  return (
    <>
      <PageHeader
        title="Loja de prêmios"
        subtitle="Cadastre os prêmios que os alunos trocam por moedas e acompanhe os resgates."
      />

      <Tabs
        value={tab}
        onChange={(_event, value: TabValue) => changeTab(value)}
        aria-label="Seções da loja"
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
      >
        {TABS.map((item) => (
          <Tab
            key={item.value}
            value={item.value}
            label={item.label}
            id={`store-tab-${item.value}`}
            aria-controls={`store-panel-${item.value}`}
          />
        ))}
      </Tabs>

      <Box role="tabpanel" id={`store-panel-${tab}`} aria-labelledby={`store-tab-${tab}`}>
        {tab === 'premios' ? <RewardsCatalog /> : <RedemptionsQueue />}
      </Box>
    </>
  );
}
