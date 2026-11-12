import SearchIcon from '@mui/icons-material/Search';
import { InputAdornment, TextField } from '@mui/material';
import { useEffect, useRef, useState } from 'react';

interface SearchFieldProps {
  label: string;
  /** Valor atual do filtro (ex.: vindo da URL). */
  value: string;
  /** Chamado só depois de `debounceMs` sem digitação. */
  onChange: (value: string) => void;
  debounceMs?: number;
  placeholder?: string;
}

/** Campo de busca com debounce: quem usa só reage quando a pessoa para de digitar. */
export function SearchField({ label, value, onChange, debounceMs = 300, placeholder }: SearchFieldProps) {
  const [text, setText] = useState(value);
  const lastEmitted = useRef(value);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // o valor mudou por fora (botão voltar, limpar filtros): acompanha, sem eco do que acabou de ser emitido
  useEffect(() => {
    if (value !== lastEmitted.current) {
      lastEmitted.current = value;
      setText(value);
    }
  }, [value]);

  useEffect(() => {
    if (text === lastEmitted.current) return;
    const timer = setTimeout(() => {
      lastEmitted.current = text;
      onChangeRef.current(text);
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [text, debounceMs]);

  return (
    <TextField
      type="search"
      label={label}
      placeholder={placeholder}
      value={text}
      onChange={(event) => setText(event.target.value)}
      size="small"
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" aria-hidden />
            </InputAdornment>
          ),
        },
      }}
    />
  );
}
