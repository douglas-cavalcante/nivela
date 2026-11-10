-- DropForeignKey
ALTER TABLE "question_attempts" DROP CONSTRAINT "question_attempts_selected_option_id_fkey";

-- CreateIndex
CREATE INDEX "question_attempts_question_id_idx" ON "question_attempts"("question_id");

-- CreateIndex
CREATE INDEX "question_attempts_selected_option_id_idx" ON "question_attempts"("selected_option_id");

-- CreateIndex
CREATE UNIQUE INDEX "question_options_id_question_id_key" ON "question_options"("id", "question_id");

-- AddForeignKey
ALTER TABLE "question_attempts" ADD CONSTRAINT "question_attempts_option_question_fkey" FOREIGN KEY ("selected_option_id", "question_id") REFERENCES "question_options"("id", "question_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

