import { spacing } from '@nivela/design-tokens';
import { ScrollView, StyleSheet, View } from 'react-native';
import { AppText } from 'src/components/AppText';
import { Button } from 'src/components/Button';
import { HandTitle } from 'src/components/HandTitle';
import { Mascot } from 'src/components/Mascot';
import { PaperBackground } from 'src/components/PaperBackground';

interface OfflineScreenProps {
  onRetry: () => void;
  retrying?: boolean;
}

/** Tela mostrada quando a API não responde: a sessão salva continua e a pessoa tenta de novo. */
export function OfflineScreen({ onRetry, retrying = false }: OfflineScreenProps) {
  return (
    <PaperBackground>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Mascot size={160} />
          <HandTitle size={40}>Sem conexão com o servidor.</HandTitle>
          <AppText variant="muted" size={17} style={styles.center}>
            Confira sua internet e tente de novo. Sua sessão continua salva.
          </AppText>
        </View>
        <Button title="Tentar de novo" loading={retrying} onPress={onRetry} />
      </ScrollView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'space-between', gap: spacing(8), padding: spacing(6), paddingBottom: spacing(10) },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing(4) },
  center: { textAlign: 'center' },
});
