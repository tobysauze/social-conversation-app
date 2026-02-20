-- CreateTable
CREATE TABLE "person_conversation_topics" (
    "id" SERIAL NOT NULL,
    "person_id" INTEGER NOT NULL,
    "topic" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "person_conversation_topics_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "person_conversation_topics" ADD CONSTRAINT "person_conversation_topics_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
