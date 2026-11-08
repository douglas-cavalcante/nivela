import { radius, spacing } from '@nivela/design-tokens';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';
import { AppText } from 'src/components/AppText';
import { useTheme } from 'src/lib/theme/useTheme';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  /** Mensagem de erro do campo (validação local ou da API). */
  error?: string;
  /** Marca o campo como inválido sem texto próprio (o erro é mostrado em outro lugar). */
  invalid?: boolean;
  /** Dica curta embaixo do campo, enquanto não há erro. */
  hint?: string;
  /** Campo de senha: esconde o texto e ganha o botão de mostrar/ocultar. */
  password?: boolean;
  /**
   * O que o botão de mostrar/ocultar revela, para o leitor de tela ("Mostrar senha",
   * "Mostrar confirmação de senha"). Padrão: `senha`.
   */
  revealLabel?: string;
  /** Letras grandes e espaçadas (usado no código da turma). */
  emphasis?: boolean;
}

/** Campo de texto sobre a pauta: rótulo, borda de 2 px, erro embaixo e alvo de toque grande. */
export function TextField({
  label,
  error,
  invalid,
  hint,
  password = false,
  revealLabel = 'senha',
  emphasis = false,
  ...props
}: TextFieldProps) {
  const { colors, fonts } = useTheme();
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const failed = Boolean(error) || Boolean(invalid);

  return (
    <View style={styles.wrap}>
      <AppText variant="bold" size={15}>
        {label}
      </AppText>
      <View
        style={[
          styles.box,
          {
            backgroundColor: colors.surface,
            borderColor: failed ? colors.danger : focused ? colors.primary : colors.border,
            borderWidth: focused || failed ? 3 : 2,
          },
        ]}
      >
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.textMuted}
          cursorColor={colors.primary}
          selectionColor={colors.primary}
          {...props}
          secureTextEntry={password && !visible}
          onFocus={(event) => {
            setFocused(true);
            props.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            props.onBlur?.(event);
          }}
          style={[
            styles.input,
            { color: colors.text, fontFamily: emphasis ? fonts.bodyBold : fonts.body },
            emphasis ? styles.emphasis : null,
          ]}
        />
        {password ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${visible ? 'Ocultar' : 'Mostrar'} ${revealLabel}`}
            hitSlop={4}
            onPress={() => setVisible((current) => !current)}
            style={styles.toggle}
          >
            <AppText variant="bold" size={14} style={{ color: colors.primary }}>
              {visible ? 'Ocultar' : 'Mostrar'}
            </AppText>
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <AppText accessibilityRole="alert" accessibilityLiveRegion="polite" size={14} style={{ color: colors.danger }}>
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="muted" size={14}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing(1.5) },
  box: { flexDirection: 'row', alignItems: 'center', minHeight: 52, borderRadius: radius.md },
  input: { flex: 1, minHeight: 48, paddingHorizontal: spacing(3), fontSize: 17 },
  emphasis: { fontSize: 24, letterSpacing: 4, textAlign: 'center' },
  toggle: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingRight: spacing(3) },
});
