import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  MenuItem,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { parseApiError } from '@nivela/api-contract';
import type { ApiQuestion, OptionLetter } from '@nivela/api-contract';
import { penShadow } from '@nivela/design-tokens';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import type { FieldPath } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import { ConfirmDialog } from 'src/components/ConfirmDialog';
import { EmptyState } from 'src/components/EmptyState';
import { PageHeader } from 'src/components/PageHeader';
import { StatusChip } from 'src/components/StatusChip';
import { listCategoriesAction } from 'src/features/categories';
import {
  createQuestionAction,
  getQuestionAction,
  setQuestionStatusAction,
  updateQuestionAction,
} from 'src/features/questions/api/questions.action';
import { difficultyLabels } from 'src/features/questions/components/DifficultyChip';
import { ImageUpload } from 'src/features/questions/components/ImageUpload';
import { OptionsEditor } from 'src/features/questions/components/OptionsEditor';
import {
  DIFFICULTIES,
  OPTION_LETTERS,
  questionSchema,
  toQuestionPayload,
} from 'src/features/questions/schemas/question.schema';
import type { QuestionFormOutput, QuestionFormValues } from 'src/features/questions/schemas/question.schema';
import { listSubjectsAction } from 'src/features/subjects';
import { useRemoteList } from 'src/hooks/useRemoteList';
import { useNotify } from 'src/lib/notify/useNotify';
import { validId } from 'src/utils/ids';
import { useNivelaColors } from 'src/lib/theme/useNivelaColors';

const EXPLANATION_HELPER = 'Explique a resolução — o aluno vê depois de responder.';
const READ_ONLY_MESSAGE =
  'Você está vendo esta questão em modo leitura. Só o autor ou um administrador pode editar esta questão.';

function toDefaults(question?: ApiQuestion): QuestionFormValues {
  return {
    subject_id: question ? String(question.subject.id) : '',
    category_id: question ? String(question.category.id) : '',
    difficulty: question?.difficulty ?? '',
    statement: question?.statement ?? '',
    explanation: question?.explanation ?? '',
    options: OPTION_LETTERS.map((letter) => ({
      letter,
      text: question?.options.find((option) => option.letter === letter)?.text ?? '',
    })),
    correct_letter: question?.correct_letter ?? '',
  };
}

/** Campos que a API pode apontar no 422 (`options.2.text` cai na linha C). */
const SERVER_FIELD = /^(subject_id|category_id|statement|difficulty|explanation|correct_letter|options|options\.\d+\.text)$/;

interface Named {
  id: number;
  name: string;
}

/** Garante que o valor já salvo apareça no select enquanto a lista ainda carrega. */
function withKnown(list: Named[], known?: Named): Named[] {
  return known && !list.some((item) => item.id === known.id) ? [known, ...list] : list;
}

function NotFound({ message }: { message: string }) {
  return (
    <EmptyState
      title="Não deu para carregar"
      description={message}
      action={
        <Button variant="contained" component={Link} to="/questoes">
          Voltar para as questões
        </Button>
      }
    />
  );
}

interface QuestionEditorProps {
  /** Questão em edição ou consulta; sem ela, cria uma nova. */
  question?: ApiQuestion;
}

function QuestionEditor({ question }: QuestionEditorProps) {
  const notify = useNotify();
  const navigate = useNavigate();
  const colors = useNivelaColors();
  const [current, setCurrent] = useState(question);
  const [imageUrl, setImageUrl] = useState(question?.image_url ?? null);
  const [formError, setFormError] = useState<string | null>(null);
  const readOnly = current ? !current.can_edit : false;
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);

  async function changeStatus(active: boolean) {
    if (!current) return;
    setTogglingStatus(true);
    try {
      const saved = await setQuestionStatusAction(current.id, active);
      // só a situação muda: o que está digitado no formulário não é tocado
      setCurrent((previous) => (previous ? { ...previous, active: saved.active } : previous));
      notify.success(active ? 'Questão ativada.' : 'Questão desativada.');
    } catch (error) {
      notify.error(parseApiError(error).message);
    } finally {
      setTogglingStatus(false);
      setConfirmingDeactivate(false);
    }
  }

  const {
    control,
    register,
    handleSubmit,
    setError,
    setValue,
    clearErrors,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<QuestionFormValues, unknown, QuestionFormOutput>({
    resolver: zodResolver(questionSchema),
    defaultValues: toDefaults(question),
  });

  const subjectId = useWatch({ control, name: 'subject_id' });
  const { rows: subjects } = useRemoteList((signal) => listSubjectsAction(signal), 'subjects');
  const { rows: categories, loading: categoriesLoading } = useRemoteList(
    (signal) => (subjectId ? listCategoriesAction(subjectId, signal) : Promise.resolve([])),
    subjectId,
  );
  const subjectOptions = withKnown(subjects, current?.subject);
  const categoryOptions = withKnown(
    categories,
    current && String(current.subject.id) === subjectId ? current.category : undefined,
  );

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const payload = toQuestionPayload(values);
      if (current) {
        const saved = await updateQuestionAction(current.id, payload);
        setCurrent(saved);
        reset(toDefaults(saved));
        notify.success('Questão atualizada.');
      } else {
        const saved = await createQuestionAction(payload);
        notify.success('Questão criada.');
        void navigate(`/questoes/${saved.id}`);
      }
    } catch (error) {
      const info = parseApiError(error);
      let matched = false;
      for (const [field, messages] of Object.entries(info.fieldErrors)) {
        if (SERVER_FIELD.test(field)) {
          setError(field as FieldPath<QuestionFormValues>, { message: messages.join(' ') });
          matched = true;
        } else if (field.startsWith('options.')) {
          // outro detalhe das alternativas (ex.: letra repetida): vira o aviso geral do bloco
          setError('options', { message: messages.join(' ') });
          matched = true;
        }
      }
      if (!matched) setFormError(info.message);
    }
  });

  const optionErrors = errors.options;
  const title = !current ? 'Nova questão' : readOnly ? 'Ver questão' : 'Editar questão';
  const { ref: statementRef, ...statementField } = register('statement');
  const { ref: explanationRef, ...explanationField } = register('explanation');

  return (
    <>
      <PageHeader
        title={title}
        subtitle={current ? `Autor: ${current.author.name}` : 'Preencha o enunciado, as cinco alternativas e a explicação.'}
        actions={
          <>
            {current ? <StatusChip active={current.active} /> : null}
            {current?.can_edit ? (
              <FormControlLabel
                label="Questão ativa"
                control={
                  <Switch
                    checked={current.active}
                    disabled={togglingStatus}
                    onChange={(_event, checked) => {
                      if (checked) void changeStatus(true);
                      else setConfirmingDeactivate(true);
                    }}
                  />
                }
              />
            ) : null}
            <Button variant="outlined" component={Link} to="/questoes">
              Voltar
            </Button>
          </>
        }
      />

      <ConfirmDialog
        open={confirmingDeactivate}
        title="Desativar a questão?"
        description="Questões inativas não aparecem para os alunos."
        confirmLabel="Desativar"
        tone="danger"
        loading={togglingStatus}
        onConfirm={() => void changeStatus(false)}
        onClose={() => setConfirmingDeactivate(false)}
      />

      {readOnly ? (
        <Alert severity="info" sx={{ mb: 3 }}>
          {READ_ONLY_MESSAGE}
        </Alert>
      ) : null}

      <Box
        component="form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        aria-busy={isSubmitting || undefined}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          p: { xs: 2, sm: 3 },
          maxWidth: 880,
          border: `${penShadow.width}px solid ${colors.border}`,
          borderRadius: 2,
          boxShadow: `${penShadow.offset}px ${penShadow.offset}px 0 ${colors.shadow}`,
          backgroundColor: 'background.paper',
        }}
      >
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
          <Controller
            name="subject_id"
            control={control}
            render={({ field }) => (
              <TextField
                select
                label="Disciplina"
                value={field.value}
                inputRef={field.ref}
                onBlur={field.onBlur}
                disabled={readOnly}
                onChange={(event) => {
                  field.onChange(event);
                  // outra disciplina, outras categorias: a escolhida deixa de valer
                  setValue('category_id', '');
                  clearErrors('category_id');
                }}
                error={Boolean(errors.subject_id)}
                helperText={errors.subject_id?.message}
              >
                {subjectOptions.map((subject) => (
                  <MenuItem key={subject.id} value={String(subject.id)}>
                    {subject.name}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
          <Controller
            name="category_id"
            control={control}
            render={({ field }) => (
              <TextField
                select
                label="Categoria"
                value={field.value}
                inputRef={field.ref}
                onBlur={field.onBlur}
                onChange={field.onChange}
                disabled={readOnly || !subjectId || (categoriesLoading && categoryOptions.length === 0)}
                error={Boolean(errors.category_id)}
                helperText={errors.category_id?.message ?? (subjectId ? undefined : 'Escolha a disciplina primeiro.')}
              >
                {categoryOptions.map((category) => (
                  <MenuItem key={category.id} value={String(category.id)}>
                    {category.name}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
        </Box>

        <Controller
          name="difficulty"
          control={control}
          render={({ field }) => (
            <Box>
              <FormLabel id="difficulty-label" sx={{ display: 'block', mb: 1, fontWeight: 700 }}>
                Dificuldade
              </FormLabel>
              <ToggleButtonGroup
                exclusive
                color="primary"
                aria-labelledby="difficulty-label"
                value={field.value || null}
                disabled={readOnly}
                onChange={(_event, value: string | null) => {
                  if (value) field.onChange(value);
                }}
              >
                {DIFFICULTIES.map((difficulty) => (
                  <ToggleButton key={difficulty} value={difficulty} sx={{ px: 3 }}>
                    {difficultyLabels[difficulty]}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
              {errors.difficulty ? <FormHelperText error>{errors.difficulty.message}</FormHelperText> : null}
            </Box>
          )}
        />

        <TextField
          label="Enunciado"
          multiline
          minRows={4}
          inputRef={statementRef}
          {...statementField}
          disabled={readOnly}
          error={Boolean(errors.statement)}
          helperText={errors.statement?.message}
        />

        <ImageUpload
          questionId={current?.id}
          imageUrl={imageUrl}
          canEdit={!readOnly}
          onChange={setImageUrl}
        />

        <Controller
          name="options"
          control={control}
          render={({ field }) => (
            <Controller
              name="correct_letter"
              control={control}
              render={({ field: correct }) => (
                <OptionsEditor
                  options={field.value}
                  correctLetter={correct.value}
                  disabled={readOnly}
                  onTextChange={(index, text) =>
                    field.onChange(field.value.map((option, i) => (i === index ? { ...option, text } : option)))
                  }
                  onCorrectChange={(letter: OptionLetter) => correct.onChange(letter)}
                  textErrors={OPTION_LETTERS.map((_letter, index) => optionErrors?.[index]?.text?.message)}
                  generalError={optionErrors?.message}
                  correctError={errors.correct_letter?.message}
                />
              )}
            />
          )}
        />

        <TextField
          label="Explicação"
          multiline
          minRows={3}
          inputRef={explanationRef}
          {...explanationField}
          disabled={readOnly}
          error={Boolean(errors.explanation)}
          helperText={errors.explanation?.message ?? EXPLANATION_HELPER}
        />

        {formError ? <Alert severity="error">{formError}</Alert> : null}

        {readOnly ? null : (
          <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <Button component={Link} to="/questoes" color="inherit" disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={isSubmitting}
              startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" aria-hidden /> : undefined}
            >
              {current ? 'Salvar alterações' : 'Criar questão'}
            </Button>
          </Box>
        )}
      </Box>
    </>
  );
}

function QuestionLoader({ id }: { id: number }) {
  const { rows, loading, error } = useRemoteList<ApiQuestion>(
    async (signal) => [await getQuestionAction(id, signal)],
    String(id),
  );
  if (error) return <NotFound message={error} />;
  if (loading || !rows[0]) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress aria-label="Carregando" />
      </Box>
    );
  }
  return <QuestionEditor key={rows[0].id} question={rows[0]} />;
}

/** Criar (`/questoes/nova`) e editar ou consultar (`/questoes/:id`) uma questão na mesma página. */
export function QuestionForm() {
  const { id } = useParams();
  if (id === undefined) return <QuestionEditor key="new" />;
  if (!validId(id)) return <NotFound message="Questão não encontrada." />;
  return <QuestionLoader key={id} id={Number(id)} />;
}
