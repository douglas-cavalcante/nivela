import { FormControl, FormControlLabel, FormHelperText, FormLabel, Radio, RadioGroup, TextField } from '@mui/material';
import { parseApiError } from '@nivela/api-contract';
import type { ApiClassroomSummary, ApiPlanAssignment, ApiStudentSummary } from '@nivela/api-contract';
import { useState } from 'react';
import { AsyncAutocomplete } from 'src/components/AsyncAutocomplete';
import { FormDialog } from 'src/components/FormDialog';
import { listClassroomsAction } from 'src/features/classrooms';
import { createAssignmentAction } from 'src/features/leveling-plans/api/plans.action';
import type { AssignmentPayload } from 'src/features/leveling-plans/schemas/plan.schema';
import { listStudentsAction } from 'src/features/students';

type TargetType = 'classroom' | 'student';

interface AssignDialogProps {
  planId: number;
  onClose: () => void;
  onSaved: (assignment: ApiPlanAssignment) => void;
}

const PER_PAGE = 20;

/** Hoje (dia local) no formato `AAAA-MM-DD`: o menor prazo que o campo de data aceita. */
function today(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Atribui o plano a uma turma ou a um aluno, com prazo opcional. */
export function AssignDialog({ planId, onClose, onSaved }: AssignDialogProps) {
  const [type, setType] = useState<TargetType>('classroom');
  const [classroom, setClassroom] = useState<ApiClassroomSummary | null>(null);
  const [student, setStudent] = useState<ApiStudentSummary | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [targetError, setTargetError] = useState<string | undefined>();
  const [dueError, setDueError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function changeType(next: TargetType) {
    setType(next);
    setTargetError(undefined);
  }

  async function submit() {
    setFormError(null);
    setDueError(undefined);
    const picked = type === 'classroom' ? classroom : student;
    if (!picked) {
      setTargetError(type === 'classroom' ? 'Escolha a turma.' : 'Escolha o aluno.');
      return;
    }
    setTargetError(undefined);
    const payload: AssignmentPayload =
      type === 'classroom'
        ? { classroom_id: picked.id, due_date: dueDate || null }
        : { student_id: picked.id, due_date: dueDate || null };
    setSaving(true);
    try {
      onSaved(await createAssignmentAction(planId, payload));
    } catch (error) {
      const info = parseApiError(error);
      const targetMessages = info.fieldErrors[type === 'classroom' ? 'classroom_id' : 'student_id'];
      const dueMessages = info.fieldErrors.due_date;
      if (targetMessages) setTargetError(targetMessages.join(' '));
      if (dueMessages) setDueError(dueMessages.join(' '));
      if (!targetMessages && !dueMessages) setFormError(info.message);
      setSaving(false);
    }
  }

  return (
    <FormDialog
      open
      title="Atribuir plano"
      submitLabel="Atribuir"
      loading={saving}
      onSubmit={() => void submit()}
      onClose={onClose}
    >
      <FormControl>
        <FormLabel id="assign-type-label">Atribuir a</FormLabel>
        <RadioGroup
          row
          aria-labelledby="assign-type-label"
          value={type}
          onChange={(event) => changeType(event.target.value === 'student' ? 'student' : 'classroom')}
        >
          <FormControlLabel value="classroom" control={<Radio />} label="Turma" />
          <FormControlLabel value="student" control={<Radio />} label="Aluno" />
        </RadioGroup>
      </FormControl>

      {type === 'classroom' ? (
        <AsyncAutocomplete<ApiClassroomSummary>
          key="classroom"
          label="Buscar turma"
          value={classroom}
          onChange={(next) => {
            setClassroom(next);
            setTargetError(undefined);
          }}
          load={async (search, signal) =>
            (await listClassroomsAction({ search: search || undefined, per_page: PER_PAGE }, signal)).data
          }
          getOptionLabel={(option) => option.name}
          getOptionKey={(option) => option.id}
          error={targetError}
        />
      ) : (
        <AsyncAutocomplete<ApiStudentSummary>
          key="student"
          label="Buscar aluno"
          value={student}
          onChange={(next) => {
            setStudent(next);
            setTargetError(undefined);
          }}
          load={async (search, signal) =>
            (await listStudentsAction({ search: search || undefined, per_page: PER_PAGE }, signal)).data
          }
          getOptionLabel={(option) => option.name}
          getOptionKey={(option) => option.id}
          error={targetError}
        />
      )}

      <TextField
        label="Prazo (opcional)"
        type="date"
        value={dueDate}
        onChange={(event) => setDueDate(event.target.value)}
        slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: today() } }}
        error={Boolean(dueError)}
        helperText={dueError ?? 'O aluno vê a data limite junto com o plano.'}
      />

      {formError ? (
        <FormHelperText error role="alert">
          {formError}
        </FormHelperText>
      ) : null}
    </FormDialog>
  );
}
