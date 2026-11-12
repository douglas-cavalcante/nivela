import type { ApiMyPlan } from '@nivela/api-contract';
import { radius, spacing } from '@nivela/design-tokens';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from 'src/components/AppText';
import { PenCard } from 'src/components/PenCard';
import { questionsLabel } from 'src/features/plans/format';
import { useTheme } from 'src/lib/theme/useTheme';

type Chapter = ApiMyPlan['chapters'][number];

interface ChapterPageProps {
  chapter: Chapter;
  /** Posição na lista (1, 2, 3...), mostrada como número grande da "página". */
  number: number;
  onPress: () => void;
}

const stateLabel = { locked: 'Trancado.', available: 'Disponível.', completed: 'Concluído.' } as const;

/** Um capítulo como página do caderno: número grande em Caveat, título e andamento. */
export function ChapterPage({ chapter, number, onPress }: ChapterPageProps) {
  const { colors } = useTheme();
  const locked = chapter.state === 'locked';
  const completed = chapter.state === 'completed';
  const progress = `${questionsLabel(chapter.answered, chapter.total)}.`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Capítulo ${number}: ${chapter.title}. ${stateLabel[chapter.state]} ${
        locked ? 'Conclua o capítulo anterior.' : progress
      }`}
      accessibilityState={{ disabled: locked }}
      disabled={locked}
      onPress={onPress}
      style={styles.target}
    >
      <PenCard style={[styles.page, { backgroundColor: locked ? colors.background : colors.surface }]}>
        <View style={[styles.margin, { borderColor: colors.secondary }]}>
          <AppText
            variant="heading"
            size={56}
            style={[styles.number, { opacity: locked ? 0.4 : 1 }]}
            importantForAccessibility="no"
          >
            {String(number)}
          </AppText>
        </View>
        <View style={styles.body}>
          <AppText variant="bold" size={18} importantForAccessibility="no">
            {chapter.title}
          </AppText>
          {locked ? (
            <View style={styles.lockRow}>
              <AppText importantForAccessibility="no" style={styles.lockIcon}>
                🔒
              </AppText>
              <AppText variant="muted" importantForAccessibility="no" style={styles.flex}>
                Conclua o capítulo anterior.
              </AppText>
            </View>
          ) : (
            <AppText
              variant="muted"
              importantForAccessibility="no"
              style={completed ? { color: colors.success } : null}
            >
              {completed ? `✓ ${progress}` : progress}
            </AppText>
          )}
        </View>
      </PenCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  target: { minHeight: 44 },
  page: { flexDirection: 'row', alignItems: 'center', gap: spacing(3), minHeight: 88 },
  margin: { width: 56, alignItems: 'center', borderRightWidth: 2, paddingRight: spacing(3), borderRadius: radius.sm },
  number: { lineHeight: 60 },
  body: { flex: 1, gap: spacing(1) },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  flex: { flex: 1 },
  lockIcon: { opacity: 0.6 },
});
