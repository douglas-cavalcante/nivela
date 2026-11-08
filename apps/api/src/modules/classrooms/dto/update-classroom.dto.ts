import { IsBoolean, IsOptional } from 'class-validator';
import { ClassroomDto } from 'src/modules/classrooms/dto/classroom.dto';

/** Corpo de `PUT /classrooms/:id`. */
export class UpdateClassroomDto extends ClassroomDto {
  @IsOptional()
  @IsBoolean({ message: 'Informe se a turma está ativa.' })
  active?: boolean;
}
