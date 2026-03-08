/*
  Warnings:

  - You are about to drop the `book_summaries` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "book_summaries" DROP CONSTRAINT "book_summaries_user_id_fkey";

-- DropTable
DROP TABLE "book_summaries";

-- CreateTable
CREATE TABLE "anxiety_triggers" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "intensity" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anxiety_triggers_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "anxiety_triggers" ADD CONSTRAINT "anxiety_triggers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
