import { screen } from '@testing-library/react-native';
import { renderApp } from 'src/test/render';

describe('boas-vindas', () => {
  it('o título manuscrito é anunciado como cabeçalho', async () => {
    await renderApp({ initialUrl: '/welcome' });

    expect(await screen.findByRole('header', { name: 'Oi! Bora nivelar?' })).toBeTruthy();
  });
});
