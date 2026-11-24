import { z } from "zod";
import { exerciseData } from "@/lib/exercises/types";

/**
 * Schema Zod cho file nội dung YAML (specs/001-lesson-content-pipeline/contracts/content-format.md).
 * Phần `data` của câu hỏi dùng lại `exerciseData`, không định nghĩa lại.
 */

export const contentId = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Mã chỉ gồm chữ thường, số và gạch nối, ví dụ: xin-chao-1");

export const courseFile = z.strictObject({
  id: contentId,
  title: z.string().min(1),
  description: z.string().optional(),
  level: z.enum(["pre_a1", "a1", "a2", "b1", "b2", "c1"]).default("a1"),
  audience: z.enum(["adult", "kid"]).default("adult"),
  published: z.boolean().default(false),
  // Tên giọng Kokoro: a|b (Mỹ|Anh) + f|m (nữ|nam) + "_" + tên, ví dụ af_heart, bm_george
  ttsVoice: z
    .string()
    .regex(/^[ab][fm]_[a-z]+$/, "Tên giọng Kokoro có dạng af_heart, af_bella, am_michael, bf_emma…")
    .optional(),
  units: z.array(contentId).min(1),
  commonWords: z.array(z.string().min(1)).default([]),
  names: z.array(z.string().min(1)).default([]),
});

export const vocabularyItem = z.strictObject({
  word: z.string().min(1),
  meaning: z.string().min(1),
  example: z.string().optional(),
  forms: z.array(z.string().min(1)).default([]),
});

export const unitFile = z.strictObject({
  id: contentId,
  title: z.string().min(1),
  description: z.string().optional(),
  lessons: z.array(contentId).default([]),
  vocabulary: z.array(vocabularyItem).default([]),
});

const exceptionWord = z.strictObject({
  word: z.string().min(1),
  /** Bắt buộc về nghiệp vụ, nhưng thiếu thì validate báo `exception_without_reason`. */
  reason: z.string().optional(),
});

export const exerciseFile = z
  .strictObject({
    id: contentId,
    prompt: z.string().min(1),
    /** Thiếu thì validate báo `missing_explanation`, không phải lỗi schema. */
    explanation: z.string().optional(),
    choicesLang: z.enum(["en", "vi"]).optional(),
    exceptions: z.array(exceptionWord).default([]),
    aiGenerated: z.boolean().default(false),
    image: z.url().optional(),
    data: exerciseData,
  })
  .superRefine((ex, ctx) => {
    const d = ex.data;
    if ((d.type === "multiple_choice" || d.type === "listen_select") && d.answerIndex >= d.choices.length) {
      ctx.addIssue({
        code: "custom",
        path: ["data", "answerIndex"],
        message: `answerIndex = ${d.answerIndex} nhưng chỉ có ${d.choices.length} lựa chọn (đánh số từ 0)`,
      });
    }
    if (d.type === "fill_blank" && d.sentence.split("___").length !== 2) {
      ctx.addIssue({
        code: "custom",
        path: ["data", "sentence"],
        message: "Câu điền chỗ trống phải có đúng một chỗ trống \"___\"",
      });
    }
  });

export const lessonFile = z.strictObject({
  id: contentId,
  title: z.string().min(1),
  xp: z.number().int().positive().default(10),
  published: z.boolean().default(false),
  exercises: z.array(exerciseFile).min(1),
});

export type CourseFile = z.infer<typeof courseFile>;
export type UnitFile = z.infer<typeof unitFile>;
export type LessonFile = z.infer<typeof lessonFile>;
export type ExerciseFile = z.infer<typeof exerciseFile>;
