-- CreateTable
CREATE TABLE "Persona" (
    "id" TEXT NOT NULL,
    "userid" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "imgSrc" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "instruction" TEXT NOT NULL,
    "seed" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "Persona_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Persona_categoryId_idx" ON "Persona"("categoryId");

-- AddForeignKey
ALTER TABLE "Persona" ADD CONSTRAINT "Persona_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
