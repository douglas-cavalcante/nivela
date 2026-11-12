import { Typography } from '@mui/material';
import type { ApiCoinTransaction } from '@nivela/api-contract';
import { useState } from 'react';
import { DataTable } from 'src/components/DataTable';
import type { DataTableColumn } from 'src/components/DataTable';
import { listStudentCoinsAction } from 'src/features/dashboard/api/dashboard.action';
import { usePaginatedList } from 'src/hooks/usePaginatedList';
import { useNivelaColors } from 'src/lib/theme/useNivelaColors';
import { formatDate } from 'src/utils/format';

const PER_PAGE = 10;

/** Extrato de moedas de um aluno, paginado: +N em verde para créditos, −N em vermelho para débitos. */
export function CoinStatement({ studentId }: { studentId: number }) {
  const colors = useNivelaColors();
  const [page, setPage] = useState(1);
  const { rows, meta, loading, error, reload } = usePaginatedList(
    (signal) => listStudentCoinsAction(studentId, { page: page > 1 ? page : undefined, per_page: PER_PAGE }, signal),
    JSON.stringify([studentId, page]),
  );

  const columns: Array<DataTableColumn<ApiCoinTransaction>> = [
    {
      key: 'amount',
      header: 'Moedas',
      width: 110,
      render: (row) => (
        <Typography component="span" sx={{ fontWeight: 800, color: row.amount < 0 ? colors.danger : colors.success }}>
          {row.amount < 0 ? `−${Math.abs(row.amount)}` : `+${row.amount}`}
        </Typography>
      ),
    },
    { key: 'description', header: 'Descrição', render: (row) => row.description },
    { key: 'date', header: 'Data', width: 130, render: (row) => formatDate(row.created_at) },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowId={(row) => row.id}
      loading={loading}
      error={error}
      onRetry={() => void reload()}
      meta={meta}
      onPageChange={setPage}
      emptyTitle="Este aluno ainda não tem movimentações de moedas."
    />
  );
}
