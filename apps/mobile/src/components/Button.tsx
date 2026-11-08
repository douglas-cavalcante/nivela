import { penShadow, radius, spacing } from '@nivela/design-tokens';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import type { PressableProps } from 'react-native';
import { AppText } from 'src/components/AppText';
import { useTheme } from 'src/lib/theme/useTheme';

interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  title: string;
  /** `primary` é a ação principal (turquesa); `secondary` o coral; `outline` o papel com borda. */
  variant?: 'primary' | 'secondary' | 'outline';
  /** Mostra o indicador de carregamento e bloqueia novos toques. */
  loading?: boolean;
}

/** Botão "de caneta": borda de 2 px, sombra sólida e alvo de toque de pelo menos 52 px. */
export function Button({ title, variant = 'primary', loading = false, disabled, ...props }: ButtonProps) {
  const { colors } = useTheme();
  const palette = {
    primary: { background: colors.primary, text: colors.onPrimary },
    secondary: { background: colors.secondary, text: colors.onSecondary },
    outline: { background: colors.surface, text: colors.text },
  }[variant];
  const blocked = Boolean(disabled) || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: blocked, busy: loading }}
      disabled={blocked}
      {...props}
    >
      {({ pressed }) => (
        <View style={{ paddingRight: penShadow.offset, paddingBottom: penShadow.offset, opacity: blocked && !loading ? 0.6 : 1 }}>
          <View style={[styles.shadow, { backgroundColor: colors.shadow }]} pointerEvents="none" />
          <View
            style={[
              styles.face,
              {
                backgroundColor: palette.background,
                borderColor: colors.border,
                transform: pressed ? [{ translateX: penShadow.offset }, { translateY: penShadow.offset }] : [],
              },
            ]}
          >
            {loading ? <ActivityIndicator color={palette.text} /> : null}
            <AppText variant="bold" size={18} style={{ color: palette.text }}>
              {title}
            </AppText>
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shadow: {
    position: 'absolute',
    top: penShadow.offset,
    left: penShadow.offset,
    right: 0,
    bottom: 0,
    borderRadius: radius.md,
  },
  face: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(2),
    paddingHorizontal: spacing(5),
    borderRadius: radius.md,
    borderWidth: penShadow.width,
  },
});
