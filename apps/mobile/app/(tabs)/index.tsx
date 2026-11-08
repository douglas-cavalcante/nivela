import { spacing } from '@nivela/design-tokens';
import { StyleSheet, View } from 'react-native';
import { AppText } from 'src/components/AppText';
import { EmptyState } from 'src/components/EmptyState';
import { PaperBackground } from 'src/components/PaperBackground';
import { PenCard } from 'src/components/PenCard';
import { useAuth } from 'src/lib/auth/AuthContext';

export default function HomeScreen() {
  const { user } = useAuth();
  const firstName = user?.name.split(' ')[0];

  return (
    <PaperBackground>
      <View style={styles.content}>
        <AppText variant="heading" size={40}>
          {firstName ? `Olá, ${firstName}!` : 'Olá!'}
        </AppText>
        <PenCard>
          <EmptyState title="Seu caderno está vazio" description="Seus planos de estudo vão aparecer aqui." />
        </PenCard>
      </View>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({ content: { flex: 1, gap: spacing(4), padding: spacing(5) } });
