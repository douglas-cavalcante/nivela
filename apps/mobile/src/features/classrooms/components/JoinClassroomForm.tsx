import { zodResolver } from '@hookform/resolvers/zod';
import { spacing } from '@nivela/design-tokens';
import { parseApiError } from '@nivela/api-contract';
import type { ApiMyClassroom } from '@nivela/api-contract';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { AppText } from 'src/components/AppText';
import { Button } from 'src/components/Button';
import { TextField } from 'src/components/TextField';
import { joinClassroomAction } from 'src/features/classrooms/api/classrooms.action';
import { joinSchema } from 'src/features/classrooms/schemas/join.schema';
import type { JoinFormValues, JoinPayloadValues } from 'src/features/classrooms/schemas/join.schema';
import { useTheme } from 'src/lib/theme/useTheme';

interface JoinClassroomFormProps {
  onJoined: (classroom: ApiMyClassroom) => void;
}

/** Campo do código da turma + "Entrar": o erro 422 da API aparece no próprio campo. */
export function JoinClassroomForm({ onJoined }: JoinClassroomFormProps) {
  const { colors } = useTheme();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    setError,
    formState: { isSubmitting },
  } = useForm<JoinFormValues, unknown, JoinPayloadValues>({
    resolver: zodResolver(joinSchema),
    defaultValues: { join_code: '' },
  });

  const onSubmit = async (values: JoinPayloadValues) => {
    setServerError(null);
    try {
      onJoined(await joinClassroomAction(values.join_code));
    } catch (error) {
      const info = parseApiError(error);
      const codeErrors = info.fieldErrors.join_code;
      if (codeErrors) setError('join_code', { message: codeErrors.join(' ') });
      else setServerError(info.message);
    }
  };

  const submit = () => {
    void handleSubmit(onSubmit)();
  };

  return (
    <View style={styles.form}>
      <Controller
        control={control}
        name="join_code"
        render={({ field, fieldState }) => (
          <TextField
            label="Código da turma"
            hint="Peça ao seu professor. Ex.: NIV-4K7Q"
            emphasis
            autoCapitalize="characters"
            autoCorrect={false}
            spellCheck={false}
            returnKeyType="go"
            onSubmitEditing={submit}
            value={field.value}
            onChangeText={(text) => field.onChange(text.toUpperCase())}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
          />
        )}
      />
      {serverError ? (
        <AppText accessibilityRole="alert" accessibilityLiveRegion="polite" size={14} style={{ color: colors.danger }}>
          {serverError}
        </AppText>
      ) : null}
      <Button title={isSubmitting ? 'Entrando…' : 'Entrar'} loading={isSubmitting} onPress={submit} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing(3) },
});
