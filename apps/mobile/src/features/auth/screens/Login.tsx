import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Pressable } from 'react-native';
import { AppText } from 'src/components/AppText';
import { Button } from 'src/components/Button';
import { loginAction } from 'src/features/auth/api/auth.action';
import { AuthForm } from 'src/features/auth/components/AuthForm';
import { ServerUrlLine } from 'src/features/auth/components/ServerUrlLine';
import { FormTextField } from 'src/features/auth/components/FormTextField';
import { loginSchema } from 'src/features/auth/schemas/login.schema';
import type { LoginFormValues, LoginPayloadValues } from 'src/features/auth/schemas/login.schema';
import { parseApiError } from '@nivela/api-contract';
import { useAuth } from 'src/lib/auth/AuthContext';
import { useTheme } from 'src/lib/theme/useTheme';

export function Login() {
  const { signIn } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [rejected, setRejected] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<LoginFormValues, unknown, LoginPayloadValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: LoginPayloadValues) => {
    setServerError(null);
    setRejected(false);
    try {
      const { token, user } = await loginAction(values);
      // com o usuário definido, as rotas protegidas levam direto ao app
      await signIn(token, user);
    } catch (error) {
      const info = parseApiError(error);
      const details = Object.values(info.fieldErrors).flat();
      setServerError(details.length > 0 ? details.join(' ') : info.message);
      setRejected(info.status === 422);
    }
  };

  const submit = () => {
    void handleSubmit(onSubmit)();
  };

  return (
    <AuthForm
      title="Que bom te ver!"
      subtitle="Entre para abrir o seu caderno."
      error={serverError}
      footer={
        <>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Ainda não tem conta? Use o código da turma"
            onPress={() => router.replace('/register')}
            style={{ minHeight: 44, justifyContent: 'center' }}
          >
            <AppText variant="bold" style={{ color: colors.primary, textAlign: 'center' }}>
              Ainda não tem conta? Use o código da turma
            </AppText>
          </Pressable>
          <ServerUrlLine />
        </>
      }
    >
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
        invalid={rejected}
      />
      <FormTextField
        control={control}
        name="password"
        label="Senha"
        password
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
        invalid={rejected}
      />
      <Button
        title={isSubmitting ? 'Entrando…' : 'Entrar'}
        loading={isSubmitting}
        onPress={submit}
      />
    </AuthForm>
  );
}
