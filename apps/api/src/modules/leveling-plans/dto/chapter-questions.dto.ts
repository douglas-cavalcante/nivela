import { ArrayMaxSize, IsArray, IsInt, Max, Min } from 'class-validator';

const MAX_ID = 2_147_483_647;
export const QUESTIONS_MESSAGE =
  'Escolha questões ativas da disciplina do plano.';

/** Corpo de `PUT /plans/:id/chapters/:chapterId/questions`: ids na ordem do capítulo. */
export class ChapterQuestionsDto {
  @IsArray({ message: QUESTIONS_MESSAGE })
  @ArrayMaxSize(200, { message: QUESTIONS_MESSAGE })
  @IsInt({ each: true, message: QUESTIONS_MESSAGE })
  @Min(1, { each: true, message: QUESTIONS_MESSAGE })
  @Max(MAX_ID, { each: true, message: QUESTIONS_MESSAGE })
  question_ids: number[];
}
