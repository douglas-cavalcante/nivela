import type { ApiCoinTransaction, CoinReason } from '@nivela/api-contract';
import { statementExcerpt } from 'src/shared/text/statement-excerpt';

export interface CoinTransactionRow {
  id: number;
  amount: number;
  reason: CoinReason;
  sourceId: number;
  createdAt: Date;
}

/** Entidades de origem das linhas de uma página, carregadas em lote. */
export interface CoinSources {
  statements: Map<number, string>;
  planTitles: Map<number, string>;
  rewardNames: Map<number, string>;
}

const MS_PER_DAY = 86_400_000;

/** `source_id` do bônus de sequência é o `dayNumber`; devolve `dd/mm/aaaa`. */
function formatDayNumber(dayNumber: number): string {
  const [year, month, day] = new Date(dayNumber * MS_PER_DAY)
    .toISOString()
    .slice(0, 10)
    .split('-');
  return `${day}/${month}/${year}`;
}

/** Fecha a frase com "." só se ela já não termina em pontuação (".", "!", "?" ou "…"), mesmo seguida de aspas ou fecha-parênteses. */
export function withFinalStop(text: string): string {
  const trimmed = text.trimEnd();
  return /[.!?…]["'”’)»\]]*$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function describe(row: CoinTransactionRow, sources: CoinSources): string {
  switch (row.reason) {
    case 'correct_answer': {
      const statement = sources.statements.get(row.sourceId);
      return statement
        ? withFinalStop(`Acerto: ${statementExcerpt(statement)}`)
        : 'Acerto.';
    }
    case 'plan_completed': {
      const title = sources.planTitles.get(row.sourceId);
      return title
        ? withFinalStop(`Plano concluído: ${title}`)
        : 'Plano concluído.';
    }
    case 'streak_bonus':
      return `Sequência de 7 dias (até ${formatDayNumber(row.sourceId)}).`;
    case 'redemption': {
      const name = sources.rewardNames.get(row.sourceId);
      return name ? withFinalStop(`Resgate: ${name}`) : 'Resgate.';
    }
    case 'refund': {
      const name = sources.rewardNames.get(row.sourceId);
      return name ? withFinalStop(`Estorno: ${name}`) : 'Estorno.';
    }
  }
}

export function presentCoinTransaction(
  row: CoinTransactionRow,
  sources: CoinSources,
): ApiCoinTransaction {
  return {
    id: row.id,
    amount: row.amount,
    reason: row.reason,
    description: describe(row, sources),
    created_at: row.createdAt.toISOString(),
  };
}
