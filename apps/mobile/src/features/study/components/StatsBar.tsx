import { radius, spacing } from '@nivela/design-tokens';
import { StyleSheet, View } from 'react-native';
import { AppText } from 'src/components/AppText';
import { getStatsAction } from 'src/features/study/api/study.action';
import { useReloadOnFocus } from 'src/hooks/useReloadOnFocus';
import { useRemote } from 'src/hooks/useRemote';
import { useTheme } from 'src/lib/theme/useTheme';

interface StatsBarProps {
  /** Valores mais novos que a busca (vindos de `ApiAnswerResult`): têm prioridade. */
  latest?: { coinsBalance: number; streak: number } | null;
}

function Pill({ emoji, value, label }: { emoji: string; value: number; label: string }) {
  const { colors } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={[styles.pill, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <AppText size={22} importantForAccessibility="no">
        {emoji}
      </AppText>
      <AppText variant="bold" size={22} importantForAccessibility="no">
        {String(value)}
      </AppText>
    </View>
  );
}

/** 🔥 sequência e 🪙 moedas do aluno (`GET /me/stats`), atualizadas pelo resultado da última resposta. */
export function StatsBar({ latest = null }: StatsBarProps) {
  const { data, reload } = useRemote('me-stats', (signal) => getStatsAction(signal));
  useReloadOnFocus(reload);
  const streak = latest?.streak ?? data?.current_streak;
  const coins = latest?.coinsBalance ?? data?.coins_balance;
  if (streak === undefined || coins === undefined) return null;

  return (
    <View style={styles.row}>
      <Pill emoji="🔥" value={streak} label={`Sequência de ${streak} ${streak === 1 ? 'dia' : 'dias'}.`} />
      <Pill emoji="🪙" value={coins} label={`${coins} ${coins === 1 ? 'moeda' : 'moedas'}.`} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing(3) },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1),
    borderWidth: 2,
    borderRadius: radius.pill,
  },
});
