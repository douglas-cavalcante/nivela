import { radius, spacing } from '@nivela/design-tokens';
import { StyleSheet, View } from 'react-native';
import { AppText } from 'src/components/AppText';
import { Mascot } from 'src/components/Mascot';
import { PenCard } from 'src/components/PenCard';
import { useTheme } from 'src/lib/theme/useTheme';

interface PlanCompletedProps {
  /** Moedas do bônus de conclusão; só aparece quando maior que zero. */
  bonus: number;
}

/** Comemoração de plano concluído: mascote, título e o bônus (se houve). */
export function PlanCompleted({ bonus }: PlanCompletedProps) {
  const { colors } = useTheme();
  return (
    <PenCard style={styles.card}>
      <Mascot size={120} label="Rabisco comemorando." />
      <AppText variant="heading" size={44} style={styles.center}>
        Plano concluído!
      </AppText>
      <AppText variant="muted" style={styles.center}>
        Você terminou todos os capítulos.
      </AppText>
      {bonus > 0 ? (
        <View
          accessible
          accessibilityLabel={`Bônus de ${bonus} moedas.`}
          style={[styles.bonus, { backgroundColor: colors.highlight, borderColor: colors.border }]}
        >
          <AppText variant="heading" size={36} style={{ color: colors.onHighlight }} importantForAccessibility="no">
            {`+${bonus} 🪙.`}
          </AppText>
        </View>
      ) : null}
    </PenCard>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', gap: spacing(3) },
  center: { textAlign: 'center' },
  bonus: { paddingHorizontal: spacing(4), borderWidth: 2, borderRadius: radius.pill },
});
