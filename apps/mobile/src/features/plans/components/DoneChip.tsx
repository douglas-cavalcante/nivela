import { radius, spacing } from '@nivela/design-tokens';
import { StyleSheet, View } from 'react-native';
import { AppText } from 'src/components/AppText';
import { useTheme } from 'src/lib/theme/useTheme';

/** Selo "Concluído." de plano terminado. */
export function DoneChip() {
  const { colors } = useTheme();
  return (
    <View style={[styles.chip, { borderColor: colors.success, backgroundColor: colors.surface }]}>
      <AppText variant="bold" size={15} style={{ color: colors.success }}>
        ✓ Concluído.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing(3),
    borderWidth: 2,
    borderRadius: radius.pill,
  },
});
