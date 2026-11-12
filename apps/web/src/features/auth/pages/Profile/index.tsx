import { zodResolver } from '@hookform/resolvers/zod';
import LogoutIcon from '@mui/icons-material/LogoutOutlined';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControlLabel,
  Switch,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { PageHeader } from 'src/components/PageHeader';
import { changePasswordAction } from 'src/features/auth/api/auth.action';
import { PasswordField } from 'src/components/PasswordField';
import { changePasswordSchema } from 'src/features/auth/schemas/changePassword.schema';
import type { ChangePasswordFormValues } from 'src/features/auth/schemas/changePassword.schema';
import { parseApiError } from '@nivela/api-contract';
import { useAuth } from 'src/lib/auth/AuthContext';
import { useColorMode } from 'src/lib/theme/ColorModeProvider';

const ROLE_LABEL = {
  admin: 'Administrador',
  teacher: 'Professor',
  student: 'Aluno',
} as const;

const emptyValues: ChangePasswordFormValues = {
  current_password: '',
  password: '',
  password_confirmation: '',
};

function PasswordCard() {
  const [notice, setNotice] = useState<{
    severity: 'success' | 'error';
    text: string;
  } | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: emptyValues,
  });

  // TextField entrega o `ref` do react-hook-form ao <input>, não à div externa
  const field = (name: keyof ChangePasswordFormValues) => {
    const { ref, ...rest } = register(name);
    return {
      ...rest,
      inputRef: ref,
      error: Boolean(errors[name]),
      helperText: errors[name]?.message,
    };
  };

  const onSubmit = async (values: ChangePasswordFormValues) => {
    setNotice(null);
    try {
      await changePasswordAction(values);
      reset(emptyValues);
      setNotice({ severity: 'success', text: 'Senha alterada com sucesso.' });
    } catch (error) {
      const info = parseApiError(error);
      const unmatched: string[] = [];
      for (const [name, messages] of Object.entries(info.fieldErrors)) {
        if (name in emptyValues)
          setError(name as keyof ChangePasswordFormValues, {
            message: messages.join(' '),
          });
        else unmatched.push(...messages);
      }
      // sem erro de campo (ou de um campo que não existe aqui): vai para o aviso do topo
      if (Object.keys(info.fieldErrors).length === 0 || unmatched.length > 0) {
        setNotice({
          severity: 'error',
          text: unmatched.length > 0 ? unmatched.join(' ') : info.message,
        });
      }
    }
  };

  return (
    <Card component="section" aria-labelledby="troca-de-senha">
      <CardContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
        <Typography id="troca-de-senha" variant="h3" component="h2" sx={{ mb: 0.5 }}>
          Trocar senha
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Ao trocar, você continua aqui, mas os outros aparelhos conectados precisam entrar de novo.
        </Typography>

        <Box
          component="form"
          noValidate
          onSubmit={handleSubmit(onSubmit)}
          sx={{ display: 'grid', gap: 2.5, maxWidth: 440 }}
        >
          <PasswordField label="Senha atual" autoComplete="current-password" {...field('current_password')} />
          <PasswordField label="Nova senha" autoComplete="new-password" {...field('password')} />
          <PasswordField label="Confirmar nova senha" autoComplete="new-password" {...field('password_confirmation')} />

          {notice ? <Alert severity={notice.severity}>{notice.text}</Alert> : null}

          <Box>
            <Button
              type="submit"
              variant="contained"
              disabled={isSubmitting}
              startIcon={isSubmitting ? <CircularProgress size={18} color="inherit" aria-hidden /> : undefined}
            >
              {isSubmitting ? 'Alterando…' : 'Alterar senha'}
            </Button>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export function Profile() {
  const { user, signOut } = useAuth();
  const { mode, toggleMode } = useColorMode();

  return (
    <>
      <PageHeader title="Meu perfil" subtitle="Seus dados, sua senha e o jeito que o caderno aparece pra você." />

      <Box
        sx={{
          display: 'grid',
          gap: 3,
          gridTemplateColumns: { xs: '1fr', lg: '1fr 1.4fr' },
          alignItems: 'start',
        }}
      >
        <Box sx={{ display: 'grid', gap: 3 }}>
          <Card component="section" aria-labelledby="seus-dados">
            <CardContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
              <Typography id="seus-dados" variant="h3" component="h2" sx={{ mb: 2 }}>
                Seus dados
              </Typography>
              {user ? (
                <Box sx={{ display: 'grid', gap: 1 }}>
                  <Typography variant="h6" component="p">
                    {user.name}
                  </Typography>
                  <Typography color="text.secondary">{user.email}</Typography>
                  <Box>
                    <Chip label={ROLE_LABEL[user.role]} color="secondary" size="small" />
                  </Box>
                </Box>
              ) : null}
            </CardContent>
          </Card>

          <Card component="section" aria-labelledby="aparencia">
            <CardContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
              <Typography id="aparencia" variant="h3" component="h2" sx={{ mb: 1 }}>
                Aparência
              </Typography>
              <FormControlLabel
                control={<Switch checked={mode === 'dark'} onChange={toggleMode} />}
                label="Tema escuro"
              />
            </CardContent>
          </Card>

          <Card component="section" aria-labelledby="sessao">
            <CardContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
              <Typography id="sessao" variant="h3" component="h2" sx={{ mb: 1.5 }}>
                Sessão
              </Typography>
              <Button variant="outlined" color="inherit" startIcon={<LogoutIcon />} onClick={() => void signOut()}>
                Sair da conta
              </Button>
            </CardContent>
          </Card>
        </Box>

        <PasswordCard />
      </Box>
    </>
  );
}
