import { parseApiError } from '@nivela/api-contract';
import type { ApiStoreReward } from '@nivela/api-contract';
import { spacing } from '@nivela/design-tokens';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { AppText } from 'src/components/AppText';
import { Button } from 'src/components/Button';
import { EmptyState } from 'src/components/EmptyState';
import { PaperBackground } from 'src/components/PaperBackground';
import { PenCard } from 'src/components/PenCard';
import { listStoreRewardsAction, redeemAction } from 'src/features/store/api/store.action';
import { RedeemSheet } from 'src/features/store/components/RedeemSheet';
import { RewardCard } from 'src/features/store/components/RewardCard';
import { CoinBurst, StatsBar, getStatsAction } from 'src/features/study';
import { useReloadOnFocus } from 'src/hooks/useReloadOnFocus';
import { useRemote } from 'src/hooks/useRemote';
import { useTheme } from 'src/lib/theme/useTheme';

/** Valores mais novos que a busca, vindos do resultado de um resgate. */
interface Patch {
  balance: number;
  stocks: Record<number, number>;
}

type Notice = { kind: 'success'; price: number } | { kind: 'error'; message: string };

/** Aba Loja: a vitrine de prêmios da escola, o resgate com confirmação e o atalho para "Meus resgates". */
export function Store() {
  const { colors } = useTheme();
  const router = useRouter();
  const rewards = useRemote('store-rewards', (signal) => listStoreRewardsAction(signal));
  const stats = useRemote('store-stats', (signal) => getStatsAction(signal));
  const [patch, setPatch] = useState<Patch | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [selected, setSelected] = useState<ApiStoreReward | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);

  const reloadRewards = rewards.reload;
  const reloadStats = stats.reload;
  const reload = useCallback(() => {
    setPatch(null);
    reloadRewards();
    reloadStats();
  }, [reloadRewards, reloadStats]);
  useReloadOnFocus(reload);

  const balance = patch?.balance ?? stats.data?.coins_balance ?? null;
  const loadError = rewards.loading ? null : rewards.error;
  const list = rewards.data?.map((reward) => ({ ...reward, stock: patch?.stocks[reward.id] ?? reward.stock })) ?? null;

  const closeSheet = () => {
    setSelected(null);
    setSheetError(null);
  };

  const confirm = async () => {
    if (selected === null || redeeming) return;
    setRedeeming(true);
    setSheetError(null);
    try {
      const result = await redeemAction(selected.id);
      setPatch((current) => ({
        balance: result.coins_balance,
        stocks: { ...current?.stocks, [selected.id]: result.stock },
      }));
      setNotice({ kind: 'success', price: result.redemption.price_paid });
      closeSheet();
    } catch (err) {
      const info = parseApiError(err);
      if (info.status === 409 || info.status === 404) {
        // esgotou ou o saldo mudou: mostra a mensagem e atualiza a vitrine
        setNotice({ kind: 'error', message: info.message });
        closeSheet();
        reload();
      } else {
        setSheetError(info.message);
      }
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <PaperBackground>
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="heading" size={40} accessibilityRole="header">
          Loja
        </AppText>
        <StatsBar latest={balance === null ? null : { coinsBalance: balance }} />
        <Button title="Meus resgates" variant="outline" onPress={() => router.push('/store/redemptions')} />

        {notice?.kind === 'success' ? (
          <PenCard style={styles.notice}>
            <CoinBurst amount={notice.price} direction="out" />
            <AppText variant="bold">Pedido feito! Agora é só combinar a entrega com o professor.</AppText>
          </PenCard>
        ) : null}
        {notice?.kind === 'error' ? (
          <AppText accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: colors.danger }}>
            {notice.message}
          </AppText>
        ) : null}

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
                <RewardCard
                  reward={reward}
                  balance={balance}
                  onRedeem={() => {
                    setNotice(null);
                    setSelected(reward);
                  }}
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
      <RedeemSheet
        reward={selected}
        loading={redeeming}
        error={sheetError}
        onConfirm={() => void confirm()}
        onCancel={closeSheet}
      />
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing(4), padding: spacing(5), paddingBottom: spacing(10) },
  gap: { gap: spacing(2) },
  notice: { gap: spacing(3) },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing(2) },
  cell: { width: '50%', paddingHorizontal: spacing(2), paddingBottom: spacing(3) },
});
