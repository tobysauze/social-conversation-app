-- CreateTable
CREATE TABLE "dream_entries" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "title" TEXT,
    "sleep_quality" TEXT,
    "tags" TEXT,
    "analysis" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dream_entries_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "dream_entries" ADD CONSTRAINT "dream_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
