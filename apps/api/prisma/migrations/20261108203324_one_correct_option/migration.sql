-- Índice único parcial (o Prisma não o representa no schema): cada questão tem
-- no máximo uma alternativa correta.
CREATE UNIQUE INDEX "question_options_one_correct_key" ON "question_options"("question_id") WHERE "is_correct";
