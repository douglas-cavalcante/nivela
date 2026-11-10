import { spacing } from '@nivela/design-tokens';
import { ScrollView, StyleSheet, View } from 'react-native';
import { AppText } from 'src/components/AppText';
import { Button } from 'src/components/Button';
import { HandTitle } from 'src/components/HandTitle';
import { Mascot } from 'src/components/Mascot';
import { PaperBackground } from 'src/components/PaperBackground';

interface OfflineScreenProps {
  /** Status HTTP da falha; `null` quando a API não respondeu. */
  status: number | null;
  onRetry: () => void;
  onSignOut: () => void;
  retrying?: boolean;
}

interface FailureCopy {
  title: string;
  hint: string;
}

function copyFor(status: number | null): FailureCopy {
  if (status === null) {
    return { title: 'Sem conexão com o servidor.', hint: 'Confira sua internet e tente de novo. Sua sessão continua salva.' };
  }
  if (status >= 500) {
    return { title: 'O servidor está com problemas.', hint: 'Tente de novo em instantes. Sua sessão continua salva.' };
  }
  return {
    title: 'Não foi possível abrir sua conta agora.',
    hint: 'Tente de novo em instantes ou saia para entrar outra vez.',
  };
}

/** Tela mostrada quando a checagem da sessão falha: a pessoa tenta de novo ou sai. */
export function OfflineScreen({ status, onRetry, onSignOut, retrying = false }: OfflineScreenProps) {
  const { title, hint } = copyFor(status);
  return (
    <PaperBackground>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Mascot size={160} />
          <HandTitle size={40}>{title}</HandTitle>
          <AppText variant="muted" size={17} style={styles.center}>
            {hint}
          </AppText>
        </View>
        <View style={styles.actions}>
          <Button title="Tentar de novo" loading={retrying} onPress={onRetry} />
          <Button title="Sair" variant="outline" onPress={onSignOut} />
        </View>
      </ScrollView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'space-between', gap: spacing(8), padding: spacing(6), paddingBottom: spacing(10) },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing(4) },
  actions: { gap: spacing(3) },
  center: { textAlign: 'center' },
});
