import { zodResolver } from '@hookform/resolvers/zod';
import { Box, FormControl, FormHelperText, FormLabel, TextField } from '@mui/material';
import { penShadow, subjectColorKeys, subjectColors, subjectIconKeys } from '@nivela/design-tokens';
import type { SubjectColorKey, SubjectIconKey } from '@nivela/design-tokens';
import { parseApiError } from '@nivela/api-contract';
import type { ApiSubject } from '@nivela/api-contract';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import type { ReactNode } from 'react';
import { FormDialog } from 'src/components/FormDialog';
import { createSubjectAction, updateSubjectAction } from 'src/features/subjects/api/subjects.action';
import { subjectColorLabels } from 'src/features/subjects/components/SubjectBadge';
import { SubjectIcon, subjectIconLabels } from 'src/features/subjects/components/SubjectIcon';
import { swatchBorder } from 'src/features/subjects/components/subjectStyles';
import { subjectSchema } from 'src/features/subjects/schemas/subject.schema';
import type { SubjectFormValues } from 'src/features/subjects/schemas/subject.schema';
import { useColorMode } from 'src/lib/theme/ColorModeProvider';
import { useNivelaColors } from 'src/lib/theme/useNivelaColors';

interface SubjectFormDialogProps {
  /** Disciplina em edição; sem ela, cria uma nova. */
  subject?: ApiSubject;
  onClose: () => void;
  onSaved: (message: string) => void;
}

interface SwatchProps {
  name: string;
  label: string;
  checked: boolean;
  onSelect: () => void;
  children: ReactNode;
  background: string;
  foreground: string;
  border: string;
}

/** Opção redonda de um seletor visual: o <input type="radio"> nativo fica sob o desenho (teclado e leitor de tela funcionam). */
function Swatch({ name, label, checked, onSelect, children, background, foreground, border }: SwatchProps) {
  const colors = useNivelaColors();
  return (
    <Box
      component="label"
      title={label}
      sx={{
        position: 'relative',
        display: 'inline-grid',
        placeItems: 'center',
        width: 44,
        height: 44,
        borderRadius: '50%',
        cursor: 'pointer',
        backgroundColor: background,
        color: foreground,
        border: `${penShadow.width}px solid ${border}`,
        boxShadow: checked ? `${penShadow.offset}px ${penShadow.offset}px 0 ${colors.shadow}` : 'none',
        transform: checked ? 'translate(-1px, -1px)' : 'none',
        transition: 'transform 120ms ease, box-shadow 120ms ease',
        '&:hover': { transform: 'translate(-1px, -1px)' },
        '&:has(input:focus-visible)': { outline: `3px solid ${colors.highlight}`, outlineOffset: 2 },
      }}
    >
      <Box
        component="input"
        type="radio"
        name={name}
        aria-label={label}
        checked={checked}
        onChange={onSelect}
        sx={{ position: 'absolute', inset: 0, opacity: 0, m: 0, cursor: 'pointer' }}
      />
      {children}
    </Box>
  );
}

export function SubjectFormDialog({ subject, onClose, onSaved }: SubjectFormDialogProps) {
  const { mode } = useColorMode();
  const palette = subjectColors[mode];
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SubjectFormValues>({
    resolver: zodResolver(subjectSchema),
    defaultValues: { name: subject?.name ?? '', color: subject?.color ?? 'teal', icon: subject?.icon ?? 'book' },
  });
  const selectedColor = useWatch({ control, name: 'color' });

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      if (subject) await updateSubjectAction(subject.id, values);
      else await createSubjectAction(values);
      onSaved(subject ? 'Disciplina atualizada.' : 'Disciplina criada.');
    } catch (error) {
      const info = parseApiError(error);
      let matched = false;
      for (const [field, messages] of Object.entries(info.fieldErrors)) {
        if (field === 'name' || field === 'color' || field === 'icon') {
          setError(field, { message: messages.join(' ') });
          matched = true;
        }
      }
      if (!matched) setFormError(info.message);
    }
  });

  const { ref, ...nameField } = register('name');

  return (
    <FormDialog
      open
      title={subject ? 'Editar disciplina' : 'Nova disciplina'}
      submitLabel={subject ? 'Salvar' : 'Criar disciplina'}
      loading={isSubmitting}
      onSubmit={() => void submit()}
      onClose={onClose}
    >
      <TextField
        label="Nome"
        autoFocus
        autoComplete="off"
        inputRef={ref}
        {...nameField}
        error={Boolean(errors.name)}
        helperText={errors.name?.message}
      />

      <Controller
        control={control}
        name="color"
        render={({ field }) => (
          <FormControl component="fieldset" error={Boolean(errors.color)}>
            <FormLabel component="legend" sx={{ mb: 1 }}>
              Cor
            </FormLabel>
            <Box role="radiogroup" aria-label="Cor" sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              {subjectColorKeys.map((key: SubjectColorKey) => (
                <Swatch
                  key={key}
                  name="color"
                  label={subjectColorLabels[key]}
                  checked={field.value === key}
                  onSelect={() => field.onChange(key)}
                  background={palette[key].background}
                  foreground={palette[key].foreground}
                  border={swatchBorder(mode, key, field.value === key)}
                >
                  <Box
                    aria-hidden
                    sx={{ width: 16, height: 16, borderRadius: '50%', backgroundColor: palette[key].foreground }}
                  />
                </Swatch>
              ))}
            </Box>
            {errors.color ? <FormHelperText>{errors.color.message}</FormHelperText> : null}
          </FormControl>
        )}
      />

      <Controller
        control={control}
        name="icon"
        render={({ field }) => (
          <FormControl component="fieldset" error={Boolean(errors.icon)}>
            <FormLabel component="legend" sx={{ mb: 1 }}>
              Ícone
            </FormLabel>
            <Box role="radiogroup" aria-label="Ícone" sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              {subjectIconKeys.map((key: SubjectIconKey) => (
                <Swatch
                  key={key}
                  name="icon"
                  label={subjectIconLabels[key]}
                  checked={field.value === key}
                  onSelect={() => field.onChange(key)}
                  background={palette[selectedColor].background}
                  foreground={palette[selectedColor].foreground}
                  border={swatchBorder(mode, selectedColor, field.value === key)}
                >
                  <SubjectIcon icon={key} fontSize="small" />
                </Swatch>
              ))}
            </Box>
            {errors.icon ? <FormHelperText>{errors.icon.message}</FormHelperText> : null}
          </FormControl>
        )}
      />

      {formError ? (
        <FormHelperText error role="alert">
          {formError}
        </FormHelperText>
      ) : null}
    </FormDialog>
  );
}
