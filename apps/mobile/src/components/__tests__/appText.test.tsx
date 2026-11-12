import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { AppText } from 'src/components/AppText';
import { ThemeProvider } from 'src/lib/theme/ThemeProvider';

function styleOf(testID: string) {
  return StyleSheet.flatten(screen.getByTestId(testID).props.style);
}

describe('AppText', () => {
  it('dá folga à direita ao título manuscrito, para o Android não cortar a última letra', async () => {
    await render(
      <ThemeProvider>
        <AppText variant="heading" size={40} testID="titulo">Oi!</AppText>
        <AppText testID="corpo">Texto</AppText>
      </ThemeProvider>,
    );
    expect(styleOf('titulo').paddingRight).toBe(6);
    expect(styleOf('corpo').paddingRight).toBeUndefined();
  });
});
