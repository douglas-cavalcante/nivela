import { radius, spacing, subjectColors } from '@nivela/design-tokens';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppText } from 'src/components/AppText';
import { Button } from 'src/components/Button';
import { PaperBackground } from 'src/components/PaperBackground';
import { getMyPlanAction } from 'src/features/plans/api/plans.action';
import { ChapterPage } from 'src/features/plans/components/ChapterPage';
import { DoneChip } from 'src/features/plans/components/DoneChip';
import { ProgressBar } from 'src/features/plans/components/ProgressBar';
import { chaptersLabel, formatDueDay, toId } from 'src/features/plans/format';
import { useReloadOnFocus } from 'src/hooks/useReloadOnFocus';
import { useRemote } from 'src/hooks/useRemote';
import { useTheme } from 'src/lib/theme/useTheme';

/** O plano como um caderno: cada capítulo é uma página (trancada até concluir a anterior). */
export function PlanDetail() {
  const { colors, mode } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const planId = toId(params.id);
  const { data, loading, error, reload } = useRemote(`plan-${planId}`, (signal) =>
    planId === undefined ? Promise.reject(new Error('Plano inválido.')) : getMyPlanAction(planId, signal),
  );
  useReloadOnFocus(reload);
  const loadError = loading ? null : error;
  const palette = data ? subjectColors[mode][data.subject.color] : null;

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <PaperBackground>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar."
          onPress={leave}
          style={[styles.back, { borderColor: colors.border, backgroundColor: colors.surface }]}
        >
          <AppText variant="bold" size={20}>
            ←
          </AppText>
        </Pressable>

        {loadError ? (
          <View style={styles.gap}>
            <AppText accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: colors.danger }}>
              {loadError}
            </AppText>
            <Button title="Tentar de novo" variant="outline" onPress={reload} />
          </View>
        ) : data === null || palette === null ? (
          <ActivityIndicator accessibilityLabel="Carregando plano" color={colors.primary} />
        ) : (
          <>
            <View style={[styles.marker, { backgroundColor: palette.background }]}>
              <AppText
                variant="heading"
                size={40}
                accessibilityRole="header"
                style={{ color: palette.foreground }}
              >
                {data.title}
              </AppText>
            </View>
            <AppText variant="muted">
              {data.subject.name}
              {data.due_date ? ` · Até ${formatDueDay(data.due_date)}.` : ''}
            </AppText>
            {data.description ? <AppText>{data.description}</AppText> : null}
            {data.chapters.length > 0 && data.chapters.every((chapter) => chapter.total === 0) ? (
              <AppText accessibilityRole="alert">Este plano está sem questões disponíveis no momento.</AppText>
            ) : (
              <>
                {data.completed ? <DoneChip /> : null}
                <ProgressBar
                  percent={data.progress.percent}
                  color={palette.foreground}
                  label="Progresso do plano."
                />
                <AppText variant="bold">{`${chaptersLabel(data.progress.completed_chapters, data.progress.total_chapters)}.`}</AppText>
                {data.chapters.map((chapter, index) => (
                  <ChapterPage
                    key={chapter.id}
                    chapter={chapter}
                    number={index + 1}
                    onPress={() => router.push(`/plans/${data.id}/chapters/${chapter.id}`)}
                  />
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing(3), padding: spacing(5), paddingBottom: spacing(10) },
  gap: { gap: spacing(2) },
  back: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderRadius: radius.pill,
  },
  marker: { alignSelf: 'flex-start', paddingHorizontal: spacing(2), borderRadius: radius.sm },
});
