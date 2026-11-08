-- CreateEnum
CREATE TYPE "difficulty" AS ENUM ('easy', 'medium', 'hard');

-- CreateTable
CREATE TABLE "questions" (
    "id" SERIAL NOT NULL,
    "author_id" INTEGER NOT NULL,
    "subject_id" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL,
    "statement" TEXT NOT NULL,
    "image_path" VARCHAR(255),
    "difficulty" "difficulty" NOT NULL,
    "explanation" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_options" (
    "id" SERIAL NOT NULL,
    "question_id" INTEGER NOT NULL,
    "letter" CHAR(1) NOT NULL,
    "text" TEXT NOT NULL,
    "is_correct" BOOLEAN NOT NULL,

    CONSTRAINT "question_options_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "questions_subject_id_category_id_active_idx" ON "questions"("subject_id", "category_id", "active");

-- CreateIndex
CREATE INDEX "questions_author_id_idx" ON "questions"("author_id");

-- CreateIndex
CREATE UNIQUE INDEX "question_options_question_id_letter_key" ON "question_options"("question_id", "letter");

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
