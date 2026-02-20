-- CreateTable
CREATE TABLE "person_inside_jokes" (
    "id" SERIAL NOT NULL,
    "person_id" INTEGER NOT NULL,
    "joke" TEXT NOT NULL,
    "context" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "person_inside_jokes_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "person_inside_jokes" ADD CONSTRAINT "person_inside_jokes_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
