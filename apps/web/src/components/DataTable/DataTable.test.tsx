import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { DataTable } from 'src/components/DataTable';
import { renderWithProviders } from 'src/test/render';

interface Row {
  id: number;
  name: string;
}

const columns = [{ key: 'name', header: 'Nome', render: (row: Row) => row.name }];
const rows: Row[] = [
  { id: 1, name: 'Matemática' },
  { id: 2, name: 'Português' },
];
const base = { columns, getRowId: (row: Row) => row.id, loading: false, emptyTitle: 'Nada por aqui' };

describe('DataTable', () => {
  it('renderiza cabeçalho e linhas', () => {
    renderWithProviders(<DataTable {...base} rows={rows} />);
    expect(screen.getByRole('columnheader', { name: 'Nome' })).toBeInTheDocument();
    expect(screen.getByText('Matemática')).toBeInTheDocument();
    expect(screen.getByText('Português')).toBeInTheDocument();
  });

  it('mostra carregando de forma acessível', () => {
    renderWithProviders(<DataTable {...base} rows={[]} loading />);
    expect(screen.getByRole('progressbar', { name: 'Carregando' })).toBeInTheDocument();
    expect(screen.queryByText('Nada por aqui')).not.toBeInTheDocument();
  });

  it('mostra o estado vazio', () => {
    renderWithProviders(<DataTable {...base} rows={[]} emptyDescription="Cadastre o primeiro." />);
    expect(screen.getByText('Nada por aqui')).toBeInTheDocument();
    expect(screen.getByText('Cadastre o primeiro.')).toBeInTheDocument();
  });

  it('mostra o erro e tenta de novo', async () => {
    const onRetry = vi.fn();
    renderWithProviders(<DataTable {...base} rows={[]} error="Não deu certo." onRetry={onRetry} />);
    expect(screen.getByText('Não deu certo.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('troca de página (a API conta de 1)', async () => {
    const onPageChange = vi.fn();
    renderWithProviders(
      <DataTable
        {...base}
        rows={rows}
        meta={{ page: 1, per_page: 15, total: 40, last_page: 3 }}
        onPageChange={onPageChange}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Ir para a próxima página' }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('mostra a paginação mesmo com uma página só, desde que haja meta', () => {
    renderWithProviders(<DataTable {...base} rows={rows} meta={{ page: 1, per_page: 15, total: 2, last_page: 1 }} />);
    expect(screen.getByText(/1–2 de 2/)).toBeInTheDocument();
  });

  it('abre a linha por clique e por teclado', async () => {
    const onRowClick = vi.fn();
    renderWithProviders(<DataTable {...base} rows={rows} onRowClick={onRowClick} />);
    const row = screen.getByRole('row', { name: /Português/ });
    await userEvent.click(within(row).getByText('Português'));
    expect(onRowClick).toHaveBeenLastCalledWith(rows[1]);
    row.focus();
    await userEvent.keyboard('{Enter}');
    expect(onRowClick).toHaveBeenCalledTimes(2);
  });
});
