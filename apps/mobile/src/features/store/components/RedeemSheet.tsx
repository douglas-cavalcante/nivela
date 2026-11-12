import type { ApiStoreReward } from '@nivela/api-contract';
import { radius, spacing } from '@nivela/design-tokens';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { AppText } from 'src/components/AppText';
import { Button } from 'src/components/Button';
import { useTheme } from 'src/lib/theme/useTheme';

interface RedeemSheetProps {
  reward: ApiStoreReward | null;
  loading: boolean;
  /** Erro que mantém a folha aberta (ex.: sem internet); o 409 fecha a folha e aparece na tela. */
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Folha de confirmação: "Trocar N moedas por <prêmio>?" antes de gastar as moedas. */
export function RedeemSheet({ reward, loading, error, onConfirm, onCancel }: RedeemSheetProps) {
  const { colors } = useTheme();
  if (reward === null) return null;
  const coins = `${reward.price} ${reward.price === 1 ? 'moeda' : 'moedas'}`;

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fechar confirmação."
          style={[styles.backdrop, { backgroundColor: colors.shadow }]}
          onPress={loading ? undefined : onCancel}
        />
        <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <AppText variant="heading" size={32} accessibilityRole="header">
            {`Trocar ${coins} por ${reward.name}?`}
          </AppText>
          <AppText variant="muted">O professor entrega o prêmio na escola.</AppText>
          {error ? (
            <AppText accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: colors.danger }}>
              {error}
            </AppText>
          ) : null}
          <Button title="Confirmar" loading={loading} onPress={onConfirm} />
          <Button title="Cancelar" variant="outline" disabled={loading} onPress={onCancel} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, opacity: 0.4 },
  sheet: {
    gap: spacing(3),
    padding: spacing(5),
    paddingBottom: spacing(8),
    borderWidth: 2,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
});
