import { Alert, Snackbar } from '@mui/material';
import { useMemo, useState } from 'react';
import type { ReactNode, SyntheticEvent } from 'react';
import { NotifyContext } from 'src/lib/notify/useNotify';
import type { Notify } from 'src/lib/notify/useNotify';

const AUTO_HIDE_MS = 4000;

interface Message {
  id: number;
  text: string;
  severity: 'success' | 'error';
}

/** Mostra um aviso por vez; um aviso novo substitui o anterior. */
export function NotifyProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<Message | null>(null);
  const [open, setOpen] = useState(false);

  const notify = useMemo<Notify>(() => {
    const show = (severity: Message['severity']) => (text: string) => {
      setMessage((current) => ({ id: (current?.id ?? 0) + 1, text, severity }));
      setOpen(true);
    };
    return { success: show('success'), error: show('error') };
  }, []);

  function handleClose(_event: Event | SyntheticEvent | null, reason?: string) {
    // clicar fora não fecha o aviso: só o tempo ou o botão
    if (reason === 'clickaway') return;
    setOpen(false);
  }

  return (
    <NotifyContext.Provider value={notify}>
      {children}
      <Snackbar
        key={message?.id}
        open={open}
        autoHideDuration={AUTO_HIDE_MS}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {message ? (
          <Alert
            severity={message.severity}
            variant="filled"
            role={message.severity === 'error' ? 'alert' : 'status'}
            onClose={handleClose}
            closeText="Fechar"
            sx={{ width: '100%', fontWeight: 700 }}
          >
            {message.text}
          </Alert>
        ) : undefined}
      </Snackbar>
    </NotifyContext.Provider>
  );
}
