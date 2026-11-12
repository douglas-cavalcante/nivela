import { spacing } from '@nivela/design-tokens';
import { useCallback } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { AppText } from 'src/components/AppText';
import { Button } from 'src/components/Button';
import { EmptyState } from 'src/components/EmptyState';
import { PaperBackground } from 'src/components/PaperBackground';
import { listStoreRewardsAction } from 'src/features/store/api/store.action';
import { RewardCard } from 'src/features/store/components/RewardCard';
import { StatsBar, getStatsAction } from 'src/features/study';
import { useReloadOnFocus } from 'src/hooks/useReloadOnFocus';
import { useRemote } from 'src/hooks/useRemote';
import { useTheme } from 'src/lib/theme/useTheme';

/** Aba Loja: a vitrine de prêmios da escola, com o saldo de moedas do aluno no topo. */
export function Store() {
  const { colors } = useTheme();
  const rewards = useRemote('store-rewards', (signal) => listStoreRewardsAction(signal));
  const stats = useRemote('store-stats', (signal) => getStatsAction(signal));
  const reloadRewards = rewards.reload;
  const reloadStats = stats.reload;
  const reload = useCallback(() => {
    reloadRewards();
    reloadStats();
  }, [reloadRewards, reloadStats]);
  useReloadOnFocus(reload);

  const balance = stats.data?.coins_balance ?? null;
  const loadError = rewards.loading ? null : rewards.error;
  const list = rewards.data;

  return (
    <PaperBackground>
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="heading" size={40} accessibilityRole="header">
          Loja
        </AppText>
        <StatsBar latest={balance === null ? null : { coinsBalance: balance }} />
        {loadError ? (
          <View style={styles.gap}>
            <AppText accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: colors.danger }}>
              {loadError}
            </AppText>
            <Button title="Tentar de novo" variant="outline" onPress={reloadRewards} />
          </View>
        ) : list === null ? (
          <ActivityIndicator accessibilityLabel="Carregando prêmios" color={colors.primary} />
        ) : list.length === 0 ? (
          <EmptyState title="A loja está vazia por enquanto." />
        ) : (
          <View style={styles.grid}>
            {list.map((reward) => (
              <View key={reward.id} style={styles.cell}>
                <RewardCard reward={reward} balance={balance} onRedeem={() => undefined} />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing(4), padding: spacing(5), paddingBottom: spacing(10) },
  gap: { gap: spacing(2) },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing(2) },
  cell: { width: '50%', paddingHorizontal: spacing(2), paddingBottom: spacing(3) },
});
