import { Text } from 'react-native';
import type { TextProps } from 'react-native';
import { useTheme } from 'src/lib/theme/useTheme';

interface AppTextProps extends TextProps {
  /** `heading` usa a manuscrita Caveat; os demais, a Nunito. */
  variant?: 'heading' | 'body' | 'bold' | 'muted';
  size?: number;
}

export function AppText({ variant = 'body', size, style, ...props }: AppTextProps) {
  const { colors, fonts } = useTheme();
  const base = {
    heading: { fontFamily: fonts.heading, fontSize: 32, lineHeight: 38, color: colors.text },
    body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24, color: colors.text },
    bold: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 24, color: colors.text },
    muted: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.textMuted },
  }[variant];
  // A manuscrita tem traços que passam da caixa medida; sem folga à direita o Android corta a última letra.
  const overhang =
    variant === 'heading' ? { paddingRight: Math.ceil((size ?? 32) * 0.15) } : null;
  return (
    <Text
      accessibilityRole={variant === 'heading' ? 'header' : undefined}
      style={[base, overhang, size ? { fontSize: size, lineHeight: Math.round(size * 1.25) } : null, style]}
      {...props}
    />
  );
}
