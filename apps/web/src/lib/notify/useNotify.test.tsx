import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { NotifyProvider } from 'src/lib/notify/NotifyProvider';
import { useNotify } from 'src/lib/notify/useNotify';
import { ColorModeProvider } from 'src/lib/theme/ColorModeProvider';

function Buttons() {
  const notify = useNotify();
  return (
    <>
      <button onClick={() => notify.success('Salvo!')}>ok</button>
      <button onClick={() => notify.error('Deu ruim.')}>erro</button>
    </>
  );
}

const ui = (
  <ColorModeProvider>
    <NotifyProvider>
      <Buttons />
    </NotifyProvider>
  </ColorModeProvider>
);

describe('useNotify', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it('mostra o aviso de sucesso e ele some depois de 4 s', async () => {
    render(ui);
    await userEvent.click(screen.getByText('ok'));
    expect(await screen.findByText('Salvo!')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(4500);
    });
    await vi.waitFor(() => expect(screen.queryByText('Salvo!')).not.toBeInTheDocument());
  });

  it('anuncia o erro como alerta', async () => {
    render(ui);
    await userEvent.click(screen.getByText('erro'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Deu ruim.');
  });

  it('falha claramente fora do provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Buttons />)).toThrow('useNotify deve ser usado dentro de NotifyProvider');
  });
});
