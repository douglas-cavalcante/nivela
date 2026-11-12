import { spacing } from '@nivela/design-tokens';
import { useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AppText } from 'src/components/AppText';
import { Button } from 'src/components/Button';
import { EmptyState } from 'src/components/EmptyState';
import { listMyPlansAction } from 'src/features/plans/api/plans.action';
import { PlanCard } from 'src/features/plans/components/PlanCard';
import { useReloadOnFocus } from 'src/hooks/useReloadOnFocus';
import { useRemote } from 'src/hooks/useRemote';
import { useTheme } from 'src/lib/theme/useTheme';

/** "Meus planos" do Início: os planos enviados pelo professor, com o progresso do aluno. */
export function MyPlans() {
  const { colors } = useTheme();
  const router = useRouter();
  const { data, loading, error, reload } = useRemote('my-plans', (signal) => listMyPlansAction(signal));
  useReloadOnFocus(reload);
  const loadError = loading ? null : error;

  return (
    <View style={styles.section}>
      <AppText variant="heading" size={32}>
        Meus planos
      </AppText>
      {loadError ? (
        <View style={styles.gap}>
          <AppText accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: colors.danger }}>
            {loadError}
          </AppText>
          <Button title="Tentar de novo" variant="outline" onPress={reload} />
        </View>
      ) : data === null ? (
        <ActivityIndicator accessibilityLabel="Carregando planos" color={colors.primary} />
      ) : data.length === 0 ? (
        <EmptyState title="Seus planos aparecem aqui quando o professor enviar." />
      ) : (
        data.map((plan) => <PlanCard key={plan.id} plan={plan} onPress={() => router.push(`/plans/${plan.id}`)} />)
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing(3) },
  gap: { gap: spacing(2) },
});
