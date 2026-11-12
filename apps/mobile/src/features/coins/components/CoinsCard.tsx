import { spacing } from '@nivela/design-tokens';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AppText } from 'src/components/AppText';
import { Button } from 'src/components/Button';
import { EmptyState } from 'src/components/EmptyState';
import { PenCard } from 'src/components/PenCard';
import { listMyCoinsAction } from 'src/features/coins/api/coins.action';
import { CoinStatementList } from 'src/features/coins/components/CoinStatementList';
import { getStatsAction } from 'src/features/study';
import { useReloadOnFocus } from 'src/hooks/useReloadOnFocus';
import { useRemote } from 'src/hooks/useRemote';
import { useTheme } from 'src/lib/theme/useTheme';

const LATEST = 3;

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** "Minhas moedas" no perfil: saldo, sequência atual, melhor sequência e as últimas movimentações. */
export function CoinsCard() {
  const { colors } = useTheme();
  const router = useRouter();
  const stats = useRemote('profile-stats', (signal) => getStatsAction(signal));
  const coins = useRemote('profile-coins', (signal) => listMyCoinsAction(1, LATEST, signal));
  const reloadStats = stats.reload;
  const reloadCoins = coins.reload;
  const reload = useCallback(() => {
    reloadStats();
    reloadCoins();
  }, [reloadStats, reloadCoins]);
  useReloadOnFocus(reload);
  const error = stats.loading || coins.loading ? null : (stats.error ?? coins.error);

  return (
    <PenCard style={styles.card}>
      <AppText variant="heading" size={28} accessibilityRole="header">
        Minhas moedas
      </AppText>
      {error ? (
        <View style={styles.card}>
          <AppText accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: colors.danger }}>
            {error}
          </AppText>
          <Button title="Tentar de novo" variant="outline" onPress={reload} />
        </View>
      ) : stats.data === null || coins.data === null ? (
        <ActivityIndicator accessibilityLabel="Carregando moedas" color={colors.primary} />
      ) : (
        <>
          <View style={styles.figures}>
            <View accessible accessibilityLabel={`Saldo: ${plural(stats.data.coins_balance, 'moeda', 'moedas')}.`}>
              <AppText variant="heading" size={36}>{`🪙 ${stats.data.coins_balance}`}</AppText>
              <AppText variant="muted" size={14}>
                Saldo
              </AppText>
            </View>
            <View accessible accessibilityLabel={`Sequência atual: ${plural(stats.data.current_streak, 'dia', 'dias')}.`}>
              <AppText variant="heading" size={36}>{`🔥 ${stats.data.current_streak}`}</AppText>
              <AppText variant="muted" size={14}>
                Sequência atual
              </AppText>
            </View>
            <View accessible accessibilityLabel={`Melhor sequência: ${plural(stats.data.best_streak, 'dia', 'dias')}.`}>
              <AppText variant="heading" size={36}>{`🏆 ${stats.data.best_streak}`}</AppText>
              <AppText variant="muted" size={14}>
                Melhor sequência
              </AppText>
            </View>
          </View>
          {coins.data.data.length === 0 ? (
            <EmptyState title="Você ainda não movimentou moedas." />
          ) : (
            <CoinStatementList transactions={coins.data.data.slice(0, LATEST)} />
          )}
          <Button title="Ver extrato completo" variant="outline" onPress={() => router.push('/coins')} />
        </>
      )}
    </PenCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing(3) },
  figures: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing(3) },
});
