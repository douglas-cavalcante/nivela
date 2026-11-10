import type { SubjectIconKey } from '@nivela/api-contract';
import Svg, { Path } from 'react-native-svg';

const paths: Record<SubjectIconKey, string[]> = {
  calculator: [
    'M7 3H17A2 2 0 0 1 19 5V19A2 2 0 0 1 17 21H7A2 2 0 0 1 5 19V5A2 2 0 0 1 7 3Z',
    'M8 7H16',
    'M8 12H8.01',
    'M12 12H12.01',
    'M16 12H16.01',
    'M8 16H8.01',
    'M12 16H12.01',
    'M16 16H16.01',
  ],
  book: [
    'M12 6C10 4.5 6.5 4 3 4.5V19C6.5 18.5 10 19 12 20.5C14 19 17.5 18.5 21 19V4.5C17.5 4 14 4.5 12 6Z',
    'M12 6V20.5',
  ],
  flask: ['M9 3H15', 'M10 3V9L4.5 19A1.5 1.5 0 0 0 5.8 21H18.2A1.5 1.5 0 0 0 19.5 19L14 9V3', 'M7.5 15H16.5'],
  globe: ['M12 21A9 9 0 1 0 12 3A9 9 0 0 0 12 21Z', 'M3 12H21', 'M12 3C15 6 15 18 12 21', 'M12 3C9 6 9 18 12 21'],
  palette: [
    'M12 3A9 9 0 0 0 12 21C13.5 21 14 20 13.5 19C13 18 13.5 17 15 17H17A4 4 0 0 0 21 13C21 7.5 17 3 12 3Z',
    'M7.5 11H7.51',
    'M10 7.5H10.01',
    'M15 7.5H15.01',
  ],
  language: [
    'M4 5H13',
    'M8.5 3V5',
    'M6 5C6.5 9 9 12 12.5 13.5',
    'M11 5C10.5 9 8 12 4 14',
    'M12 21L16.5 10L21 21',
    'M13.8 17H19.2',
  ],
};

/** Ícones de traço das disciplinas (decorativos; o nome da disciplina já está no texto). */
export function SubjectIcon({ icon, color, size = 28 }: { icon: SubjectIconKey; color: string; size?: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinejoin="round"
      strokeLinecap="round"
      importantForAccessibility="no-hide-descendants"
    >
      {paths[icon].map((d) => (
        <Path key={d} d={d} />
      ))}
    </Svg>
  );
}
