import { spacing } from '@nivela/design-tokens';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { AppText } from 'src/components/AppText';
import { Button } from 'src/components/Button';
import { PaperBackground } from 'src/components/PaperBackground';
import { MyPlans } from 'src/features/plans';
import { StatsBar } from 'src/features/study';
import { useAuth } from 'src/lib/auth/AuthContext';

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const firstName = user?.name.split(' ')[0];

  return (
    <PaperBackground>
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="heading" size={40}>
          {firstName ? `Oi, ${firstName}!` : 'Oi!'}
        </AppText>
        <StatsBar />
        <MyPlans />
        <Button title="Praticar agora" onPress={() => router.push('/study')} />
      </ScrollView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing(4), padding: spacing(5), paddingBottom: spacing(10) },
});
