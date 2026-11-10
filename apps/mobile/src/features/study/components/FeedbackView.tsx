import type { ApiAnswerResult, ApiStudentQuestion } from '@nivela/api-contract';
import { radius, spacing } from '@nivela/design-tokens';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import { Animated, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'src/lib/motion';
import { AppText } from 'src/components/AppText';
import { Button } from 'src/components/Button';
import { Mascot } from 'src/components/Mascot';
import { PenCard } from 'src/components/PenCard';
import { CoinBurst } from 'src/features/study/components/CoinBurst';
import { useTheme } from 'src/lib/theme/useTheme';

interface FeedbackViewProps {
  result: ApiAnswerResult;
  /** Se vier, mostra o texto da alternativa certa quando o aluno esgota as tentativas. */
  question?: ApiStudentQuestion;
  /** Passa para a próxima questão (só quando a questão terminou). */
  onNext: () => void;
  /** Volta à mesma questão para a 2ª tentativa (só quando errou na 1ª). */
  onRetry: () => void;
  /** Texto do botão de seguir; o fluxo dos planos pode trocar (ex.: "Concluir capítulo."). */
  nextLabel?: string;
  /** Avisos extras do fluxo (capítulo concluído, bônus do plano...) abaixo da explicação. */
  children?: ReactNode;
}

function MarkerTitle({ text }: { text: string }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const grow = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    // valores compartilhados do Reanimated são mutáveis por desenho
    if (reduced) return;
    // eslint-disable-next-line react-hooks/immutability
    grow.value = withTiming(1, { duration: 450, easing: Easing.out(Easing.cubic) });
  }, [grow, reduced]);
  const markerStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: grow.value }],
  }));

  return (
    <View style={styles.titleWrap}>
      <Animated.View style={[styles.marker, { backgroundColor: colors.highlight }, markerStyle]} />
      <AppText variant="heading" size={48} accessibilityRole="header">
        {text}
      </AppText>
    </View>
  );
}

/**
 * O que acontece depois de responder: acerto (moedas e explicação), erro na 1ª tentativa
 * (sem revelar a resposta) ou erro na 2ª (resposta e explicação). Reutilizado nos planos.
 */
export function FeedbackView({
  result,
  question,
  onNext,
  onRetry,
  nextLabel = 'Próxima',
  children,
}: FeedbackViewProps) {
  const { colors } = useTheme();
  const retry = !result.is_correct && !result.finished;
  const title = result.is_correct
    ? 'Isso aí!'
    : retry
      ? 'Quase! Tente de novo.'
      : `Resposta: ${result.correct_letter ?? ''}`;

  useEffect(() => {
    void AccessibilityInfo.announceForAccessibility(
      result.is_correct
        ? `Isso aí! Resposta correta.`
        : retry
          ? 'Quase! Tente de novo.'
          : `Resposta correta: ${result.correct_letter}.`,
    );
  }, [result, retry]);

  const correctOption = question?.options.find((option) => option.letter === result.correct_letter);

  return (
    <View style={styles.wrapper}>
      {result.is_correct ? (
        <MarkerTitle text={title} />
      ) : retry ? (
        <View style={styles.retryHeader}>
          <Mascot size={72} />
          <AppText variant="heading" size={40} accessibilityRole="header" style={styles.flex}>
            {title}
          </AppText>
        </View>
      ) : (
        <AppText variant="heading" size={44} accessibilityRole="header">
          {title}
        </AppText>
      )}

      {result.is_correct && result.coins_awarded > 0 ? <CoinBurst amount={result.coins_awarded} /> : null}
      {result.is_correct && result.finished && result.coins_awarded === 0 ? (
        <AppText variant="muted">Você já ganhou as moedas desta questão.</AppText>
      ) : null}
      {result.streak.bonus_awarded > 0 ? (
        <AppText variant="bold" style={{ color: colors.primary }}>
          {`Bônus de sequência: ${result.streak.bonus_awarded} moedas.`}
        </AppText>
      ) : null}

      {!result.is_correct && result.finished && result.correct_letter ? (
        <View style={[styles.answer, { backgroundColor: colors.highlight, borderColor: colors.border }]}>
          <View style={[styles.badge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <AppText variant="heading" size={28} style={styles.letter}>
              {result.correct_letter}
            </AppText>
          </View>
          {correctOption ? (
            <AppText variant="bold" size={18} style={[styles.flex, { color: colors.onHighlight }]}>
              {correctOption.text}
            </AppText>
          ) : null}
        </View>
      ) : null}

      {result.explanation ? (
        <PenCard>
          <AppText size={18}>{result.explanation}</AppText>
        </PenCard>
      ) : null}

      {children}

      {retry ? <Button title="Tentar de novo" onPress={onRetry} /> : <Button title={nextLabel} onPress={onNext} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing(4) },
  flex: { flex: 1 },
  titleWrap: { alignSelf: 'flex-start', paddingHorizontal: spacing(1) },
  marker: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: spacing(1),
    height: 16,
    borderRadius: radius.sm,
    transformOrigin: 'left center',
  },
  retryHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
  answer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    padding: spacing(3),
    borderWidth: 2,
    borderRadius: radius.md,
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: { lineHeight: 32, textAlign: 'center' },
});
