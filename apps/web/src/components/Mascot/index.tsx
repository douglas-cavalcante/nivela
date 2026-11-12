import { brand, mascot } from '@nivela/design-tokens';
import { useNivelaColors } from 'src/lib/theme/useNivelaColors';

interface MascotProps {
  size?: number;
  /** Texto alternativo. Sem ele o desenho é decorativo e fica oculto para leitores de tela. */
  title?: string;
}

/** "Rabisco", o lápis mascote. No tema escuro o traço de tinta vira o tom claro do texto. */
export function Mascot({ size = 96, title }: MascotProps) {
  const colors = useNivelaColors();
  const paint = (key: keyof typeof brand): string => (key === 'ink' ? colors.text : brand[key]);

  return (
    <svg
      viewBox={mascot.viewBox}
      width={size}
      height={size}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      strokeWidth={2}
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      {title ? <title>{title}</title> : null}
      {mascot.shapes.map((shape, index) => (
        <path
          key={index}
          d={shape.d}
          fill={shape.fill === 'none' ? 'none' : paint(shape.fill)}
          stroke={shape.stroke ? paint(shape.stroke) : 'none'}
        />
      ))}
    </svg>
  );
}
