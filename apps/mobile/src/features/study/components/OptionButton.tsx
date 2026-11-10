import type { OptionLetter } from '@nivela/api-contract';
import { penShadow, radius, spacing } from '@nivela/design-tokens';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from 'src/components/AppText';
import { useTheme } from 'src/lib/theme/useTheme';

interface OptionButtonProps {
  letter: OptionLetter;
  text: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}

/**
 * Alternativa grande (≥ 56 px) com a letra num círculo, como no caderno.
 * Ao escolher, ganha o marca-texto: fundo amarelo e a letra preenchida.
 */
export function OptionButton({ letter, text, selected, disabled = false, onPress }: OptionButtonProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={`Alternativa ${letter}: ${text}`}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
    >
      {({ pressed }) => (
        <View
          style={[
            styles.row,
            {
              backgroundColor: selected ? colors.highlight : colors.surface,
              borderColor: colors.border,
              borderWidth: penShadow.width,
              transform: pressed ? [{ scale: 0.98 }] : [],
              opacity: disabled && !selected ? 0.6 : 1,
            },
          ]}
        >
          <View
            style={[
              styles.badge,
              {
                borderColor: colors.border,
                backgroundColor: selected ? colors.surface : colors.background,
              },
            ]}
          >
            <AppText variant="heading" size={28} style={styles.letter}>
              {letter}
            </AppText>
          </View>
          <AppText
            variant={selected ? 'bold' : 'body'}
            size={18}
            style={[styles.text, selected ? { color: colors.onHighlight } : null]}
          >
            {text}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3),
    borderRadius: radius.md,
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: { lineHeight: 32, textAlign: 'center' },
  text: { flex: 1 },
});
