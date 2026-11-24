CREATE TABLE "content_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"outcome" text NOT NULL,
	"errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"git_commit" text
);
--> statement-breakpoint
CREATE TABLE "exercise_vocabulary" (
	"exercise_id" uuid NOT NULL,
	"vocabulary_id" uuid NOT NULL,
	CONSTRAINT "exercise_vocabulary_exercise_id_vocabulary_id_pk" PRIMARY KEY("exercise_id","vocabulary_id")
);
--> statement-breakpoint
CREATE TABLE "vocabulary" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"word" text NOT NULL,
	"word_key" text NOT NULL,
	"meaning_vi" text NOT NULL,
	"example" text,
	"forms" text[] DEFAULT '{}'::text[] NOT NULL,
	"sort_order" integer NOT NULL,
	"audio_url" text,
	"audio_hash" text,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
DROP INDEX "units_course_order_idx";--> statement-breakpoint
DROP INDEX "lessons_unit_order_idx";--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "tts_voice" text;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "key" text;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "audio_hash" text;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "content_key" text;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "source_path" text;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "key" text;--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "exercise_vocabulary" ADD CONSTRAINT "exercise_vocabulary_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_vocabulary" ADD CONSTRAINT "exercise_vocabulary_vocabulary_id_vocabulary_id_fk" FOREIGN KEY ("vocabulary_id") REFERENCES "public"."vocabulary"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocabulary" ADD CONSTRAINT "vocabulary_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocabulary" ADD CONSTRAINT "vocabulary_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exercise_vocabulary_vocab_idx" ON "exercise_vocabulary" USING btree ("vocabulary_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vocabulary_course_word_idx" ON "vocabulary" USING btree ("course_id","word_key");--> statement-breakpoint
CREATE UNIQUE INDEX "exercises_lesson_key_idx" ON "exercises" USING btree ("lesson_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "units_course_key_idx" ON "units" USING btree ("course_id","key");--> statement-breakpoint
CREATE INDEX "lessons_unit_order_idx" ON "lessons" USING btree ("unit_id","sort_order");--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_content_key_unique" UNIQUE("content_key");