import { penShadow, radius, spacing } from '@nivela/design-tokens';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useTheme } from 'src/lib/theme/useTheme';

interface PenCardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Cartão "de caneta": borda de 2 px e sombra sólida deslocada. O `shadowOffset` do RN não
 * desenha sombra sem desfoque no Android, então a sombra é uma View deslocada atrás do cartão
 * (o mesmo desenho vale no iOS, para as duas plataformas ficarem iguais).
 */
export function PenCard({ children, style }: PenCardProps) {
  const { colors } = useTheme();
  const { offset, width } = penShadow;

  return (
    <View style={{ paddingRight: offset, paddingBottom: offset }}>
      <View>
        <View
          pointerEvents="none"
          style={[
            styles.shadow,
            { top: offset, left: offset, right: -offset, bottom: -offset, backgroundColor: colors.shadow },
          ]}
        />
        <View
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: width }, style]}
        >
          {children}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: { position: 'absolute', borderRadius: radius.md },
  card: { borderRadius: radius.md, padding: spacing(4) },
});
