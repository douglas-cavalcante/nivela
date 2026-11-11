import { parseApiError } from '@nivela/api-contract';
import type { ApiAnswerResult, OptionLetter } from '@nivela/api-contract';
import { radius, spacing, subjectColors } from '@nivela/design-tokens';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import type { ComponentRef } from 'react';
import { AccessibilityInfo, ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppText } from 'src/components/AppText';
import { Button } from 'src/components/Button';
import { EmptyState } from 'src/components/EmptyState';
import { PaperBackground } from 'src/components/PaperBackground';
import { PenCard } from 'src/components/PenCard';
import { getChapterNextAction } from 'src/features/plans/api/plans.action';
import { PageTurn } from 'src/features/plans/components/PageTurn';
import { PlanCompleted } from 'src/features/plans/components/PlanCompleted';
import { toId } from 'src/features/plans/format';
import { answerAction, FeedbackView, QuestionView, StatsBar, useQuestionRound } from 'src/features/study';
import { useRemote } from 'src/hooks/useRemote';
import { useTheme } from 'src/lib/theme/useTheme';

/** Estudo de um capítulo: o mesmo fluxo da prática, com `plan_chapter_id` e as comemorações. */
export function ChapterQuestion() {
  const { colors, mode } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; chapterId: string }>();
  const planId = toId(params.id);
  const chapterId = toId(params.chapterId);

  const [round, setRound] = useState(0);
  const [result, setResult] = useState<ApiAnswerResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [latest, setLatest] = useState<{ coinsBalance: number; streak: number } | null>(null);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);

  const { data, loading, error } = useRemote(`chapter-${planId}-${chapterId}-${round}`, (signal) =>
    planId === undefined || chapterId === undefined
      ? Promise.reject(new Error('Capítulo inválido.'))
      : getChapterNextAction(planId, chapterId, signal),
  );
  const loadError = loading ? null : error;
  const { question, retry, reset } = useQuestionRound(data?.question ?? null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [result, round, question?.attempts_left]);

  const backToPlan = () => (router.canGoBack() ? router.back() : router.replace(`/plans/${planId}`));

  const advance = () => {
    setResult(null);
    reset();
    setRound((current) => current + 1);
  };

  const handleAnswer = async (letter: OptionLetter) => {
    if (!question || chapterId === undefined) return;
    setNotice(null);
    setAnswerError(null);
    try {
      const outcome = await answerAction({
        question_id: question.id,
        selected_letter: letter,
        plan_chapter_id: chapterId,
      });
      setLatest({ coinsBalance: outcome.coins_balance, streak: outcome.streak.current });
      setResult(outcome);
    } catch (err) {
      const info = parseApiError(err);
      if (info.status === 409) {
        // Questão já terminada (outra tela ou aparelho): avisa e busca a próxima; se o capítulo
        // estiver trancado, a busca mostra a mensagem.
        setNotice(info.message);
        advance();
      } else {
        setAnswerError(info.message);
      }
    }
  };

  // `completed` é evento ("concluído por esta resposta"): só celebra ao terminar a questão.
  const planDone = result?.finished === true && result.plan?.completed === true;
  const nextChapterId = result?.chapter?.next_chapter_id ?? null;
  const chapterDone = result?.finished === true && result.chapter?.completed === true;

  useEffect(() => {
    if (planDone) void AccessibilityInfo.announceForAccessibility('Plano concluído!');
    else if (chapterDone) void AccessibilityInfo.announceForAccessibility('Capítulo concluído!');
  }, [planDone, chapterDone]);

  const handleNext = () => {
    setNotice(null);
    if (planDone) {
      router.dismissTo('/');
    } else if (chapterDone) {
      if (nextChapterId !== null) router.replace(`/plans/${planId}/chapters/${nextChapterId}`);
      else backToPlan();
    } else {
      advance();
    }
  };

  const nextLabel = planDone ? 'Voltar ao início' : chapterDone ? (nextChapterId !== null ? 'Próximo capítulo' : 'Voltar ao plano') : 'Próxima';
  const palette = question ? subjectColors[mode][question.subject.color] : null;

  return (
    <PaperBackground>
      <PageTurn>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.top}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sair do capítulo."
              onPress={backToPlan}
              style={[styles.back, { borderColor: colors.border, backgroundColor: colors.surface }]}
            >
              <AppText variant="bold" size={20}>
                ←
              </AppText>
            </Pressable>
            <StatsBar latest={latest} />
          </View>

          {question && palette ? (
            <View style={[styles.chip, { backgroundColor: palette.background }]}>
              <AppText variant="bold" size={15} style={{ color: palette.foreground }}>
                {`${question.subject.name} · ${question.category.name}`}
              </AppText>
            </View>
          ) : null}

          {notice ? (
            <AppText
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              variant="bold"
              style={{ color: colors.primary }}
            >
              {notice}
            </AppText>
          ) : null}

          {loadError ? (
            <View style={styles.gap}>
              <AppText accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: colors.danger }}>
                {loadError}
              </AppText>
              <Button title="Voltar ao plano" variant="outline" onPress={backToPlan} />
            </View>
          ) : data === null ? (
            <ActivityIndicator accessibilityLabel="Carregando questão" color={colors.primary} />
          ) : question === null ? (
            <EmptyState title="Você terminou este capítulo!" action={<Button title="Voltar ao plano" onPress={backToPlan} />} />
          ) : result ? (
            <FeedbackView
              result={result}
              question={question}
              nextLabel={nextLabel}
              onRetry={() => {
                setResult(null);
                retry();
              }}
              onNext={handleNext}
            >
              {planDone ? (
                <PlanCompleted bonus={result.plan?.bonus_awarded ?? 0} />
              ) : chapterDone ? (
                <PenCard>
                  <AppText
                    variant="heading"
                    size={36}
                    accessibilityRole="header"
                    accessibilityLiveRegion="polite"
                  >
                    Capítulo concluído!
                  </AppText>
                </PenCard>
              ) : null}
            </FeedbackView>
          ) : (
            <View style={styles.gap}>
              <QuestionView
                key={`${question.id}-${question.attempts_left}`}
                question={question}
                onAnswer={handleAnswer}
              />
              {answerError ? (
                <AppText accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: colors.danger }}>
                  {answerError}
                </AppText>
              ) : null}
            </View>
          )}
        </ScrollView>
      </PageTurn>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing(4), padding: spacing(5), paddingBottom: spacing(10) },
  gap: { gap: spacing(3) },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderRadius: radius.pill,
  },
  chip: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1),
    borderRadius: radius.pill,
  },
});
