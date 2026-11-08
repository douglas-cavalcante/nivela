import { screen } from 'expo-router/testing-library';
import { StyleSheet } from 'react-native';
import { renderApp } from 'src/test/render';
import { student } from 'src/test/users';

type Node = ReturnType<typeof screen.getByText>;

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 24 }),
}));

/** Sobe a partir de um elemento até achar o que tem a altura fixa da barra de abas. */
function findTabBar(from: Node): Node | null {
  for (let node: Node | null = from; node; node = node.parent) {
    const style = StyleSheet.flatten(node.props.style);
    if (style && typeof style.height === 'number' && style.borderTopWidth) return node;
  }
  return null;
}

describe('barra de abas', () => {
  it('respeita a área segura inferior (gestos do sistema)', async () => {
    await renderApp({ user: student });
    const bar = findTabBar(await screen.findByText('Estudar'));

    expect(bar).not.toBeNull();
    const style = StyleSheet.flatten(bar?.props.style);
    expect(style.height).toBe(68 + 24);
    expect(style.paddingBottom).toBe(24);
  });
});
