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
 * O valor escolhido sempre aparece entre as opções (mesmo que a busca atual não o traga) e, depois de escolher,
 * a busca é zerada: reabrir o campo lista tudo de novo.
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
  // resultado da última busca concluída e o texto que a originou: enquanto difere do atual, está carregando
  const [result, setResult] = useState<{ search: string; options: T[]; error: string | null } | null>(null);
  const loadRef = useRef(load);

  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    let stale = false;
    const timer = setTimeout(
      () => {
        loadRef
          .current(search, controller.signal)
          .then((options) => {
            if (!stale) setResult({ search, options, error: null });
          })
          .catch(() => {
            if (!stale) setResult({ search, options: [], error: LOAD_ERROR });
          });
      },
      search === '' ? 0 : DEBOUNCE_MS,
    );
    return () => {
      stale = true; // uma busca mais nova (ou fechar o campo) descarta a resposta atrasada
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, search]);

  const loading = open && (result === null || result.search !== search);
  const found = result?.options ?? [];
  // o valor escolhido precisa estar nas opções, senão o MUI avisa "valor fora das opções"
  const options =
    value !== null && !found.some((option) => getOptionKey(option) === getOptionKey(value)) ? [value, ...found] : found;
  const loadError = open && !loading ? (result?.error ?? null) : null;

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
        else setSearch(''); // limpar, escolher ou sair do campo: a próxima abertura lista tudo
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
