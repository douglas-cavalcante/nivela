import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { ClassroomDto } from 'src/modules/classrooms/dto/classroom.dto';

const MAX_ID = 2_147_483_647;
const TEACHER_MESSAGE = 'Informe o professor da turma.';

/** Corpo de `POST /classrooms`. */
export class CreateClassroomDto extends ClassroomDto {
  /** Só o administrador usa (e precisa informar); para o professor é ignorado. */
  @IsOptional()
  @IsInt({ message: TEACHER_MESSAGE })
  @Min(1, { message: TEACHER_MESSAGE })
  @Max(MAX_ID, { message: TEACHER_MESSAGE })
  teacher_id?: number;
}
