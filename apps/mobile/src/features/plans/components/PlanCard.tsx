import type { ApiMyPlanSummary } from '@nivela/api-contract';
import { radius, spacing, subjectColors } from '@nivela/design-tokens';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from 'src/components/AppText';
import { PenCard } from 'src/components/PenCard';
import { chaptersLabel, formatDueDay } from 'src/features/plans/format';
import { ProgressBar } from 'src/features/plans/components/ProgressBar';
import { useTheme } from 'src/lib/theme/useTheme';

interface PlanCardProps {
  plan: ApiMyPlanSummary;
  onPress: () => void;
}

/** Cartão de um plano na lista "Meus planos": título com marca-texto, progresso e prazo. */
export function PlanCard({ plan, onPress }: PlanCardProps) {
  const { mode } = useTheme();
  const palette = subjectColors[mode][plan.subject.color];
  const progress = `${chaptersLabel(plan.progress.completed_chapters, plan.progress.total_chapters)}.`;
  const due = plan.due_date ? `Até ${formatDueDay(plan.due_date)}.` : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Plano ${plan.title}. ${plan.subject.name}. ${plan.completed ? 'Plano concluído.' : progress}${
        due ? ` ${due}` : ''
      }`}
      onPress={onPress}
      style={styles.target}
    >
      <PenCard style={styles.card}>
        <View style={[styles.marker, { backgroundColor: palette.background }]}>
          <AppText variant="heading" size={30} style={{ color: palette.foreground }} importantForAccessibility="no">
            {plan.title}
          </AppText>
        </View>
        <AppText variant="muted" importantForAccessibility="no">
          {plan.subject.name}
        </AppText>
        <ProgressBar
          percent={plan.progress.percent}
          color={palette.foreground}
          label={`${plan.progress.percent}% concluído.`}
        />
        <View style={styles.row}>
          <AppText variant="bold" importantForAccessibility="no">
            {progress}
          </AppText>
          {due ? (
            <AppText variant="muted" importantForAccessibility="no">
              {due}
            </AppText>
          ) : null}
        </View>
      </PenCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  target: { minHeight: 44 },
  card: { gap: spacing(2) },
  marker: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing(2),
    borderRadius: radius.sm,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing(2) },
});
