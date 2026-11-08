import VisibilityIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOffOutlined';
import { IconButton, InputAdornment, TextField } from '@mui/material';
import type { TextFieldProps } from '@mui/material';
import { useState } from 'react';

type PasswordFieldProps = Omit<TextFieldProps, 'type' | 'variant'>;

/** Campo de senha com botão para mostrar/ocultar o que foi digitado. */
export function PasswordField({ slotProps, ...props }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const label = visible ? 'Ocultar senha' : 'Mostrar senha';

  return (
    <TextField
      {...props}
      type={visible ? 'text' : 'password'}
      slotProps={{
        ...slotProps,
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                aria-label={label}
                aria-pressed={visible}
                edge="end"
                onClick={() => setVisible((current) => !current)}
                onMouseDown={(event) => event.preventDefault()}
              >
                {visible ? <VisibilityOffIcon /> : <VisibilityIcon />}
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  );
}
