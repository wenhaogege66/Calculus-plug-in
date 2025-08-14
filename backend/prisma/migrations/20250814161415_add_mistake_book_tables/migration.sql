-- CreateTable
CREATE TABLE "mistake_categories" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "parent_id" INTEGER,
    "level" INTEGER NOT NULL DEFAULT 1,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "color" VARCHAR(20),
    "icon" VARCHAR(50),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mistake_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mistake_items" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "submission_id" INTEGER NOT NULL,
    "category_id" INTEGER,
    "title" VARCHAR(200),
    "notes" TEXT,
    "tags" TEXT[],
    "priority" VARCHAR(20) NOT NULL DEFAULT 'medium',
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "mastery_level" INTEGER NOT NULL DEFAULT 0,
    "last_reviewed_at" TIMESTAMP(3),
    "next_review_at" TIMESTAMP(3),
    "is_resolved" BOOLEAN NOT NULL DEFAULT false,
    "added_by" VARCHAR(20) NOT NULL DEFAULT 'manual',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mistake_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mistake_items_user_id_submission_id_key" ON "mistake_items"("user_id", "submission_id");

-- AddForeignKey
ALTER TABLE "mistake_categories" ADD CONSTRAINT "mistake_categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mistake_categories" ADD CONSTRAINT "mistake_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "mistake_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mistake_items" ADD CONSTRAINT "mistake_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mistake_items" ADD CONSTRAINT "mistake_items_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mistake_items" ADD CONSTRAINT "mistake_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "mistake_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
