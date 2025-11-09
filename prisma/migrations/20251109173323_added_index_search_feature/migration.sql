-- DropForeignKey
ALTER TABLE "Persona" DROP CONSTRAINT "Persona_categoryId_fkey";

-- CreateIndex
CREATE INDEX "Persona_name_idx" ON "Persona"("name");
