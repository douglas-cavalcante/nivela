// Ponto único de acesso ao react-native-reanimated: os componentes importam daqui, e os testes
// trocam este módulo por um dublê estático (src/test/setup.ts), já que o Reanimated real não roda no jest.
export {
  default as Animated,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
