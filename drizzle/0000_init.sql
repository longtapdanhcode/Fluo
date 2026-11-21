CREATE TYPE "public"."cefr_level" AS ENUM('pre_a1', 'a1', 'a2', 'b1', 'b2', 'c1');--> statement-breakpoint
CREATE TYPE "public"."exercise_type" AS ENUM('multiple_choice', 'listen_select', 'listen_type', 'word_bank', 'match_pairs', 'fill_blank');--> statement-breakpoint
CREATE TYPE "public"."profile_type" AS ENUM('kid', 'adult');--> statement-breakpoint
CREATE TABLE "badges" (
	"code" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"icon" text DEFAULT '🏅' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"audience" "profile_type" DEFAULT 'adult' NOT NULL,
	"level" "cefr_level" DEFAULT 'a1' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	CONSTRAINT "courses_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"sort_order" integer NOT NULL,
	"type" "exercise_type" NOT NULL,
	"prompt" text NOT NULL,
	"data" jsonb NOT NULL,
	"audio_url" text,
	"image_url" text,
	"explanation" text,
	"ai_generated" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"correct" integer NOT NULL,
	"mistakes" integer NOT NULL,
	"xp_earned" integer NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" uuid NOT NULL,
	"sort_order" integer NOT NULL,
	"title" text NOT NULL,
	"xp_reward" integer DEFAULT 10 NOT NULL,
	"published" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_badges" (
	"profile_id" uuid NOT NULL,
	"badge_code" text NOT NULL,
	"earned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profile_badges_profile_id_badge_code_pk" PRIMARY KEY("profile_id","badge_code")
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"type" "profile_type" DEFAULT 'adult' NOT NULL,
	"display_name" text NOT NULL,
	"avatar" text,
	"level" "cefr_level" DEFAULT 'a1' NOT NULL,
	"xp_total" integer DEFAULT 0 NOT NULL,
	"streak_current" integer DEFAULT 0 NOT NULL,
	"streak_longest" integer DEFAULT 0 NOT NULL,
	"last_active_date" date,
	"hearts" integer DEFAULT 5 NOT NULL,
	"hearts_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"sort_order" integer NOT NULL,
	"title" text NOT NULL,
	"description" text
);
--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_completions" ADD CONSTRAINT "lesson_completions_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_completions" ADD CONSTRAINT "lesson_completions_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_badges" ADD CONSTRAINT "profile_badges_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_badges" ADD CONSTRAINT "profile_badges_badge_code_badges_code_fk" FOREIGN KEY ("badge_code") REFERENCES "public"."badges"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exercises_lesson_idx" ON "exercises" USING btree ("lesson_id","sort_order");--> statement-breakpoint
CREATE INDEX "completions_profile_idx" ON "lesson_completions" USING btree ("profile_id","completed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "lessons_unit_order_idx" ON "lessons" USING btree ("unit_id","sort_order");--> statement-breakpoint
CREATE INDEX "profiles_account_idx" ON "profiles" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "units_course_order_idx" ON "units" USING btree ("course_id","sort_order");