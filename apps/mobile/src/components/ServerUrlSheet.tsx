import { radius, spacing } from '@nivela/design-tokens';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, View } from 'react-native';
import { AppText } from 'src/components/AppText';
import { Button } from 'src/components/Button';
import { TextField } from 'src/components/TextField';
import { formatServerUrl, useServerUrl } from 'src/lib/server-url';
import { useTheme } from 'src/lib/theme/useTheme';

interface ServerUrlSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Chamado depois que o endereço foi salvo (ou o padrão restaurado) com sucesso. */
  onSaved?: () => void;
}

type Feedback = { kind: 'error' | 'success'; text: string } | null;

const MESSAGES = {
  invalid: 'Digite um endereço como 192.168.0.10:8000.',
  unreachable: 'Não foi possível conectar a este endereço.',
  ok: 'Servidor atualizado.',
} as const;

/** Folha para trocar o endereço da API: testa a conexão antes de salvar. */
export function ServerUrlSheet({ visible, ...props }: ServerUrlSheetProps) {
  // Montada só enquanto aberta: cada abertura começa sem a mensagem nem o texto da vez anterior.
  return visible ? <SheetBody {...props} /> : null;
}

function SheetBody({ onClose, onSaved }: Omit<ServerUrlSheetProps, 'visible'>) {
  const { colors } = useTheme();
  const { url, change, reset } = useServerUrl();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  // Trava síncrona: `busy` só muda na próxima renderização e o Enter pode chegar duas vezes antes.
  const working = useRef(false);

  const save = async () => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setFeedback(null);
    const result = await change(input);
    working.current = false;
    setBusy(false);
    setFeedback({ kind: result === 'ok' ? 'success' : 'error', text: MESSAGES[result] });
    if (result === 'ok') {
      setInput('');
      onSaved?.();
    }
  };

  const resetToDefault = async () => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    await reset();
    working.current = false;
    setBusy(false);
    setInput('');
    setFeedback({ kind: 'success', text: MESSAGES.ok });
    onSaved?.();
  };

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior="padding">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fechar."
          style={[styles.backdrop, { backgroundColor: colors.shadow }]}
          onPress={busy ? undefined : onClose}
        />
        <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <AppText variant="heading" size={32} accessibilityRole="header">
            Servidor
          </AppText>
          <AppText variant="muted">Use o IP do computador que roda a API, na mesma rede Wi-Fi.</AppText>
          <AppText variant="muted" size={15}>{`Atual: ${formatServerUrl(url)}`}</AppText>
          <TextField
            label="Endereço do servidor"
            value={input}
            onChangeText={setInput}
            placeholder="192.168.0.10:8000"
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={() => void save()}
          />
          {feedback ? (
            <AppText
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={{ color: feedback.kind === 'error' ? colors.danger : colors.success }}
            >
              {feedback.text}
            </AppText>
          ) : null}
          <Button title="Testar e salvar" loading={busy} onPress={() => void save()} />
          <Button title="Usar o padrão" variant="outline" disabled={busy} onPress={() => void resetToDefault()} />
          <Button title="Fechar" variant="outline" disabled={busy} onPress={onClose} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, opacity: 0.4 },
  sheet: {
    gap: spacing(3),
    padding: spacing(5),
    paddingBottom: spacing(8),
    borderWidth: 2,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
});
