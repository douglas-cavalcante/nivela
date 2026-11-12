import type { ApiMyRedemption } from '@nivela/api-contract';
import { parseApiError } from '@nivela/api-contract';
import { spacing } from '@nivela/design-tokens';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppText } from 'src/components/AppText';
import { Button } from 'src/components/Button';
import { EmptyState } from 'src/components/EmptyState';
import { PaperBackground } from 'src/components/PaperBackground';
import { listMyRedemptionsAction } from 'src/features/store/api/store.action';
import { RedemptionRow } from 'src/features/store/components/RedemptionRow';
import { useReloadOnFocus } from 'src/hooks/useReloadOnFocus';
import { useRemote } from 'src/hooks/useRemote';
import { useTheme } from 'src/lib/theme/useTheme';

const PER_PAGE = 10;

interface MorePages {
  /** Primeira página a que estas páginas extras pertencem: se ela recarregar, as extras são descartadas. */
  base: unknown;
  items: ApiMyRedemption[];
  page: number;
}

/** "Meus resgates": os pedidos do aluno, do mais recente para o mais antigo, com "Carregar mais". */
export function MyRedemptions() {
  const { colors } = useTheme();
  const router = useRouter();
  const first = useRemote('my-redemptions', (signal) => listMyRedemptionsAction(1, PER_PAGE, signal));
  useReloadOnFocus(first.reload);
  const [more, setMore] = useState<MorePages | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const loadError = first.loading ? null : first.error;

  const extra = more !== null && more.base === first.data ? more : null;
  const items = first.data ? [...first.data.data, ...(extra?.items ?? [])] : [];
  const lastLoaded = extra?.page ?? 1;
  const hasMore = first.data !== null && lastLoaded < first.data.meta.last_page;

  const loadMore = async () => {
    if (first.data === null || loadingMore) return;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const next = await listMyRedemptionsAction(lastLoaded + 1, PER_PAGE);
      const known = new Set(items.map((item) => item.id));
      setMore({
        base: first.data,
        items: [...(extra?.items ?? []), ...next.data.filter((item) => !known.has(item.id))],
        page: next.meta.page,
      });
    } catch (err) {
      setMoreError(parseApiError(err).message);
    } finally {
      setLoadingMore(false);
    }
  };

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/store'));

  return (
    <PaperBackground>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar."
          onPress={leave}
          style={[styles.back, { borderColor: colors.border, backgroundColor: colors.surface }]}
        >
          <AppText variant="bold" size={20}>
            ←
          </AppText>
        </Pressable>
        <AppText variant="heading" size={40} accessibilityRole="header">
          Meus resgates
        </AppText>
        {loadError ? (
          <View style={styles.gap}>
            <AppText accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: colors.danger }}>
              {loadError}
            </AppText>
            <Button title="Tentar de novo" variant="outline" onPress={first.reload} />
          </View>
        ) : first.data === null ? (
          <ActivityIndicator accessibilityLabel="Carregando resgates" color={colors.primary} />
        ) : items.length === 0 ? (
          <EmptyState title="Você ainda não resgatou nenhum prêmio." />
        ) : (
          <>
            {items.map((redemption) => (
              <RedemptionRow key={redemption.id} redemption={redemption} />
            ))}
            {moreError ? (
              <AppText accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: colors.danger }}>
                {moreError}
              </AppText>
            ) : null}
            {hasMore ? (
              <Button title="Carregar mais" variant="outline" loading={loadingMore} onPress={() => void loadMore()} />
            ) : null}
          </>
        )}
      </ScrollView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing(4), padding: spacing(5), paddingBottom: spacing(10) },
  gap: { gap: spacing(2) },
  back: {
    minWidth: 44,
    minHeight: 44,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderRadius: 999,
  },
});
