import { radius, spacing } from '@nivela/design-tokens';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from 'src/components/AppText';
import { Mascot } from 'src/components/Mascot';
import { useTheme } from 'src/lib/theme/useTheme';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

/** Estado vazio com o mascote Rabisco: telas sem conteúdo ou "em breve". */
export function EmptyState({ title, description, action }: EmptyStateProps) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="summary"
      style={[styles.box, { borderColor: colors.textMuted, backgroundColor: colors.surface }]}
    >
      <Mascot size={112} />
      <AppText variant="heading" style={styles.center}>
        {title}
      </AppText>
      {description ? (
        <AppText variant="muted" style={styles.center}>
          {description}
        </AppText>
      ) : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    gap: spacing(2),
    padding: spacing(6),
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
  },
  center: { textAlign: 'center' },
  action: { marginTop: spacing(2) },
});
