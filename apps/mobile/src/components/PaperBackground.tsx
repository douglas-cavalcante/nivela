import { spacing } from '@nivela/design-tokens';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Line } from 'react-native-svg';
import { useTheme } from 'src/lib/theme/useTheme';

const LINE_GAP = spacing(7);
const MARGIN_X = spacing(11);

interface PaperBackgroundProps {
  children: ReactNode;
}

/** Fundo de caderno: papel com pauta horizontal e a linha vertical da margem. */
export function PaperBackground({ children }: PaperBackgroundProps) {
  const { colors } = useTheme();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const lines = Math.floor(size.height / LINE_GAP);

  return (
    <View
      style={[styles.fill, { backgroundColor: colors.background }]}
      onLayout={({ nativeEvent }) => setSize(nativeEvent.layout)}
    >
      <Svg
        width={size.width}
        height={size.height}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
        importantForAccessibility="no-hide-descendants"
      >
        {Array.from({ length: lines }, (_, index) => {
          const y = (index + 1) * LINE_GAP;
          return <Line key={index} x1={0} x2={size.width} y1={y} y2={y} stroke={colors.rule} strokeWidth={1} />;
        })}
        <Line
          x1={MARGIN_X}
          x2={MARGIN_X}
          y1={0}
          y2={size.height}
          stroke={colors.secondary}
          strokeWidth={1}
          opacity={0.4}
        />
      </Svg>
      <SafeAreaView style={styles.fill} edges={['top', 'left', 'right']}>
        {children}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
