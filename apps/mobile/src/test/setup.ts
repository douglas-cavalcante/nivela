// Infra comum dos testes: SecureStore em memória e API apontando para um host falso.
process.env.EXPO_PUBLIC_API_URL = 'http://api.test/api/v1';

const mockStore = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockStore.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockStore.delete(key);
  }),
}));

beforeEach(() => mockStore.clear());

// Fontes e splash: nos testes as fontes contam como carregadas.
jest.mock('expo-font', () => ({
  ...jest.requireActual('expo-font'),
  useFonts: jest.fn(() => [true, null]),
}));

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(async () => true),
  hideAsync: jest.fn(async () => true),
}));

// Animações: nos testes `src/lib/motion` vira um dublê estático (sem worklets) e "reduzir movimento"
// fica ligado, então nada se move e os testes são determinísticos.
jest.mock('src/lib/motion', () => {
  const identity = <T>(value: T): T => value;
  const { View, Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Animated: { View, Text },
    useReducedMotion: () => true,
    useSharedValue: <T>(value: T) => ({ value }),
    useAnimatedStyle: () => ({}),
    withTiming: identity,
    withDelay: (_delay: number, value: unknown) => value,
    withSequence: (...values: unknown[]) => values[values.length - 1],
    Easing: { out: identity, cubic: identity },
  };
});
