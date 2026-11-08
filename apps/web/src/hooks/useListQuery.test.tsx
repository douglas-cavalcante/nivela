import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { useListQuery } from 'src/hooks/useListQuery';
import { renderWithProviders } from 'src/test/render';

const defaults = { search: '', subject_id: '' };

function Probe() {
  const { page, filters, setPage, setFilter } = useListQuery(defaults);
  const location = useLocation();
  return (
    <>
      <output aria-label="estado">{JSON.stringify({ page, filters })}</output>
      <output aria-label="url">{location.search}</output>
      <button onClick={() => setFilter('search', 'y')}>buscar y</button>
      <button onClick={() => setFilter('search', '')}>limpar busca</button>
      <button onClick={() => setPage(4)}>pagina 4</button>
      <button onClick={() => setPage(1)}>pagina 1</button>
    </>
  );
}

const state = () => JSON.parse(screen.getByLabelText('estado').textContent ?? '{}');
const url = () => screen.getByLabelText('url').textContent;

describe('useListQuery', () => {
  it('usa os padrões sem query string', () => {
    renderWithProviders(<Probe />);
    expect(state()).toEqual({ page: 1, filters: { search: '', subject_id: '' } });
  });

  it('lê página e filtros da URL', () => {
    renderWithProviders(<Probe />, { route: '/?page=3&search=x' });
    expect(state()).toEqual({ page: 3, filters: { search: 'x', subject_id: '' } });
  });

  it('ignora página inválida', () => {
    renderWithProviders(<Probe />, { route: '/?page=abc' });
    expect(state().page).toBe(1);
  });

  it('trocar o filtro volta para a página 1 e preserva parâmetros desconhecidos', async () => {
    renderWithProviders(<Probe />, { route: '/?page=3&subject_id=3&extra=1' });
    await userEvent.click(screen.getByText('buscar y'));
    const params = new URLSearchParams(url() ?? '');
    expect(params.get('search')).toBe('y');
    expect(params.get('subject_id')).toBe('3');
    expect(params.get('extra')).toBe('1');
    expect(params.has('page')).toBe(false);
  });

  it('fica só search=y quando não há outros parâmetros', async () => {
    renderWithProviders(<Probe />, { route: '/?page=3' });
    await userEvent.click(screen.getByText('buscar y'));
    expect(url()).toBe('?search=y');
  });

  it('filtro vazio sai da URL', async () => {
    renderWithProviders(<Probe />, { route: '/?search=x' });
    await userEvent.click(screen.getByText('limpar busca'));
    expect(url()).toBe('');
  });

  it('setPage grava a página e a página 1 sai da URL', async () => {
    renderWithProviders(<Probe />, { route: '/?search=x' });
    await userEvent.click(screen.getByText('pagina 4'));
    expect(url()).toBe('?search=x&page=4');
    await userEvent.click(screen.getByText('pagina 1'));
    expect(url()).toBe('?search=x');
  });
});
