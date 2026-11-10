import { parseApiError } from '@nivela/api-contract';
import type { ApiAnswerResult, ApiStudentQuestion, OptionLetter } from '@nivela/api-contract';
import { radius, spacing, subjectColors } from '@nivela/design-tokens';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import type { ComponentRef } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppText } from 'src/components/AppText';
import { Button } from 'src/components/Button';
import { EmptyState } from 'src/components/EmptyState';
import { PaperBackground } from 'src/components/PaperBackground';
import { answerAction, getPracticeNextAction } from 'src/features/study/api/study.action';
import { FeedbackView } from 'src/features/study/components/FeedbackView';
import { QuestionView } from 'src/features/study/components/QuestionView';
import { StatsBar } from 'src/features/study/components/StatsBar';
import { useRemote } from 'src/hooks/useRemote';
import { useTheme } from 'src/lib/theme/useTheme';

/** Lê um id de rota; `undefined` se vier vazio ou inválido. */
function toId(value: string | string[] | undefined): number | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const id = Number(raw);
  return raw && Number.isInteger(id) && id > 0 ? id : undefined;
}

/** Prática livre: uma questão por vez da disciplina (e categoria) escolhida. */
export function PracticeQuestion() {
  const { colors, mode } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ subjectId: string; category_id?: string }>();
  const subjectId = toId(params.subjectId);
  const categoryId = toId(params.category_id);

  const [round, setRound] = useState(0);
  const [result, setResult] = useState<ApiAnswerResult | null>(null);
  const [retried, setRetried] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [latest, setLatest] = useState<{ coinsBalance: number; streak: number } | null>(null);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);

  const { data, loading, error, reload } = useRemote(`practice-${subjectId}-${categoryId ?? 'all'}-${round}`, (signal) =>
    subjectId === undefined
      ? Promise.reject(new Error('Disciplina inválida.'))
      : getPracticeNextAction(subjectId, categoryId, signal),
  );
  const loadError = loading ? null : error;

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [result, round, retried]);

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/study'));

  const advance = () => {
    setResult(null);
    setRetried(false);
    setRound((current) => current + 1);
  };

  const baseQuestion = data?.question ?? null;
  const question: ApiStudentQuestion | null =
    baseQuestion && retried ? { ...baseQuestion, attempts_left: 1 } : baseQuestion;

  const handleAnswer = async (letter: OptionLetter) => {
    if (!question) return;
    setNotice(null);
    setAnswerError(null);
    try {
      const outcome = await answerAction({ question_id: question.id, selected_letter: letter });
      setLatest({ coinsBalance: outcome.coins_balance, streak: outcome.streak.current });
      setResult(outcome);
    } catch (err) {
      const info = parseApiError(err);
      if (info.status === 409) {
        // A questão já terminou (outra tela ou aparelho): avisa e segue para a próxima.
        setNotice(info.message);
        advance();
      } else {
        setAnswerError(info.message);
      }
    }
  };

  const palette = question ? subjectColors[mode][question.subject.color] : null;

  return (
    <PaperBackground>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.top}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sair da prática."
            onPress={leave}
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
          <AppText accessibilityRole="alert" accessibilityLiveRegion="polite" variant="bold" style={{ color: colors.primary }}>
            {notice}
          </AppText>
        ) : null}

        {loadError ? (
          <View style={styles.gap}>
            <AppText accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: colors.danger }}>
              {loadError}
            </AppText>
            <Button title="Tentar de novo" variant="outline" onPress={reload} />
          </View>
        ) : data === null ? (
          <ActivityIndicator accessibilityLabel="Carregando questão" color={colors.primary} />
        ) : question === null ? (
          <EmptyState title="Você praticou tudo por aqui!" action={<Button title="Voltar" onPress={leave} />} />
        ) : result ? (
          <FeedbackView
            result={result}
            question={question}
            onRetry={() => {
              setResult(null);
              setRetried(true);
            }}
            onNext={() => {
              setNotice(null);
              advance();
            }}
          />
        ) : (
          <View style={styles.gap}>
            <QuestionView key={`${question.id}-${question.attempts_left}`} question={question} onAnswer={handleAnswer} />
            {answerError ? (
              <AppText accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: colors.danger }}>
                {answerError}
              </AppText>
            ) : null}
          </View>
        )}
      </ScrollView>
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
  chip: { alignSelf: 'flex-start', paddingHorizontal: spacing(3), paddingVertical: spacing(1), borderRadius: radius.pill },
});
