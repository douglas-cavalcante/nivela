import { spacing } from '@nivela/design-tokens';
import { StyleSheet, View } from 'react-native';
import { AppText } from 'src/components/AppText';
import { useTheme } from 'src/lib/theme/useTheme';

interface HandTitleProps {
  children: string;
  size?: number;
}

/** Título manuscrito com o traço de marca-texto por baixo, como num caderno. */
export function HandTitle({ children, size = 44 }: HandTitleProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <View
        pointerEvents="none"
        style={[styles.marker, { backgroundColor: colors.highlight, height: Math.round(size * 0.32) }]}
      />
      <AppText variant="heading" size={size} style={styles.text}>
        {children}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'center', paddingHorizontal: spacing(1) },
  marker: { position: 'absolute', left: 0, right: 0, bottom: spacing(1), borderRadius: 4, opacity: 0.9 },
  text: { textAlign: 'center' },
});
