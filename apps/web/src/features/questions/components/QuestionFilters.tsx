import { Box, MenuItem, TextField } from '@mui/material';
import type { ApiCategory, ApiSubject, Difficulty } from '@nivela/api-contract';
import { SearchField } from 'src/components/SearchField';
import { difficultyLabels } from 'src/features/questions/components/DifficultyChip';

export interface QuestionFilterValues {
  search: string;
  subject_id: string;
  category_id: string;
  difficulty: '' | Difficulty;
  status: '' | 'active' | 'inactive';
}

interface QuestionFiltersProps {
  values: QuestionFilterValues;
  subjects: ApiSubject[];
  /** Categorias da disciplina escolhida (vazio sem disciplina). */
  categories: ApiCategory[];
  onChange: (patch: Partial<QuestionFilterValues>) => void;
}

const selectProps = { inputLabel: { shrink: true }, select: { displayEmpty: true } } as const;

/** Filtros da lista de questões; a categoria só vale dentro de uma disciplina. */
export function QuestionFilters({ values, subjects, categories, onChange }: QuestionFiltersProps) {
  const subjectValue = subjects.some((subject) => String(subject.id) === values.subject_id) ? values.subject_id : '';
  const categoryValue = categories.some((category) => String(category.id) === values.category_id)
    ? values.category_id
    : '';

  return (
    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
      <SearchField
        label="Buscar no enunciado"
        value={values.search}
        onChange={(value) => onChange({ search: value })}
      />
      <TextField
        select
        size="small"
        label="Disciplina"
        value={subjectValue}
        // outra disciplina, outras categorias: a categoria escolhida deixa de valer
        onChange={(event) => onChange({ subject_id: event.target.value, category_id: '' })}
        slotProps={selectProps}
        sx={{ minWidth: 180 }}
      >
        <MenuItem value="">Todas</MenuItem>
        {subjects.map((subject) => (
          <MenuItem key={subject.id} value={String(subject.id)}>
            {subject.name}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        select
        size="small"
        label="Categoria"
        value={categoryValue}
        disabled={!values.subject_id}
        onChange={(event) => onChange({ category_id: event.target.value })}
        slotProps={selectProps}
        sx={{ minWidth: 180 }}
      >
        <MenuItem value="">Todas</MenuItem>
        {categories.map((category) => (
          <MenuItem key={category.id} value={String(category.id)}>
            {category.name}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        select
        size="small"
        label="Dificuldade"
        value={values.difficulty}
        onChange={(event) => onChange({ difficulty: event.target.value as QuestionFilterValues['difficulty'] })}
        slotProps={selectProps}
        sx={{ minWidth: 150 }}
      >
        <MenuItem value="">Todas</MenuItem>
        {(Object.keys(difficultyLabels) as Difficulty[]).map((difficulty) => (
          <MenuItem key={difficulty} value={difficulty}>
            {difficultyLabels[difficulty]}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        select
        size="small"
        label="Situação"
        value={values.status}
        onChange={(event) => onChange({ status: event.target.value as QuestionFilterValues['status'] })}
        slotProps={selectProps}
        sx={{ minWidth: 150 }}
      >
        <MenuItem value="">Todas</MenuItem>
        <MenuItem value="active">Ativas</MenuItem>
        <MenuItem value="inactive">Inativas</MenuItem>
      </TextField>
    </Box>
  );
}
