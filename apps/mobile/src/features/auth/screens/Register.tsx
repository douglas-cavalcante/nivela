import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Pressable } from 'react-native';
import { AppText } from 'src/components/AppText';
import { Button } from 'src/components/Button';
import { registerStudentAction } from 'src/features/auth/api/auth.action';
import { AuthForm } from 'src/features/auth/components/AuthForm';
import { FormTextField } from 'src/features/auth/components/FormTextField';
import { registerSchema } from 'src/features/auth/schemas/register.schema';
import type { RegisterFormValues, RegisterPayloadValues } from 'src/features/auth/schemas/register.schema';
import { parseApiError } from 'src/lib/apiError';
import { useAuth } from 'src/lib/auth/AuthContext';
import { useTheme } from 'src/lib/theme/useTheme';

const FIELDS: readonly (keyof RegisterFormValues)[] = ['join_code', 'name', 'email', 'password', 'password_confirmation'];

const isField = (name: string): name is keyof RegisterFormValues => (FIELDS as readonly string[]).includes(name);

export function Register() {
  const { signIn } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    setError,
    formState: { isSubmitting },
  } = useForm<RegisterFormValues, unknown, RegisterPayloadValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { join_code: '', name: '', email: '', password: '', password_confirmation: '' },
  });

  const onSubmit = async (values: RegisterPayloadValues) => {
    setServerError(null);
    try {
      const { token, user } = await registerStudentAction(values);
      // com o usuário definido, as rotas protegidas levam direto ao app
      await signIn(token, user);
    } catch (error) {
      const info = parseApiError(error);
      // erros 422 vão para o campo certo; o que não tiver campo (ou outros status) vira o aviso geral
      const unmatched: string[] = [];
      for (const [name, messages] of Object.entries(info.fieldErrors)) {
        if (isField(name)) setError(name, { message: messages.join(' ') });
        else unmatched.push(...messages);
      }
      const hasFieldError = Object.keys(info.fieldErrors).some(isField);
      if (unmatched.length > 0) setServerError(unmatched.join(' '));
      else if (!hasFieldError) setServerError(info.message);
    }
  };

  const submit = () => {
    void handleSubmit(onSubmit)();
  };

  return (
    <AuthForm
      title="Bem-vindo(a) à turma!"
      subtitle="Use o código que o seu professor passou."
      error={serverError}
      footer={
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Já tem conta? Entrar"
          onPress={() => router.replace('/login')}
          style={{ minHeight: 44, justifyContent: 'center' }}
        >
          <AppText variant="bold" style={{ color: colors.primary, textAlign: 'center' }}>
            Já tem conta? Entrar
          </AppText>
        </Pressable>
      }
    >
      <FormTextField
        control={control}
        name="join_code"
        label="Código da turma"
        hint="Peça ao seu professor. Ex.: NIV-4K7Q"
        emphasis
        autoCapitalize="characters"
        autoCorrect={false}
        spellCheck={false}
        format={(text) => text.toUpperCase()}
        returnKeyType="next"
      />
      <FormTextField
        control={control}
        name="name"
        label="Nome"
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        returnKeyType="next"
      />
      <FormTextField
        control={control}
        name="email"
        label="E-mail"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="username"
        returnKeyType="next"
      />
      <FormTextField
        control={control}
        name="password"
        label="Senha"
        hint="Pelo menos 8 caracteres."
        password
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
      />
      <FormTextField
        control={control}
        name="password_confirmation"
        label="Confirmar senha"
        password
        revealLabel="confirmação de senha"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <Button
        title={isSubmitting ? 'Criando…' : 'Criar minha conta'}
        loading={isSubmitting}
        onPress={submit}
      />
    </AuthForm>
  );
}
