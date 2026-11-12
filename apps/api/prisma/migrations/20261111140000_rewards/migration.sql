-- CreateEnum
CREATE TYPE "redemption_status" AS ENUM ('pending', 'delivered', 'rejected');

-- CreateTable
CREATE TABLE "rewards" (
    "id" SERIAL NOT NULL,
    "created_by" INTEGER NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "description" VARCHAR(500),
    "image_path" VARCHAR(255),
    "price" INTEGER NOT NULL,
    "stock" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "rewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_redemptions" (
    "id" SERIAL NOT NULL,
    "reward_id" INTEGER NOT NULL,
    "student_id" INTEGER NOT NULL,
    "price_paid" INTEGER NOT NULL,
    "status" "redemption_status" NOT NULL DEFAULT 'pending',
    "handled_by" INTEGER,
    "handled_at" TIMESTAMPTZ(3),
    "rejection_reason" VARCHAR(300),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "reward_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rewards_created_by_idx" ON "rewards"("created_by");

-- CreateIndex
CREATE INDEX "reward_redemptions_student_id_created_at_idx" ON "reward_redemptions"("student_id", "created_at");

-- CreateIndex
CREATE INDEX "reward_redemptions_status_idx" ON "reward_redemptions"("status");

-- CreateIndex
CREATE INDEX "reward_redemptions_reward_id_idx" ON "reward_redemptions"("reward_id");

-- CreateIndex
CREATE INDEX "reward_redemptions_handled_by_idx" ON "reward_redemptions"("handled_by");

-- AddForeignKey
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_reward_id_fkey" FOREIGN KEY ("reward_id") REFERENCES "rewards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_handled_by_fkey" FOREIGN KEY ("handled_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;



-- Restrições que o Prisma não representa no schema (à mão) ----------------

-- Preço e estoque dentro dos limites, nem por bug da aplicação.
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_price_check" CHECK ("price" BETWEEN 1 AND 100000);
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_stock_check" CHECK ("stock" >= 0);

-- Resgate recusado sempre traz o motivo.
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_rejection_reason_check" CHECK ("status" <> 'rejected' OR ("rejection_reason" IS NOT NULL AND length(btrim("rejection_reason")) > 0));

-- Estorno uma vez por resgate (source_id = id do resgate).
CREATE UNIQUE INDEX "coin_once_per_refund" ON "coin_transactions"("student_id", "source_id") WHERE "reason" = 'refund';
