import type { ApiPracticeSubject } from '@nivela/api-contract';
import { radius, spacing, subjectColors } from '@nivela/design-tokens';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppText } from 'src/components/AppText';
import { Button } from 'src/components/Button';
import { PaperBackground } from 'src/components/PaperBackground';
import { PenCard } from 'src/components/PenCard';
import { listPracticeSubjectsAction } from 'src/features/study/api/study.action';
import { SubjectIcon } from 'src/features/study/components/SubjectIcon';
import { useRemote } from 'src/hooks/useRemote';
import { useTheme } from 'src/lib/theme/useTheme';

const questionsLabel = (count: number): string => `${count} ${count === 1 ? 'questão' : 'questões'}.`;

function SubjectCard({
  subject,
  open,
  onToggle,
  onPractice,
}: {
  subject: ApiPracticeSubject;
  open: boolean;
  onToggle: () => void;
  onPractice: (categoryId?: number) => void;
}) {
  const { colors, mode } = useTheme();
  const palette = subjectColors[mode][subject.color];
  const empty = subject.available_questions === 0;
  const categories = subject.categories.filter((category) => category.available_questions > 0);

  return (
    <PenCard style={[styles.card, { backgroundColor: palette.background }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Praticar ${subject.name}`}
        accessibilityState={{ expanded: open, disabled: empty }}
        disabled={empty}
        onPress={onToggle}
        style={[styles.header, { opacity: empty ? 0.7 : 1 }]}
      >
        <View style={[styles.icon, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SubjectIcon icon={subject.icon} color={palette.foreground} />
        </View>
        <View style={styles.headerText}>
          <AppText variant="heading" size={32} style={{ color: palette.foreground }}>
            {subject.name}
          </AppText>
          <AppText variant="bold" style={{ color: palette.foreground }}>
            {empty ? 'Você praticou tudo por aqui.' : `${subject.available_questions} ${subject.available_questions === 1 ? 'questão' : 'questões'} para praticar.`}
          </AppText>
        </View>
      </Pressable>
      {open ? (
        <View style={styles.categories}>
          <Button title="Todas as categorias" onPress={() => onPractice()} />
          {categories.map((category) => (
            <Pressable
              key={category.id}
              accessibilityRole="button"
              accessibilityLabel={category.name}
              onPress={() => onPractice(category.id)}
              style={[styles.category, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <AppText variant="bold" size={18} style={styles.flex}>
                {category.name}
              </AppText>
              <AppText variant="muted">{questionsLabel(category.available_questions)}</AppText>
            </Pressable>
          ))}
        </View>
      ) : null}
    </PenCard>
  );
}

/** Aba Estudar: as disciplinas com questões para praticar; escolha opcional de categoria. */
export function StudyHome() {
  const { colors } = useTheme();
  const router = useRouter();
  const { data, loading, error, reload } = useRemote('practice-subjects', (signal) => listPracticeSubjectsAction(signal));
  const [openId, setOpenId] = useState<number | null>(null);
  const loadError = loading ? null : error;

  const practice = (subjectId: number, categoryId?: number) =>
    router.push(categoryId ? `/practice/${subjectId}?category_id=${categoryId}` : `/practice/${subjectId}`);

  return (
    <PaperBackground>
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="heading" size={40}>
          Escolha o que praticar.
        </AppText>
        {loadError ? (
          <View style={styles.gap}>
            <AppText accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: colors.danger }}>
              {loadError}
            </AppText>
            <Button title="Tentar de novo" variant="outline" onPress={reload} />
          </View>
        ) : data === null ? (
          <ActivityIndicator accessibilityLabel="Carregando disciplinas" color={colors.primary} />
        ) : data.length === 0 ? (
          <AppText variant="muted">Ainda não há questões para praticar.</AppText>
        ) : (
          data.map((subject) => (
            <SubjectCard
              key={subject.id}
              subject={subject}
              open={openId === subject.id}
              onToggle={() => setOpenId((current) => (current === subject.id ? null : subject.id))}
              onPractice={(categoryId) => practice(subject.id, categoryId)}
            />
          ))
        )}
      </ScrollView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing(4), padding: spacing(5), paddingBottom: spacing(10) },
  gap: { gap: spacing(2) },
  flex: { flex: 1 },
  card: { padding: 0, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing(3), padding: spacing(4), minHeight: 72 },
  headerText: { flex: 1 },
  icon: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderRadius: radius.pill,
  },
  categories: { gap: spacing(3), padding: spacing(4), paddingTop: 0 },
  category: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    paddingHorizontal: spacing(4),
    borderWidth: 2,
    borderRadius: radius.md,
  },
});
