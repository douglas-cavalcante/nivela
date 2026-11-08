import { radius, spacing } from '@nivela/design-tokens';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { AppText } from 'src/components/AppText';
import { HandTitle } from 'src/components/HandTitle';
import { Mascot } from 'src/components/Mascot';
import { PaperBackground } from 'src/components/PaperBackground';
import { PenCard } from 'src/components/PenCard';
import { useTheme } from 'src/lib/theme/useTheme';

interface AuthFormProps {
  title: string;
  subtitle: string;
  /** Aviso de erro geral (que não pertence a um campo), mostrado acima do botão. */
  error?: string | null;
  /** Campos e botão do formulário. */
  children: ReactNode;
  /** Link para a outra tela (entrar ↔ criar conta), embaixo do cartão. */
  footer?: ReactNode;
}

/**
 * Moldura das telas de entrar e criar conta: mascote, título manuscrito e o formulário num
 * cartão sobre o papel pautado. Rola quando o teclado ocupa a tela e não perde o toque nos
 * botões enquanto ele está aberto.
 */
export function AuthForm({ title, subtitle, error, children, footer }: AuthFormProps) {
  const { colors } = useTheme();

  return (
    <PaperBackground>
      <KeyboardAvoidingView style={styles.fill} behavior="padding">
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Mascot size={96} />
            <HandTitle size={40}>{title}</HandTitle>
            <AppText variant="muted" style={styles.center}>
              {subtitle}
            </AppText>
          </View>
          <PenCard style={styles.card}>
            {children}
            {error ? (
              <View
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                style={[styles.error, { borderColor: colors.danger, backgroundColor: colors.background }]}
              >
                <AppText size={15} style={{ color: colors.danger }}>
                  {error}
                </AppText>
              </View>
            ) : null}
          </PenCard>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', gap: spacing(5), padding: spacing(6) },
  header: { alignItems: 'center', gap: spacing(2) },
  center: { textAlign: 'center' },
  card: { gap: spacing(4) },
  error: { borderWidth: 2, borderRadius: radius.sm, padding: spacing(3) },
  footer: { alignItems: 'center', gap: spacing(1) },
});
