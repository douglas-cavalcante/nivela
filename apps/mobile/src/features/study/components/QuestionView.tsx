import { resolveAssetUrl } from '@nivela/api-contract';
import type { ApiStudentQuestion, OptionLetter } from '@nivela/api-contract';
import { radius, spacing } from '@nivela/design-tokens';
import { useRef, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import { AppText } from 'src/components/AppText';
import { Button } from 'src/components/Button';
import { PenCard } from 'src/components/PenCard';
import { OptionButton } from 'src/features/study/components/OptionButton';
import { useTheme } from 'src/lib/theme/useTheme';

interface QuestionViewProps {
  question: ApiStudentQuestion;
  /** Envia a resposta; a tela de cima decide o que mostrar depois (nunca deve lançar erro). */
  onAnswer: (letter: OptionLetter) => Promise<void>;
  /** Bloqueia a escolha (ex.: enquanto outra coisa está carregando). */
  disabled?: boolean;
}

const TEXT_SIZES = [18, 20, 24, 28] as const;
const DEFAULT_SIZE_INDEX = 1;

/**
 * Enunciado, imagem opcional (toque para ampliar) e as alternativas A–E.
 * O botão "Responder" só aparece com uma alternativa escolhida.
 * Reutilizado pelo fluxo dos planos (Task 10): não conhece prática nem capítulo.
 */
export function QuestionView({ question, onAnswer, disabled = false }: QuestionViewProps) {
  const { colors } = useTheme();
  const [selected, setSelected] = useState<OptionLetter | null>(null);
  const [busy, setBusy] = useState(false);
  const [sizeIndex, setSizeIndex] = useState(DEFAULT_SIZE_INDEX);
  const submitting = useRef(false);
  const [zoomed, setZoomed] = useState(false);
  const imageUrl = resolveAssetUrl(process.env.EXPO_PUBLIC_API_URL ?? '', question.image_url);
  const locked = disabled || busy;
  const fontSize = TEXT_SIZES[sizeIndex];

  const submit = async () => {
    // o ref barra um 2º toque antes de o estado `busy` renderizar
    if (!selected || locked || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    try {
      await onAnswer(selected);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrapper}>
      <PenCard style={styles.statementCard}>
        <View style={styles.sizeRow}>
          <AppText variant="muted" size={14}>
            {`Dificuldade: ${difficultyLabel[question.difficulty]}.`}
          </AppText>
          <View style={styles.sizeButtons}>
            <SizeButton
              label="Diminuir o texto."
              symbol="A-"
              disabled={sizeIndex === 0}
              onPress={() => setSizeIndex((index) => Math.max(0, index - 1))}
            />
            <SizeButton
              label="Aumentar o texto."
              symbol="A+"
              disabled={sizeIndex === TEXT_SIZES.length - 1}
              onPress={() => setSizeIndex((index) => Math.min(TEXT_SIZES.length - 1, index + 1))}
            />
          </View>
        </View>
        <AppText size={fontSize}>{question.statement}</AppText>
        {imageUrl ? (
          <Pressable
            accessibilityRole="imagebutton"
            accessibilityLabel="Ampliar a imagem da questão."
            onPress={() => setZoomed(true)}
          >
            <Image
              testID="question-image"
              source={{ uri: imageUrl }}
              style={[styles.image, { borderColor: colors.border }]}
              resizeMode="contain"
            />
          </Pressable>
        ) : null}
      </PenCard>

      {question.attempts_left === 1 ? (
        <AppText variant="bold" style={{ color: colors.danger }} accessibilityLiveRegion="polite">
          Última tentativa.
        </AppText>
      ) : null}

      <View accessibilityRole="radiogroup" style={styles.options}>
        {question.options.map((option) => (
          <OptionButton
            key={option.letter}
            letter={option.letter}
            text={option.text}
            selected={selected === option.letter}
            disabled={locked}
            onPress={() => setSelected(option.letter)}
          />
        ))}
      </View>

      {selected ? <Button title="Responder" loading={busy} disabled={disabled} onPress={() => void submit()} /> : null}

      <Modal visible={zoomed} transparent animationType="fade" onRequestClose={() => setZoomed(false)}>
        <View style={[styles.modal, { backgroundColor: colors.shadow }]}>
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={styles.zoomImage}
              resizeMode="contain"
              accessibilityLabel="Imagem da questão ampliada."
            />
          ) : null}
          <Button title="Fechar imagem." variant="outline" onPress={() => setZoomed(false)} />
        </View>
      </Modal>
    </View>
  );
}

const difficultyLabel: Record<ApiStudentQuestion['difficulty'], string> = {
  easy: 'fácil',
  medium: 'média',
  hard: 'difícil',
};

function SizeButton({
  label,
  symbol,
  disabled,
  onPress,
}: {
  label: string;
  symbol: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={[styles.sizeButton, { borderColor: colors.border, opacity: disabled ? 0.4 : 1 }]}
    >
      <AppText variant="bold" size={14}>
        {symbol}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing(4) },
  statementCard: { gap: spacing(3) },
  sizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sizeButtons: { flexDirection: 'row', gap: spacing(2) },
  sizeButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderRadius: radius.sm,
  },
  image: {
    width: '100%',
    height: 200,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  options: { gap: spacing(3) },
  modal: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(4),
    padding: spacing(4),
  },
  zoomImage: { width: '100%', height: '75%' },
});
