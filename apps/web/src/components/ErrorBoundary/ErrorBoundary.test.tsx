import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { lazy, Suspense } from 'react';
import { vi } from 'vitest';
import { ErrorBoundary } from 'src/components/ErrorBoundary';
import { renderWithProviders } from 'src/test/render';

describe('ErrorBoundary', () => {
  afterEach(() => vi.restoreAllMocks());

  it('mostra o aviso e recarrega quando um chunk lazy falha', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const Broken = lazy(() => Promise.reject(new Error('Failed to fetch dynamically imported module')));
    const onReload = vi.fn();

    renderWithProviders(
      <ErrorBoundary onReload={onReload}>
        <Suspense fallback="carregando">
          <Broken />
        </Suspense>
      </ErrorBoundary>,
    );

    expect(await screen.findByText('Não foi possível carregar esta página.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Recarregar' }));
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it('não interfere quando tudo carrega', () => {
    renderWithProviders(<ErrorBoundary>conteúdo</ErrorBoundary>);
    expect(screen.getByText('conteúdo')).toBeInTheDocument();
  });
});
