import { Menu, MenuItem } from '@mui/material';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
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
    expect(screen.getByText('Não deu para carregar.')).toBeInTheDocument();
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

describe('DataTable - casos de borda', () => {
  it('clique em botão dentro da linha não abre a linha', async () => {
    const onRowClick = vi.fn();
    const onEdit = vi.fn();
    const withAction = [...columns, { key: 'a', header: 'Ações', render: () => <button onClick={onEdit}>Editar</button> }];
    renderWithProviders(<DataTable {...base} columns={withAction} rows={rows} onRowClick={onRowClick} />);
    await userEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0]);
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('página vazia depois da primeira oferece voltar para a primeira', async () => {
    const onPageChange = vi.fn();
    renderWithProviders(
      <DataTable {...base} rows={[]} meta={{ page: 9, per_page: 15, total: 20, last_page: 2 }} onPageChange={onPageChange} />,
    );
    expect(screen.getByText('Esta página está vazia.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Voltar para a primeira página' }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });
});

describe('DataTable - portais', () => {
  it('clique num item de menu aberto de uma célula não abre a linha', async () => {
    const onRowClick = vi.fn();
    const onPick = vi.fn();
    function Cell() {
      const [anchor, setAnchor] = useState<HTMLElement | null>(null);
      return (
        <>
          <span>Mais</span>
          <Menu open anchorEl={anchor ?? document.body} onClose={() => setAnchor(null)}>
            <MenuItem onClick={onPick}>Duplicar</MenuItem>
          </Menu>
        </>
      );
    }
    const withMenu = [...columns, { key: 'm', header: 'Menu', render: () => <Cell /> }];
    renderWithProviders(<DataTable {...base} columns={withMenu} rows={[rows[0]]} onRowClick={onRowClick} />);
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Duplicar' }));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onRowClick).not.toHaveBeenCalled();
  });
});
