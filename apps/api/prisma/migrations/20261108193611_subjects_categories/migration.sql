-- CreateTable
CREATE TABLE "subjects" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "color" VARCHAR(20) NOT NULL,
    "icon" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" SERIAL NOT NULL,
    "subject_id" INTEGER NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "categories_subject_id_idx" ON "categories"("subject_id");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Índices únicos funcionais (o Prisma não os representa no schema): o nome é
-- único sem diferenciar maiúsculas/minúsculas ("Matemática" = "matemática").
CREATE UNIQUE INDEX "subjects_name_key" ON "subjects" (lower("name"));
CREATE UNIQUE INDEX "categories_subject_name_key" ON "categories" ("subject_id", lower("name"));
