import { z } from "zod";

/**
 * Dữ liệu riêng của từng dạng bài, lưu trong cột `exercises.data` (jsonb).
 * File này không phụ thuộc Next.js/DB để sau này dùng lại cho app mobile.
 */

const choice = z.object({
  text: z.string().min(1),
  imageUrl: z.string().url().optional(),
});

/** Chọn đáp án đúng (có thể kèm hình). */
export const multipleChoiceData = z.object({
  type: z.literal("multiple_choice"),
  choices: z.array(choice).min(2).max(6),
  answerIndex: z.number().int().min(0),
});

/** Nghe một câu/từ rồi chọn đáp án đúng. */
export const listenSelectData = z.object({
  type: z.literal("listen_select"),
  audioText: z.string().min(1),
  choices: z.array(z.string().min(1)).min(2).max(6),
  answerIndex: z.number().int().min(0),
});

/** Nghe rồi gõ lại. */
export const listenTypeData = z.object({
  type: z.literal("listen_type"),
  audioText: z.string().min(1),
  answer: z.string().min(1),
  acceptable: z.array(z.string()).default([]),
});

/** Xếp các từ thành câu đúng. */
export const wordBankData = z.object({
  type: z.literal("word_bank"),
  answer: z.array(z.string().min(1)).min(2),
  distractors: z.array(z.string().min(1)).default([]),
});

/** Ghép cặp từ ↔ nghĩa. */
export const matchPairsData = z.object({
  type: z.literal("match_pairs"),
  pairs: z
    .array(z.object({ left: z.string().min(1), right: z.string().min(1) }))
    .min(2)
    .max(6),
});

/** Điền vào chỗ trống. Dùng "___" để đánh dấu chỗ trống trong `sentence`. */
export const fillBlankData = z.object({
  type: z.literal("fill_blank"),
  sentence: z.string().includes("___"),
  answer: z.string().min(1),
  /** Có choices → bấm chọn; không có → gõ. */
  choices: z.array(z.string().min(1)).optional(),
});

export const exerciseData = z.discriminatedUnion("type", [
  multipleChoiceData,
  listenSelectData,
  listenTypeData,
  wordBankData,
  matchPairsData,
  fillBlankData,
]);

export type ExerciseData = z.infer<typeof exerciseData>;
export type ExerciseType = ExerciseData["type"];

/** Câu trả lời học viên gửi lên, tùy dạng bài. */
export type ExerciseResponse =
  | { type: "multiple_choice" | "listen_select"; index: number }
  | { type: "listen_type" | "fill_blank"; text: string }
  | { type: "word_bank"; words: string[] }
  | { type: "match_pairs"; mistakes: number };

export const exerciseTypeLabels: Record<ExerciseType, string> = {
  multiple_choice: "Chọn đáp án",
  listen_select: "Nghe rồi chọn",
  listen_type: "Nghe rồi gõ lại",
  word_bank: "Xếp từ thành câu",
  match_pairs: "Ghép cặp",
  fill_blank: "Điền chỗ trống",
};
