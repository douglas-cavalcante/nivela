import { Box, FormControlLabel, FormHelperText, Radio, TextField, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import type { OptionLetter } from '@nivela/api-contract';
import { useNivelaColors } from 'src/lib/theme/useNivelaColors';

interface OptionsEditorProps {
  options: Array<{ letter: string; text: string }>;
  /** Letra da alternativa correta; '' enquanto ninguém marcou. */
  correctLetter: string;
  onTextChange: (index: number, text: string) => void;
  onCorrectChange: (letter: OptionLetter) => void;
  /** Erro de cada linha (mesma ordem de `options`). */
  textErrors?: Array<string | undefined>;
  correctError?: string;
  generalError?: string;
  disabled?: boolean;
}

/** As 5 alternativas em linhas de caderno: letra, texto e um "correta" por linha (só uma vale, marcada com marca-texto). */
export function OptionsEditor({
  options,
  correctLetter,
  onTextChange,
  onCorrectChange,
  textErrors = [],
  correctError,
  generalError,
  disabled = false,
}: OptionsEditorProps) {
  const colors = useNivelaColors();
  const dark = useTheme().palette.mode === 'dark';
  const marker = alpha(colors.highlight, dark ? 0.22 : 0.5);

  return (
    <Box component="fieldset" sx={{ border: 0, m: 0, p: 0, minWidth: 0 }}>
      <Typography component="legend" variant="h6" sx={{ mb: 0.5, p: 0 }}>
        Alternativas
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Escreva as cinco alternativas e marque qual delas é a correta.
      </Typography>

      <Box
        component="ol"
        sx={{
          listStyle: 'none',
          m: 0,
          p: 0,
          // margem vermelha de caderno
          borderLeft: `2px solid ${alpha(colors.secondary, 0.7)}`,
          borderTop: `1px solid ${colors.rule}`,
        }}
      >
        {options.map((option, index) => {
          const selected = option.letter === correctLetter;
          const error = textErrors[index];
          return (
            <Box
              component="li"
              key={option.letter}
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1.5,
                px: 1.5,
                py: 1.25,
                borderBottom: `1px solid ${colors.rule}`,
                backgroundColor: selected ? marker : 'transparent',
                boxShadow: selected ? `inset 4px 0 0 ${colors.highlight}` : 'none',
                transition: 'background-color 120ms ease',
              }}
            >
              <Box
                aria-hidden
                sx={(theme) => ({
                  flex: 'none',
                  width: 36,
                  height: 36,
                  mt: 0.25,
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: '50%',
                  border: `2px solid ${colors.border}`,
                  fontFamily: theme.typography.h4.fontFamily,
                  fontSize: '1.4rem',
                  fontWeight: 700,
                  lineHeight: 1,
                  backgroundColor: selected ? colors.highlight : colors.surface,
                  color: selected ? colors.onHighlight : colors.text,
                })}
              >
                {option.letter}
              </Box>

              <TextField
                size="small"
                fullWidth
                multiline
                minRows={1}
                placeholder="Texto da alternativa"
                value={option.text}
                disabled={disabled}
                onChange={(event) => onTextChange(index, event.target.value)}
                error={Boolean(error)}
                helperText={error}
                slotProps={{ htmlInput: { 'aria-label': `Alternativa ${option.letter}` } }}
              />

              <FormControlLabel
                sx={{ flex: 'none', mr: 0, mt: 0.25, '& .MuiFormControlLabel-label': { fontWeight: selected ? 800 : 600 } }}
                label="Correta"
                control={
                  <Radio
                    name="correct_letter"
                    value={option.letter}
                    checked={selected}
                    disabled={disabled}
                    onChange={() => onCorrectChange(option.letter as OptionLetter)}
                    slotProps={{ input: { 'aria-label': `Alternativa ${option.letter} é a correta` } }}
                  />
                }
              />
            </Box>
          );
        })}
      </Box>

      {generalError ? <FormHelperText error>{generalError}</FormHelperText> : null}
      {correctError ? <FormHelperText error>{correctError}</FormHelperText> : null}
    </Box>
  );
}
