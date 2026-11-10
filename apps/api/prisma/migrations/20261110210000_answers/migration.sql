-- CreateEnum
CREATE TYPE "coin_reason" AS ENUM ('correct_answer', 'plan_completed', 'streak_bonus', 'redemption', 'refund');

-- CreateTable
CREATE TABLE "question_attempts" (
    "id" SERIAL NOT NULL,
    "student_id" INTEGER NOT NULL,
    "question_id" INTEGER NOT NULL,
    "plan_chapter_id" INTEGER,
    "selected_option_id" INTEGER NOT NULL,
    "attempt_number" SMALLINT NOT NULL,
    "is_correct" BOOLEAN NOT NULL,
    "coins_awarded" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coin_transactions" (
    "id" SERIAL NOT NULL,
    "student_id" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" "coin_reason" NOT NULL,
    "source_type" VARCHAR(30) NOT NULL,
    "source_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coin_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "question_attempts_student_id_question_id_idx" ON "question_attempts"("student_id", "question_id");

-- CreateIndex
CREATE INDEX "coin_transactions_student_id_created_at_idx" ON "coin_transactions"("student_id", "created_at");

-- AddForeignKey
ALTER TABLE "question_attempts" ADD CONSTRAINT "question_attempts_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_attempts" ADD CONSTRAINT "question_attempts_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_attempts" ADD CONSTRAINT "question_attempts_selected_option_id_fkey" FOREIGN KEY ("selected_option_id") REFERENCES "question_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coin_transactions" ADD CONSTRAINT "coin_transactions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Restrições que o Prisma não representa no schema (à mão) ----------------

-- Tentativa 1 ou 2 por questão no contexto.
ALTER TABLE "question_attempts" ADD CONSTRAINT "question_attempts_attempt_number_check" CHECK ("attempt_number" IN (1, 2));

-- Uma tentativa por número, separadamente na prática (sem capítulo) e em cada capítulo.
CREATE UNIQUE INDEX "question_attempts_practice_key" ON "question_attempts"("student_id", "question_id", "attempt_number") WHERE "plan_chapter_id" IS NULL;
CREATE UNIQUE INDEX "question_attempts_chapter_key" ON "question_attempts"("student_id", "question_id", "plan_chapter_id", "attempt_number") WHERE "plan_chapter_id" IS NOT NULL;

-- Extrato: sem lançamento zerado.
ALTER TABLE "coin_transactions" ADD CONSTRAINT "coin_transactions_amount_check" CHECK ("amount" <> 0);

-- Crédito "uma vez" por origem: questão, plano concluído e dia de bônus de sequência.
CREATE UNIQUE INDEX "coin_once_per_question" ON "coin_transactions"("student_id", "source_id") WHERE "reason" = 'correct_answer';
CREATE UNIQUE INDEX "coin_once_per_plan" ON "coin_transactions"("student_id", "source_id") WHERE "reason" = 'plan_completed';
CREATE UNIQUE INDEX "coin_once_per_streak_day" ON "coin_transactions"("student_id", "source_id") WHERE "reason" = 'streak_bonus';

-- O saldo nunca fica negativo, nem por bug da aplicação.
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_coins_balance_check" CHECK ("coins_balance" >= 0);
