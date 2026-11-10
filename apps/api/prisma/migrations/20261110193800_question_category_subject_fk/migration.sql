-- A categoria da questão deve pertencer à disciplina da questão: FK composta
-- (category_id, subject_id) -> categories (id, subject_id). Substitui a FK
-- simples questions_category_id_fkey, que fica coberta pela composta.

-- DropForeignKey
ALTER TABLE "questions" DROP CONSTRAINT "questions_category_id_fkey";

-- CreateIndex
CREATE UNIQUE INDEX "categories_id_subject_id_key" ON "categories"("id", "subject_id");

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_category_subject_fkey" FOREIGN KEY ("category_id", "subject_id") REFERENCES "categories"("id", "subject_id") ON DELETE RESTRICT ON UPDATE NO ACTION;
