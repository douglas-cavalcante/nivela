import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Box, Button, CircularProgress, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation } from 'react-router';
import { loginAction } from 'src/features/auth/api/auth.action';
import { PasswordField } from 'src/components/PasswordField';
import { loginSchema } from 'src/features/auth/schemas/login.schema';
import type { LoginFormValues } from 'src/features/auth/schemas/login.schema';
import { parseApiError } from '@nivela/api-contract';
import { useAuth } from 'src/lib/auth/AuthContext';

interface LocationState {
  from?: { pathname?: string; search?: string };
}

/** Para onde ir depois do login: a página que a pessoa tentou abrir ou o Início. */
function destination(state: unknown): string {
  const from = (state as LocationState | null)?.from;
  if (!from?.pathname || from.pathname === '/login') return '/';
  return `${from.pathname}${from.search ?? ''}`;
}

export function Login() {
  const { user, loading, signIn } = useAuth();
  const location = useLocation();
  const [serverError, setServerError] = useState<string | null>(null);
  const [rejected, setRejected] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  // TextField entrega o `ref` do react-hook-form ao <input>, não à div externa
  const field = (name: keyof LoginFormValues) => {
    const { ref, ...rest } = register(name);
    return { ...rest, inputRef: ref };
  };

  if (loading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', py: 4 }}>
        <CircularProgress aria-label="Carregando" />
      </Box>
    );
  }
  if (user) return <Navigate to={destination(location.state)} replace />;

  const onSubmit = async (values: LoginFormValues) => {
    setServerError(null);
    setRejected(false);
    try {
      const { token, user: signedUser } = await loginAction(values);
      signIn(token, signedUser);
    } catch (error) {
      const info = parseApiError(error);
      const details = Object.values(info.fieldErrors).flat();
      setServerError(details.length > 0 ? details.join(' ') : info.message);
      setRejected(info.status === 422);
    }
  };

  return (
    <Box component="form" noValidate onSubmit={handleSubmit(onSubmit)} sx={{ display: 'grid', gap: 2.5 }}>
      <Typography color="text.secondary" sx={{ textAlign: 'center', mt: -1 }}>
        Entre para abrir o seu caderno.
      </Typography>

      <TextField
        label="E-mail"
        type="email"
        autoComplete="username"
        autoFocus
        slotProps={{
          htmlInput: {
            inputMode: 'email',
            autoCapitalize: 'none',
            spellCheck: false,
          },
        }}
        error={Boolean(errors.email) || rejected}
        helperText={errors.email?.message}
        {...field('email')}
      />
      <PasswordField
        label="Senha"
        autoComplete="current-password"
        error={Boolean(errors.password) || rejected}
        helperText={errors.password?.message}
        {...field('password')}
      />

      {serverError ? <Alert severity="error">{serverError}</Alert> : null}

      <Button
        type="submit"
        variant="contained"
        size="large"
        disabled={isSubmitting}
        startIcon={isSubmitting ? <CircularProgress size={18} color="inherit" aria-hidden /> : undefined}
      >
        {isSubmitting ? 'Entrando…' : 'Entrar'}
      </Button>
    </Box>
  );
}
