import { resolveAssetUrl } from '@nivela/api-contract';
import type { ApiMyRedemption, RedemptionStatus } from '@nivela/api-contract';
import { radius, spacing } from '@nivela/design-tokens';
import { Image, StyleSheet, View } from 'react-native';
import { AppText } from 'src/components/AppText';
import { Mascot } from 'src/components/Mascot';
import { PenCard } from 'src/components/PenCard';
import { formatDay } from 'src/features/store/format';
import { useServerUrl } from 'src/lib/server-url';
import { useTheme } from 'src/lib/theme/useTheme';

const STATUS_LABEL: Record<RedemptionStatus, string> = {
  pending: 'Pendente',
  delivered: 'Entregue',
  rejected: 'Recusado',
};

/** Uma linha de "Meus resgates": prêmio, preço pago, data e o estado (com o motivo se recusado). */
export function RedemptionRow({ redemption }: { redemption: ApiMyRedemption }) {
  const { colors } = useTheme();
  const { url: apiUrl } = useServerUrl();
  const imageUrl = resolveAssetUrl(apiUrl, redemption.reward.image_url);
  const chip = {
    pending: { background: colors.highlight, text: colors.onHighlight },
    delivered: { background: colors.success, text: colors.onSuccess },
    rejected: { background: colors.danger, text: colors.onDanger },
  }[redemption.status];

  return (
    <PenCard style={styles.card}>
      <View style={[styles.photo, { backgroundColor: colors.background, borderColor: colors.rule }]}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" accessibilityLabel={redemption.reward.name} />
        ) : (
          <Mascot size={40} />
        )}
      </View>
      <View style={styles.text}>
        <AppText variant="bold" size={18}>
          {redemption.reward.name}
        </AppText>
        <AppText variant="muted">{`${formatDay(redemption.created_at)} · 🪙 ${redemption.price_paid}`}</AppText>
        <View style={[styles.chip, { backgroundColor: chip.background, borderColor: colors.border }]}>
          <AppText variant="bold" style={{ color: chip.text }}>
            {STATUS_LABEL[redemption.status]}
          </AppText>
        </View>
        {redemption.status === 'rejected' && redemption.rejection_reason ? (
          <AppText>{`Motivo: ${redemption.rejection_reason}`}</AppText>
        ) : null}
      </View>
    </PenCard>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: spacing(3), alignItems: 'flex-start' },
  photo: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: radius.sm,
  },
  image: { width: '100%', height: '100%' },
  text: { flex: 1, gap: spacing(1) },
  chip: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing(3),
    borderWidth: 2,
    borderRadius: radius.pill,
  },
});
