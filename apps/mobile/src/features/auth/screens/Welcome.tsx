import { spacing } from '@nivela/design-tokens';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { AppText } from 'src/components/AppText';
import { Button } from 'src/components/Button';
import { HandTitle } from 'src/components/HandTitle';
import { Mascot } from 'src/components/Mascot';
import { PaperBackground } from 'src/components/PaperBackground';

export function Welcome() {
  const router = useRouter();

  return (
    <PaperBackground>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Mascot size={200} label="Rabisco, o lápis mascote do Nivela" />
          <HandTitle size={52}>Oi! Bora nivelar?</HandTitle>
          <AppText variant="muted" size={17} style={styles.center}>
            Seu caderno de estudos, só que vivo.
          </AppText>
        </View>
        <View style={styles.actions}>
          <Button title="Entrar" onPress={() => router.push('/login')} />
          <Button title="Tenho um código de turma" variant="secondary" onPress={() => router.push('/register')} />
        </View>
      </ScrollView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'space-between', gap: spacing(8), padding: spacing(6), paddingBottom: spacing(10) },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing(4) },
  center: { textAlign: 'center' },
  actions: { gap: spacing(4) },
});
