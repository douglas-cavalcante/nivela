import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';
import { JoinCodeService } from 'src/modules/classrooms/join-code.service';

/** Corpo de `POST /me/classrooms`. */
export class JoinClassroomDto {
  /** Código passado pelo professor (ex.: `NIV-4K7Q`; espaços e minúsculas são aceitos). */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? JoinCodeService.normalize(value) : value,
  )
  @IsString({ message: 'Informe o código da turma.' })
  @IsNotEmpty({ message: 'Informe o código da turma.' })
  join_code: string;
}
