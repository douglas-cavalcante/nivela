import { radius } from '@nivela/design-tokens';
import { StyleSheet, View } from 'react-native';
import { useTheme } from 'src/lib/theme/useTheme';

interface ProgressBarProps {
  percent: number;
  /** Cor do preenchimento; padrão: turquesa da marca. */
  color?: string;
  label: string;
}

/** Barra de progresso "de caneta": trilho com borda e preenchimento sólido. */
export function ProgressBar({ percent, color, label }: ProgressBarProps) {
  const { colors } = useTheme();
  const now = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now }}
      style={[styles.track, { borderColor: colors.border, backgroundColor: colors.surface }]}
    >
      <View style={[styles.fill, { width: `${now}%`, backgroundColor: color ?? colors.primary }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 14, borderWidth: 2, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%' },
});
