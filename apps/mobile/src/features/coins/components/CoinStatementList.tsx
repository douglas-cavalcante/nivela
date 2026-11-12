import type { ApiCoinTransaction } from '@nivela/api-contract';
import { spacing } from '@nivela/design-tokens';
import { StyleSheet, View } from 'react-native';
import { AppText } from 'src/components/AppText';
import { formatAmount, formatDate } from 'src/features/coins/format';
import { useTheme } from 'src/lib/theme/useTheme';

/** Linhas do extrato: +N em verde, −N em vermelho, com a descrição e a data. */
export function CoinStatementList({ transactions }: { transactions: ApiCoinTransaction[] }) {
  const { colors } = useTheme();
  return (
    <View>
      {transactions.map((transaction) => (
        <View key={transaction.id} style={[styles.row, { borderBottomColor: colors.rule }]}>
          <View style={styles.text}>
            <AppText>{transaction.description}</AppText>
            <AppText variant="muted" size={14}>
              {formatDate(transaction.created_at)}
            </AppText>
          </View>
          <AppText variant="bold" size={18} style={{ color: transaction.amount < 0 ? colors.danger : colors.success }}>
            {formatAmount(transaction.amount)}
          </AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingVertical: spacing(2),
    borderBottomWidth: 1,
  },
  text: { flex: 1 },
});
