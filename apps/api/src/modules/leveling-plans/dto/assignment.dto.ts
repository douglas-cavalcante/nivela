import {
  IsInt,
  IsISO8601,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { Trim } from 'src/common/decorators/trim.decorator';

const MAX_ID = 2_147_483_647;
const DATE_MESSAGE = 'A data limite deve estar no formato AAAA-MM-DD.';

/** Corpo de `POST /plans/:id/assignments`: `classroom_id` OU `student_id`. */
export class AssignmentDto {
  @IsOptional()
  @IsInt({ message: 'Turma não encontrada.' })
  @Min(1, { message: 'Turma não encontrada.' })
  @Max(MAX_ID, { message: 'Turma não encontrada.' })
  classroom_id?: number;

  @IsOptional()
  @IsInt({ message: 'Aluno não encontrado.' })
  @Min(1, { message: 'Aluno não encontrado.' })
  @Max(MAX_ID, { message: 'Aluno não encontrado.' })
  student_id?: number;

  /** Data limite (`AAAA-MM-DD`), hoje ou depois; vazio ou null = sem prazo. */
  @IsOptional()
  @Trim({ emptyAsNull: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: DATE_MESSAGE })
  @IsISO8601({ strict: true }, { message: DATE_MESSAGE })
  due_date?: string | null;
}
