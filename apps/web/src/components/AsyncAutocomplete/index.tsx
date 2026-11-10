import { Autocomplete, CircularProgress, TextField } from '@mui/material';
import { useEffect, useRef, useState } from 'react';

interface AsyncAutocompleteProps<T> {
  label: string;
  value: T | null;
  onChange: (value: T | null) => void;
  /** Busca no servidor (até 20 itens); recebe o texto digitado e um sinal de cancelamento. */
  load: (search: string, signal: AbortSignal) => Promise<T[]>;
  getOptionLabel: (option: T) => string;
  getOptionKey: (option: T) => number;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  noOptionsText?: string;
  size?: 'small' | 'medium';
  /** Chamado ao sair do campo (react-hook-form). */
  onBlur?: () => void;
  inputRef?: React.Ref<HTMLInputElement>;
}

const DEBOUNCE_MS = 300;
const LOAD_ERROR = 'Não foi possível carregar as opções.';

/**
 * Campo de escolha com busca no servidor: digitar dispara a busca depois de 300 ms sem digitação.
 * Uma busca nova cancela a anterior pelo `signal` e a resposta atrasada é descartada.
 */
export function AsyncAutocomplete<T>({
  label,
  value,
  onChange,
  load,
  getOptionLabel,
  getOptionKey,
  placeholder,
  error,
  disabled,
  noOptionsText = 'Nada encontrado.',
  size,
  onBlur,
  inputRef,
}: AsyncAutocompleteProps<T>) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadRef = useRef(load);
  const requestId = useRef(0);

  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const id = ++requestId.current;
    setLoading(true);
    setLoadError(null);
    const timer = setTimeout(
      () => {
        loadRef
          .current(search, controller.signal)
          .then((rows) => {
            if (id !== requestId.current) return; // superada por uma busca mais nova
            setOptions(rows);
            setLoading(false);
          })
          .catch(() => {
            if (id !== requestId.current) return;
            setOptions([]);
            setLoadError(LOAD_ERROR);
            setLoading(false);
          });
      },
      search === '' ? 0 : DEBOUNCE_MS,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
      requestId.current++;
    };
  }, [open, search]);

  return (
    <Autocomplete<T>
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      value={value}
      onChange={(_event, next) => onChange(next)}
      inputValue={inputValue}
      onInputChange={(_event, text, reason) => {
        setInputValue(text);
        if (reason === 'input') setSearch(text);
        else if (reason === 'clear') setSearch('');
      }}
      options={options}
      filterOptions={(rows) => rows}
      getOptionLabel={getOptionLabel}
      getOptionKey={getOptionKey}
      isOptionEqualToValue={(option, current) => getOptionKey(option) === getOptionKey(current)}
      loading={loading}
      loadingText="Carregando…"
      noOptionsText={loadError ?? noOptionsText}
      clearText="Limpar"
      openText="Abrir"
      closeText="Fechar"
      disabled={disabled}
      size={size}
      onBlur={onBlur}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={placeholder}
          inputRef={inputRef}
          error={Boolean(error) || (loadError !== null && open)}
          helperText={error}
          slotProps={{
            ...params.slotProps,
            inputLabel: { ...params.slotProps.inputLabel, shrink: true },
            input: {
              ...params.slotProps.input,
              endAdornment: (
                <>
                  {loading ? <CircularProgress size={16} aria-hidden /> : null}
                  {params.slotProps.input.endAdornment}
                </>
              ),
            },
          }}
        />
      )}
    />
  );
}
