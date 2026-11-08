import { IsBoolean } from 'class-validator';

/** Corpo de `PATCH /teachers/:id/status`. */
export class TeacherStatusDto {
  @IsBoolean({ message: 'Informe se o professor está ativo.' })
  active: boolean;
}
