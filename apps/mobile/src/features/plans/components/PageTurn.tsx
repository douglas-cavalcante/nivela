import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { Animated, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'src/lib/motion';

/** A tela abre como uma página virando (gira a partir da esquerda); sem animação com "reduzir movimento". */
export function PageTurn({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const turn = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    // valores compartilhados do Reanimated são mutáveis por desenho
    // eslint-disable-next-line react-hooks/immutability
    turn.value = withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) });
  }, [turn, reduced]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.4 + 0.6 * turn.value,
    transform: [{ perspective: 900 }, { rotateY: `${(1 - turn.value) * -60}deg` }],
  }));
  return <Animated.View style={[styles.page, style]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, transformOrigin: 'left center' },
});
