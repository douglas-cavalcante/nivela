import Svg, { Path } from 'react-native-svg';

export type TabIconName = 'home' | 'study' | 'store' | 'profile';

const paths: Record<TabIconName, string[]> = {
  home: ['M3 11L12 3L21 11V21H15V14H9V21H3Z'],
  study: [
    'M12 6C10 4.5 6.5 4 3 4.5V19C6.5 18.5 10 19 12 20.5C14 19 17.5 18.5 21 19V4.5C17.5 4 14 4.5 12 6Z',
    'M12 6V20.5',
  ],
  store: ['M5 8H19L20 21H4Z', 'M9 8V6A3 3 0 0 1 15 6V8'],
  profile: ['M12 12A4 4 0 1 0 12 4A4 4 0 0 0 12 12Z', 'M4 21C4 16.5 8 14.5 12 14.5C16 14.5 20 16.5 20 21Z'],
};

/** Ícones de traço da barra de abas (desenho próprio, sem biblioteca de ícones). */
export function TabIcon({ name, color, size = 24 }: { name: TabIconName; color: string; size?: number }) {
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
    >
      {paths[name].map((d) => (
        <Path key={d} d={d} />
      ))}
    </Svg>
  );
}
