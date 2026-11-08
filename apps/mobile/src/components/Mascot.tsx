import { brand, mascot } from '@nivela/design-tokens';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from 'src/lib/theme/useTheme';

interface MascotProps {
  size?: number;
  /** Texto alternativo. Sem ele o desenho é decorativo e fica oculto para leitores de tela. */
  label?: string;
}

/** "Rabisco", o lápis mascote. No tema escuro o traço de tinta vira o tom claro do texto. */
export function Mascot({ size = 96, label }: MascotProps) {
  const { colors } = useTheme();
  const paint = (key: keyof typeof brand): string => (key === 'ink' ? colors.text : brand[key]);

  return (
    <Svg
      viewBox={mascot.viewBox}
      width={size}
      height={size}
      accessible={Boolean(label)}
      accessibilityRole={label ? 'image' : undefined}
      accessibilityLabel={label}
      importantForAccessibility={label ? 'yes' : 'no-hide-descendants'}
      strokeWidth={2}
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      {mascot.shapes.map((shape, index) => (
        <Path
          key={index}
          d={shape.d}
          fill={shape.fill === 'none' ? 'none' : paint(shape.fill)}
          stroke={shape.stroke ? paint(shape.stroke) : 'none'}
        />
      ))}
    </Svg>
  );
}
