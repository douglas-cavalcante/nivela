import { resolveAssetUrl } from '@nivela/api-contract';
import type { ApiStoreReward } from '@nivela/api-contract';
import { radius, spacing } from '@nivela/design-tokens';
import { Image, StyleSheet, View } from 'react-native';
import { AppText } from 'src/components/AppText';
import { Button } from 'src/components/Button';
import { Mascot } from 'src/components/Mascot';
import { PenCard } from 'src/components/PenCard';
import { useTheme } from 'src/lib/theme/useTheme';

interface RewardCardProps {
  reward: ApiStoreReward;
  /** Saldo do aluno; `null` enquanto não carregou (vale o `affordable` da API). */
  balance: number | null;
  onRedeem: () => void;
}

const coinsLabel = (count: number): string => `${count} ${count === 1 ? 'moeda' : 'moedas'}`;

/** Cartão de caderno de um prêmio na vitrine: foto (ou mascote), nome, preço, estoque e "Resgatar". */
export function RewardCard({ reward, balance, onRedeem }: RewardCardProps) {
  const { colors } = useTheme();
  const imageUrl = resolveAssetUrl(process.env.EXPO_PUBLIC_API_URL ?? '', reward.image_url);
  const soldOut = reward.stock <= 0;
  const affordable = balance === null ? reward.affordable : balance >= reward.price;
  const missing = balance === null ? null : reward.price - balance;

  return (
    <PenCard style={styles.card}>
      <View style={[styles.photo, { backgroundColor: colors.background, borderColor: colors.rule }]}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" accessibilityLabel={reward.name} />
        ) : (
          <Mascot size={64} />
        )}
      </View>
      <AppText variant="bold" size={18}>
        {reward.name}
      </AppText>
      <AppText variant="bold" size={20} accessibilityLabel={`${coinsLabel(reward.price)}.`}>
        {`🪙 ${reward.price}`}
      </AppText>
      <AppText variant="muted">{soldOut ? 'Esgotado.' : `Restam ${reward.stock}.`}</AppText>
      {!soldOut && !affordable ? (
        <AppText variant="muted" style={{ color: colors.danger }}>
          {missing === null ? 'Saldo insuficiente.' : missing === 1 ? 'Falta 1 moeda.' : `Faltam ${missing} moedas.`}
        </AppText>
      ) : null}
      <Button
        title="Resgatar"
        accessibilityLabel={`Resgatar ${reward.name}`}
        disabled={soldOut || !affordable}
        onPress={onRedeem}
      />
    </PenCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing(2) },
  photo: {
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: radius.sm,
  },
  image: { width: '100%', height: '100%' },
});
