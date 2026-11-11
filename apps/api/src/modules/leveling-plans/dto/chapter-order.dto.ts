import { ArrayMaxSize, IsArray, IsInt, Max, Min } from 'class-validator';

const MAX_ID = 2_147_483_647;
const MESSAGE = 'Informe todos os capítulos do plano, sem repetir.';

/** Corpo de `PUT /plans/:id/chapters/order`: os ids na nova ordem. */
export class ChapterOrderDto {
  @IsArray({ message: MESSAGE })
  @ArrayMaxSize(200, { message: MESSAGE })
  @IsInt({ each: true, message: MESSAGE })
  @Min(1, { each: true, message: MESSAGE })
  @Max(MAX_ID, { each: true, message: MESSAGE })
  chapter_ids: number[];
}
