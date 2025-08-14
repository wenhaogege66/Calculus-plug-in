/*
  Warnings:

  - You are about to drop the `myscript_results` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "myscript_results" DROP CONSTRAINT "myscript_results_submission_id_fkey";

-- DropTable
DROP TABLE "myscript_results";

-- CreateTable
CREATE TABLE "mathpix_results" (
    "id" SERIAL NOT NULL,
    "submission_id" INTEGER NOT NULL,
    "recognized_text" TEXT,
    "math_latex" TEXT,
    "confidence" DECIMAL(5,4),
    "processing_time" INTEGER,
    "raw_result" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mathpix_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_points" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "chapter" VARCHAR(50),
    "parent_id" INTEGER,
    "level" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT,
    "keywords" TEXT[],
    "function_examples" TEXT[],
    "difficulty_level" INTEGER NOT NULL DEFAULT 1,
    "ai_explanation" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "error_analysis" (
    "id" SERIAL NOT NULL,
    "submission_id" INTEGER NOT NULL,
    "error_type" VARCHAR(50) NOT NULL,
    "knowledge_point_id" INTEGER,
    "error_description" TEXT NOT NULL,
    "frequency_count" INTEGER NOT NULL DEFAULT 1,
    "severity" VARCHAR(20) NOT NULL DEFAULT 'medium',
    "ai_suggestion" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "error_analysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "similar_questions" (
    "id" SERIAL NOT NULL,
    "original_submission_id" INTEGER NOT NULL,
    "generated_content" TEXT NOT NULL,
    "standard_answer" TEXT,
    "difficulty_level" INTEGER NOT NULL DEFAULT 1,
    "generation_prompt" TEXT NOT NULL,
    "user_rating" INTEGER,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "user_answer" TEXT,
    "ai_grading_result" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "similar_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "similar_question_knowledge_points" (
    "id" SERIAL NOT NULL,
    "similar_question_id" INTEGER NOT NULL,
    "knowledge_point_id" INTEGER NOT NULL,

    CONSTRAINT "similar_question_knowledge_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_recommendations" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content" TEXT NOT NULL,
    "priority" VARCHAR(20) NOT NULL DEFAULT 'medium',
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "is_applied" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "similar_question_knowledge_points_similar_question_id_knowl_key" ON "similar_question_knowledge_points"("similar_question_id", "knowledge_point_id");

-- AddForeignKey
ALTER TABLE "mathpix_results" ADD CONSTRAINT "mathpix_results_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_points" ADD CONSTRAINT "knowledge_points_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "knowledge_points"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "error_analysis" ADD CONSTRAINT "error_analysis_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "error_analysis" ADD CONSTRAINT "error_analysis_knowledge_point_id_fkey" FOREIGN KEY ("knowledge_point_id") REFERENCES "knowledge_points"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "similar_questions" ADD CONSTRAINT "similar_questions_original_submission_id_fkey" FOREIGN KEY ("original_submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "similar_question_knowledge_points" ADD CONSTRAINT "similar_question_knowledge_points_similar_question_id_fkey" FOREIGN KEY ("similar_question_id") REFERENCES "similar_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "similar_question_knowledge_points" ADD CONSTRAINT "similar_question_knowledge_points_knowledge_point_id_fkey" FOREIGN KEY ("knowledge_point_id") REFERENCES "knowledge_points"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_recommendations" ADD CONSTRAINT "learning_recommendations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
