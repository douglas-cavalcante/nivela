import { render, screen } from '@testing-library/react-native';
import { AppText } from 'src/components/AppText';
import { ThemeProvider } from 'src/lib/theme/ThemeProvider';

describe('AppText', () => {
  it('acrescenta um espaço fino ao título manuscrito, para o Android não cortar a última letra', async () => {
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
