-- CreateEnum
CREATE TYPE "plan_status" AS ENUM ('draft', 'published');

-- CreateTable
CREATE TABLE "leveling_plans" (
    "id" SERIAL NOT NULL,
    "teacher_id" INTEGER NOT NULL,
    "subject_id" INTEGER NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" VARCHAR(1000),
    "completion_bonus" INTEGER NOT NULL DEFAULT 50,
    "status" "plan_status" NOT NULL DEFAULT 'draft',
    "published_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "leveling_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_chapters" (
    "id" SERIAL NOT NULL,
    "leveling_plan_id" INTEGER NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "plan_chapters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chapter_question" (
    "plan_chapter_id" INTEGER NOT NULL,
    "question_id" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "chapter_question_pkey" PRIMARY KEY ("plan_chapter_id","question_id")
);

-- CreateTable
CREATE TABLE "plan_assignments" (
    "id" SERIAL NOT NULL,
    "leveling_plan_id" INTEGER NOT NULL,
    "classroom_id" INTEGER,
    "student_id" INTEGER,
    "due_date" DATE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chapter_completions" (
    "student_id" INTEGER NOT NULL,
    "plan_chapter_id" INTEGER NOT NULL,
    "completed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chapter_completions_pkey" PRIMARY KEY ("student_id","plan_chapter_id")
);

-- CreateTable
CREATE TABLE "plan_completions" (
    "student_id" INTEGER NOT NULL,
    "leveling_plan_id" INTEGER NOT NULL,
    "completed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bonus_awarded" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "plan_completions_pkey" PRIMARY KEY ("student_id","leveling_plan_id")
);

-- CreateIndex
CREATE INDEX "leveling_plans_teacher_id_idx" ON "leveling_plans"("teacher_id");

-- CreateIndex
CREATE INDEX "leveling_plans_subject_id_idx" ON "leveling_plans"("subject_id");

-- CreateIndex
CREATE INDEX "plan_chapters_leveling_plan_id_idx" ON "plan_chapters"("leveling_plan_id");

-- CreateIndex
CREATE INDEX "chapter_question_question_id_idx" ON "chapter_question"("question_id");

-- CreateIndex
CREATE INDEX "plan_assignments_leveling_plan_id_idx" ON "plan_assignments"("leveling_plan_id");

-- CreateIndex
CREATE INDEX "plan_assignments_classroom_id_idx" ON "plan_assignments"("classroom_id");

-- CreateIndex
CREATE INDEX "plan_assignments_student_id_idx" ON "plan_assignments"("student_id");

-- CreateIndex
CREATE INDEX "chapter_completions_plan_chapter_id_idx" ON "chapter_completions"("plan_chapter_id");

-- CreateIndex
CREATE INDEX "plan_completions_leveling_plan_id_idx" ON "plan_completions"("leveling_plan_id");

-- CreateIndex
CREATE INDEX "question_attempts_plan_chapter_id_idx" ON "question_attempts"("plan_chapter_id");

-- AddForeignKey
ALTER TABLE "question_attempts" ADD CONSTRAINT "question_attempts_plan_chapter_id_fkey" FOREIGN KEY ("plan_chapter_id") REFERENCES "plan_chapters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leveling_plans" ADD CONSTRAINT "leveling_plans_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leveling_plans" ADD CONSTRAINT "leveling_plans_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_chapters" ADD CONSTRAINT "plan_chapters_leveling_plan_id_fkey" FOREIGN KEY ("leveling_plan_id") REFERENCES "leveling_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_question" ADD CONSTRAINT "chapter_question_plan_chapter_id_fkey" FOREIGN KEY ("plan_chapter_id") REFERENCES "plan_chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_question" ADD CONSTRAINT "chapter_question_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_assignments" ADD CONSTRAINT "plan_assignments_leveling_plan_id_fkey" FOREIGN KEY ("leveling_plan_id") REFERENCES "leveling_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_assignments" ADD CONSTRAINT "plan_assignments_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "classrooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_assignments" ADD CONSTRAINT "plan_assignments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_completions" ADD CONSTRAINT "chapter_completions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_completions" ADD CONSTRAINT "chapter_completions_plan_chapter_id_fkey" FOREIGN KEY ("plan_chapter_id") REFERENCES "plan_chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_completions" ADD CONSTRAINT "plan_completions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_completions" ADD CONSTRAINT "plan_completions_leveling_plan_id_fkey" FOREIGN KEY ("leveling_plan_id") REFERENCES "leveling_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- Restrições que o Prisma não representa no schema (à mão) ----------------

-- Bônus de conclusão entre 0 e 500 moedas.
ALTER TABLE "leveling_plans" ADD CONSTRAINT "leveling_plans_completion_bonus_check" CHECK ("completion_bonus" BETWEEN 0 AND 500);

-- A atribuição vale para exatamente um alvo: turma ou aluno.
ALTER TABLE "plan_assignments" ADD CONSTRAINT "plan_assignments_one_target_check" CHECK (("classroom_id" IS NULL) <> ("student_id" IS NULL));

-- Um plano é atribuído uma vez a cada turma e uma vez a cada aluno.
CREATE UNIQUE INDEX "plan_assignments_classroom_key" ON "plan_assignments"("leveling_plan_id", "classroom_id") WHERE "classroom_id" IS NOT NULL;
CREATE UNIQUE INDEX "plan_assignments_student_key" ON "plan_assignments"("leveling_plan_id", "student_id") WHERE "student_id" IS NOT NULL;

-- Posições únicas, mas conferidas só no commit: reordenar troca posições
-- dentro de uma transação sem violar a unicidade no meio do caminho.
ALTER TABLE "plan_chapters" ADD CONSTRAINT "plan_chapters_position_key" UNIQUE ("leveling_plan_id", "position") DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "chapter_question" ADD CONSTRAINT "chapter_question_position_key" UNIQUE ("plan_chapter_id", "position") DEFERRABLE INITIALLY DEFERRED;
