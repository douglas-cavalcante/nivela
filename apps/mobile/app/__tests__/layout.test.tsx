import { useFonts } from 'expo-font';
import { screen } from 'expo-router/testing-library';
import * as SplashScreen from 'expo-splash-screen';
import { renderApp } from 'src/test/render';

describe('carregamento das fontes', () => {
  beforeEach(() => jest.mocked(SplashScreen.hideAsync).mockClear());
  afterEach(() => jest.mocked(useFonts).mockReturnValue([true, null]));

  it('se uma fonte falha, o app abre mesmo assim e a splash some', async () => {
    jest.mocked(useFonts).mockReturnValue([false, new Error('fonte indisponível')]);

    await renderApp();

    expect(await screen.findByText('Oi! Bora nivelar?')).toBeTruthy();
    expect(SplashScreen.hideAsync).toHaveBeenCalled();
  });

  it('enquanto as fontes carregam, a splash continua', async () => {
    jest.mocked(useFonts).mockReturnValue([false, null]);

    await renderApp();

    expect(screen.queryByText('Oi! Bora nivelar?')).toBeNull();
    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
  });
});
