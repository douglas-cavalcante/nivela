-- Todas as colunas de data e hora passam a TIMESTAMPTZ(3).
-- Os valores antigos (TIMESTAMP sem fuso) foram gravados pelo Prisma em UTC;
-- o USING ... AT TIME ZONE 'UTC' os interpreta assim, independentemente do
-- fuso da sessão do Postgres.

-- AlterTable
ALTER TABLE "access_tokens"
  ALTER COLUMN "last_used_at" TYPE TIMESTAMPTZ(3) USING "last_used_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "classroom_student"
  ALTER COLUMN "joined_at" TYPE TIMESTAMPTZ(3) USING "joined_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "classrooms"
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "users"
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';
