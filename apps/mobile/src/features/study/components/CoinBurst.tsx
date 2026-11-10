import { spacing } from '@nivela/design-tokens';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Animated,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'src/lib/motion';
import { AppText } from 'src/components/AppText';
import { useTheme } from 'src/lib/theme/useTheme';

/** Cada moeda sai do texto e sobe, abrindo para o lado do contador (canto de cima). */
const FLIGHTS = [
  { x: 40, y: -110 },
  { x: 90, y: -140 },
  { x: 140, y: -120 },
  { x: 20, y: -150 },
  { x: 110, y: -170 },
  { x: 160, y: -150 },
] as const;

function FlyingCoin({ x, y, index }: { x: number; y: number; index: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    // valores compartilhados do Reanimated são mutáveis por desenho
    // eslint-disable-next-line react-hooks/immutability
    progress.value = withDelay(index * 70, withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) }));
  }, [progress, index]);
  const style = useAnimatedStyle(() => ({
    opacity: 1 - progress.value * progress.value,
    transform: [
      { translateX: x * progress.value },
      { translateY: y * progress.value },
      { scale: 1 - progress.value * 0.4 },
    ],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.coin, style]}>
      <AppText size={22}>🪙</AppText>
    </Animated.View>
  );
}

/**
 * "+10 🪙" com moedas voando em direção ao contador. Com "reduzir movimento" ligado,
 * só o texto aparece, parado.
 */
export function CoinBurst({ amount }: { amount: number }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const pop = useSharedValue(reduced ? 1 : 0.5);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    if (!reduced) pop.value = withSequence(withTiming(1.2, { duration: 180 }), withTiming(1, { duration: 140 }));
  }, [pop, reduced]);
  const popStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }],
  }));

  return (
    <View style={styles.wrapper} accessible accessibilityLabel={`Você ganhou ${amount} moedas.`}>
      {reduced ? null : FLIGHTS.map((flight, index) => <FlyingCoin key={index} index={index} {...flight} />)}
      <Animated.View
        style={[styles.badge, { backgroundColor: colors.highlight, borderColor: colors.border }, popStyle]}
      >
        <AppText variant="bold" size={24} style={{ color: colors.onHighlight }}>
          {`+${amount} 🪙`}
        </AppText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignSelf: 'flex-start' },
  coin: { position: 'absolute', left: spacing(4), top: 0 },
  badge: {
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(1.5),
    borderWidth: 2,
    borderRadius: 999,
  },
});
