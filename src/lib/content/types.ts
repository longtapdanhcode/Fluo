import type { ExerciseData } from "@/lib/exercises/types";

/**
 * Kiểu dữ liệu của quy trình nội dung dạng file (tính năng 001).
 * Thư mục src/lib/content là hàm thuần: không import Next, React, Supabase hay @/db.
 */

export type IssueCode =
  | "yaml_syntax"
  | "schema"
  | "unknown_word"
  | "duplicate_exercise"
  | "ambiguous_answer"
  | "missing_explanation"
  | "duplicate_id"
  | "duplicate_vocabulary"
  | "missing_manifest"
  | "exception_without_reason"
  | "legacy_course"
  | "orphan_course"
  | "acceptable_duplicates_answer";

export type ContentIssue = {
  severity: "error" | "warning";
  code: IssueCode;
  /** Đường dẫn file tương đối từ gốc repo. */
  file: string;
  line?: number;
  exerciseKey?: string;
  /** Thứ tự câu trong bài, bắt đầu từ 1. */
  exerciseIndex?: number;
  /** Mô tả bằng tiếng Việt, đủ để sửa mà không phải đọc code. */
  message: string;
};

export type SourceFile = { path: string; text: string };

export type VocabContent = {
  word: string;
  meaning: string;
  example?: string;
  forms: string[];
  file: string;
  line?: number;
};

export type ExceptionWord = { word: string; reason?: string };

export type ExerciseContent = {
  key: string;
  /** Bắt đầu từ 1. */
  index: number;
  prompt: string;
  explanation?: string;
  choicesLang?: "en" | "vi";
  exceptions: ExceptionWord[];
  aiGenerated: boolean;
  image?: string;
  data: ExerciseData;
  file: string;
  line?: number;
};

export type LessonContent = {
  key: string;
  title: string;
  xp: number;
  published: boolean;
  exercises: ExerciseContent[];
  file: string;
  line?: number;
};

export type UnitContent = {
  key: string;
  title: string;
  description?: string;
  vocabulary: VocabContent[];
  lessons: LessonContent[];
  /** Đường dẫn unit.yaml. */
  file: string;
  dir: string;
};

export type CefrLevel = "pre_a1" | "a1" | "a2" | "b1" | "b2" | "c1";

export type CourseContent = {
  /** = courses.slug */
  key: string;
  title: string;
  description?: string;
  level: CefrLevel;
  audience: "adult" | "kid";
  published: boolean;
  ttsVoice?: string;
  commonWords: string[];
  names: string[];
  units: UnitContent[];
  /** Đường dẫn course.yaml. */
  file: string;
  dir: string;
};

export type ContentTree = { courses: CourseContent[] };
