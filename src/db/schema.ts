import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { ExerciseData } from "@/lib/exercises/types";

export const profileType = pgEnum("profile_type", ["kid", "adult"]);
export const cefrLevel = pgEnum("cefr_level", ["pre_a1", "a1", "a2", "b1", "b2", "c1"]);
export const exerciseType = pgEnum("exercise_type", [
  "multiple_choice",
  "listen_select",
  "listen_type",
  "word_bank",
  "match_pairs",
  "fill_blank",
]);

/**
 * Một tài khoản đăng nhập (auth.users của Supabase) có thể có nhiều hồ sơ:
 * hồ sơ người lớn của chính họ và (giai đoạn 2) hồ sơ cho từng đứa con.
 */
export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id").notNull(), // = auth.users.id
    type: profileType("type").notNull().default("adult"),
    displayName: text("display_name").notNull(),
    avatar: text("avatar"),
    level: cefrLevel("level").notNull().default("a1"),
    xpTotal: integer("xp_total").notNull().default(0),
    streakCurrent: integer("streak_current").notNull().default(0),
    streakLongest: integer("streak_longest").notNull().default(0),
    lastActiveDate: date("last_active_date"),
    hearts: integer("hearts").notNull().default(5),
    heartsUpdatedAt: timestamp("hearts_updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("profiles_account_idx").on(t.accountId)],
);

export const courses = pgTable("courses", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  audience: profileType("audience").notNull().default("adult"),
  level: cefrLevel("level").notNull().default("a1"),
  sortOrder: integer("sort_order").notNull().default(0),
  published: boolean("published").notNull().default(false),
  /** Giọng Azure Speech khai báo trong course.yaml, dùng cho `npm run content:audio`. */
  ttsVoice: text("tts_voice"),
});

/**
 * Nội dung (unit, bài, câu, từ vựng) có bản gốc là file YAML trong content/ và được đồng bộ bằng
 * `npm run content:import`. Mỗi mục có khóa ổn định lấy từ file; mục không còn trong file được gỡ
 * bằng `archived_at` chứ không xóa, để giữ tiến độ học viên.
 */
export const units = pgTable(
  "units",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    /** `id` trong unit.yaml; null = dữ liệu tạo trước quy trình nội dung dạng file. */
    key: text("key"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("units_course_key_idx").on(t.courseId, t.key)],
);

export const lessons = pgTable(
  "lessons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => units.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull(),
    title: text("title").notNull(),
    xpReward: integer("xp_reward").notNull().default(10),
    published: boolean("published").notNull().default(false),
    /** "<course-slug>/<lesson-id>", không đổi khi chuyển bài sang unit khác. */
    contentKey: text("content_key").unique(),
    /** Đường dẫn file nguồn, tương đối từ gốc repo. */
    sourcePath: text("source_path"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => [index("lessons_unit_order_idx").on(t.unitId, t.sortOrder)],
);

export const exercises = pgTable(
  "exercises",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull(),
    type: exerciseType("type").notNull(),
    prompt: text("prompt").notNull(),
    data: jsonb("data").$type<ExerciseData>().notNull(),
    audioUrl: text("audio_url"),
    imageUrl: text("image_url"),
    explanation: text("explanation"),
    aiGenerated: boolean("ai_generated").notNull().default(false),
    /** `id` của câu trong file bài. */
    key: text("key"),
    /** sha256(giọng + văn bản đọc) của file âm thanh hiện tại. */
    audioHash: text("audio_hash"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => [
    index("exercises_lesson_idx").on(t.lessonId, t.sortOrder),
    uniqueIndex("exercises_lesson_key_idx").on(t.lessonId, t.key),
  ],
);

/** Từ vựng giới thiệu ở từng unit; nền cho ôn tập ngắt quãng. */
export const vocabulary = pgTable(
  "vocabulary",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => units.id, { onDelete: "cascade" }),
    word: text("word").notNull(),
    /** normalize(word), khóa đồng bộ trong khóa học. */
    wordKey: text("word_key").notNull(),
    meaningVi: text("meaning_vi").notNull(),
    example: text("example"),
    forms: text("forms").array().notNull().default(sql`'{}'::text[]`),
    sortOrder: integer("sort_order").notNull(),
    audioUrl: text("audio_url"),
    audioHash: text("audio_hash"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("vocabulary_course_word_idx").on(t.courseId, t.wordKey)],
);

/** Câu hỏi nào dùng từ vựng nào. */
export const exerciseVocabulary = pgTable(
  "exercise_vocabulary",
  {
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    vocabularyId: uuid("vocabulary_id")
      .notNull()
      .references(() => vocabulary.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.exerciseId, t.vocabularyId] }),
    index("exercise_vocabulary_vocab_idx").on(t.vocabularyId),
  ],
);

export type ContentReportOutcome = "imported" | "no_changes" | "blocked" | "cancelled" | "dry_run";

/** Kết quả kiểm tra mỗi lần chạy `content:import`, hiện ở /admin. Chỉ giữ 20 bản mới nhất. */
export const contentReports = pgTable("content_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  outcome: text("outcome").$type<ContentReportOutcome>().notNull(),
  errors: jsonb("errors").$type<ContentReportIssue[]>().notNull().default([]),
  warnings: jsonb("warnings").$type<ContentReportIssue[]>().notNull().default([]),
  summary: jsonb("summary").$type<Record<string, unknown>>().notNull().default({}),
  gitCommit: text("git_commit"),
});

/** Bản lưu của ContentIssue (src/lib/content/types.ts); khai báo lại để schema không phụ thuộc lib. */
export type ContentReportIssue = {
  severity: "error" | "warning";
  code: string;
  file: string;
  line?: number;
  exerciseKey?: string;
  exerciseIndex?: number;
  message: string;
};

export const lessonCompletions = pgTable(
  "lesson_completions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    correct: integer("correct").notNull(),
    mistakes: integer("mistakes").notNull(),
    xpEarned: integer("xp_earned").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("completions_profile_idx").on(t.profileId, t.completedAt)],
);

export const badges = pgTable("badges", {
  code: text("code").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull().default("🏅"),
});

export const profileBadges = pgTable(
  "profile_badges",
  {
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    badgeCode: text("badge_code")
      .notNull()
      .references(() => badges.code, { onDelete: "cascade" }),
    earnedAt: timestamp("earned_at", { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [primaryKey({ columns: [t.profileId, t.badgeCode] })],
);

export type Profile = typeof profiles.$inferSelect;
export type Course = typeof courses.$inferSelect;
export type Unit = typeof units.$inferSelect;
export type Lesson = typeof lessons.$inferSelect;
export type Exercise = typeof exercises.$inferSelect;
export type Vocabulary = typeof vocabulary.$inferSelect;
export type ContentReport = typeof contentReports.$inferSelect;
