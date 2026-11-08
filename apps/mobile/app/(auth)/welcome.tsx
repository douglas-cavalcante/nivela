import { spacing } from '@nivela/design-tokens';
import { StyleSheet, View } from 'react-native';
import { AppText } from 'src/components/AppText';
import { Mascot } from 'src/components/Mascot';
import { PaperBackground } from 'src/components/PaperBackground';
import { PenCard } from 'src/components/PenCard';

/** Provisória: as telas de entrar e criar conta chegam na próxima etapa. */
export default function WelcomeScreen() {
  return (
    <PaperBackground>
      <View style={styles.content}>
        <Mascot size={144} label="Rabisco, o lápis mascote do Nivela" />
        <AppText variant="heading" size={56} style={styles.center}>
          Nivela
        </AppText>
        <AppText variant="muted" style={styles.center}>
          Seu caderno de estudos, só que vivo.
        </AppText>
        <PenCard style={styles.card}>
          <AppText variant="bold">Em breve</AppText>
          <AppText variant="muted">Entrar e criar conta chegam na próxima etapa.</AppText>
        </PenCard>
      </View>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing(3), padding: spacing(6) },
  center: { textAlign: 'center' },
  card: { gap: spacing(1) },
});
