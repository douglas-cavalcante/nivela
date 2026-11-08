import {
  Box,
  Button,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { penShadow } from '@nivela/design-tokens';
import type { PaginationMeta } from '@nivela/api-contract';
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { EmptyState } from 'src/components/EmptyState';
import { useNivelaColors } from 'src/lib/theme/useNivelaColors';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  width?: number;
}

interface DataTableProps<T> {
  columns: Array<DataTableColumn<T>>;
  rows: T[];
  getRowId: (row: T) => number;
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
  meta?: PaginationMeta;
  /** Recebe a página no formato da API (começa em 1). */
  onPageChange?: (page: number) => void;
  emptyTitle: string;
  emptyDescription?: string;
  onRowClick?: (row: T) => void;
}

const INTERACTIVE = 'button, a, input, select, textarea, [role="button"], [role="checkbox"], [role="switch"], [role="menuitem"], [role="tab"], [role="option"]';

const paginationLabels = {
  getItemAriaLabel: (type: 'first' | 'last' | 'next' | 'previous') =>
    ({
      first: 'Ir para a primeira página',
      last: 'Ir para a última página',
      next: 'Ir para a próxima página',
      previous: 'Ir para a página anterior',
    })[type],
  labelDisplayedRows: ({ from, to, count }: { from: number; to: number; count: number }) => `${from}–${to} de ${count}`,
};

/** Tabela de cadastros: cabeçalho "de caneta", linhas pautadas, paginação da API e estados de carga, vazio e erro. */
export function DataTable<T>({
  columns,
  rows,
  getRowId,
  loading,
  error,
  onRetry,
  meta,
  onPageChange,
  emptyTitle,
  emptyDescription,
  onRowClick,
}: DataTableProps<T>) {
  const colors = useNivelaColors();

  if (error) {
    return (
      <EmptyState
        title="Não deu para carregar"
        description={error}
        action={
          onRetry ? (
            <Button variant="contained" onClick={onRetry}>
              Tentar de novo
            </Button>
          ) : undefined
        }
      />
    );
  }

  if (loading && rows.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress aria-label="Carregando" />
      </Box>
    );
  }

  if (!loading && rows.length === 0) {
    // página vazia além da primeira (?page=9 antigo, última linha excluída): oferece o caminho de volta
    if (meta && meta.page > 1 && onPageChange) {
      return (
        <EmptyState
          title="Esta página está vazia"
          description="Não há registros nesta página."
          action={
            <Button variant="contained" onClick={() => onPageChange(1)}>
              Voltar para a primeira página
            </Button>
          }
        />
      );
    }
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  function handleClick(event: MouseEvent<HTMLTableRowElement>, row: T) {
    // cliques em botões, links e campos da linha são deles, não da linha
    if (!event.currentTarget.contains(event.target as Node)) return; // clique vindo de um portal (menu, popover)
    const inner = (event.target as Element).closest(INTERACTIVE);
    if (inner && event.currentTarget.contains(inner)) return;
    onRowClick?.(row);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTableRowElement>, row: T) {
    if (event.target !== event.currentTarget) return; // Enter em botão/link da linha não abre a linha
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onRowClick?.(row);
    }
  }

  return (
    <Box
      sx={{
        border: `${penShadow.width}px solid ${colors.border}`,
        borderRadius: 2,
        boxShadow: `${penShadow.offset}px ${penShadow.offset}px 0 ${colors.shadow}`,
        backgroundColor: 'background.paper',
        overflow: 'hidden',
        opacity: loading ? 0.6 : 1,
        transition: 'opacity 120ms ease',
      }}
      aria-busy={loading}
    >
      <TableContainer>
        <Table size="medium">
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell
                  key={column.key}
                  sx={{
                    width: column.width,
                    borderBottom: `${penShadow.width}px solid ${colors.border}`,
                    backgroundColor: alpha(colors.highlight, 0.18),
                    fontWeight: 800,
                  }}
                >
                  {column.header}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={getRowId(row)}
                hover={Boolean(onRowClick)}
                tabIndex={onRowClick ? 0 : undefined}
                onClick={onRowClick ? (event) => handleClick(event, row) : undefined}
                onKeyDown={onRowClick ? (event) => handleKeyDown(event, row) : undefined}
                sx={{
                  cursor: onRowClick ? 'pointer' : undefined,
                  '&:nth-of-type(even)': { backgroundColor: colors.rule },
                  '&:last-child td': { borderBottom: 0 },
                }}
              >
                {columns.map((column) => (
                  <TableCell key={column.key}>{column.render(row)}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {meta ? (
        <TablePagination
          component="div"
          count={meta.total}
          page={Math.max(meta.page - 1, 0)}
          rowsPerPage={meta.per_page}
          rowsPerPageOptions={[]}
          onPageChange={(_event, zeroBased) => onPageChange?.(zeroBased + 1)}
          showFirstButton
          showLastButton
          getItemAriaLabel={paginationLabels.getItemAriaLabel}
          labelDisplayedRows={paginationLabels.labelDisplayedRows}
          slotProps={{ actions: { nextButton: { color: 'inherit' }, previousButton: { color: 'inherit' } } }}
          sx={{ borderTop: `1px solid ${colors.border}` }}
        />
      ) : null}
    </Box>
  );
}
