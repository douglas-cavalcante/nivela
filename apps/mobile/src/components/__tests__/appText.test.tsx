import { render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { AppText } from 'src/components/AppText';
import { ThemeProvider } from 'src/lib/theme/ThemeProvider';

describe('AppText', () => {
  const originalOS = Platform.OS;
  afterEach(() => {
    Platform.OS = originalOS;
  });

  it('no iOS não mexe no título manuscrito', async () => {
    Platform.OS = 'ios';
    await render(
      <ThemeProvider>
        <AppText variant="heading" size={40} testID="titulo">Oi!</AppText>
      </ThemeProvider>,
    );
    expect(screen.getByTestId('titulo').props.children).toBe('Oi!');
  });

  it('no Android acrescenta um espaço fino ao título manuscrito, para o Android não cortar a última letra', async () => {
    Platform.OS = 'android';
    await render(
      <ThemeProvider>
        <AppText variant="heading" size={40} testID="titulo">Oi!</AppText>
        <AppText testID="corpo">Texto</AppText>
      </ThemeProvider>,
    );
    expect(screen.getByTestId('titulo').props.children).toBe('Oi! ');
    expect(screen.getByTestId('corpo').props.children).toBe('Texto');
  });

  it('não mexe em children que não seja uma única string', async () => {
    Platform.OS = 'android';
    await render(
      <ThemeProvider>
        <AppText variant="heading" testID="composto">
          {'Oi, '}
          {'Davi!'}
        </AppText>
      </ThemeProvider>,
    );
    expect(screen.getByTestId('composto').props.children).toEqual(['Oi, ', 'Davi!']);
  });
});
