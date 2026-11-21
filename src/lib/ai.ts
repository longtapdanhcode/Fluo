import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { exerciseData, type ExerciseData, type ExerciseType } from "@/lib/exercises/types";

/**
 * Model mặc định là claude-opus-5-5. Muốn rẻ hơn thì đặt AI_MODEL / AI_EXPLAIN_MODEL
 * trong .env.local, ví dụ claude-haiku-5-5 cho phần giải thích lỗi (gọi nhiều nhất).
 */
const CONTENT_MODEL = process.env.AI_MODEL ?? "claude-opus-5-5";
const EXPLAIN_MODEL = process.env.AI_EXPLAIN_MODEL ?? process.env.AI_MODEL ?? "claude-opus-5-5";

/** Fallback khi model từ chối (safety): server tự chạy lại trên model khác. Chỉ hợp lệ với Opus/Sonnet/Fable. */
function fallbackParams(model: string) {
  return /^claude-(opus|sonnet|fable)-/.test(model)
    ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
    : {};
}

export const aiConfigured = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

let client: Anthropic | null = null;
function anthropic() {
  client ??= new Anthropic();
  return client;
}

// ---- Sinh bài tập (CMS) ---------------------------------------------------

// Schema "lỏng" cho structured output (không min/max/default); sau đó kiểm lại bằng schema chặt.
const aiChoice = z.object({ text: z.string() });
const aiExercise = z.object({
  prompt: z.string().describe("Đề bài ngắn bằng tiếng Việt, ví dụ: 'Chọn nghĩa đúng của từ'"),
  explanation: z.string().describe("Giải thích ngắn bằng tiếng Việt vì sao đáp án đúng"),
  data: z.union([
    z.object({ type: z.literal("multiple_choice"), choices: z.array(aiChoice), answerIndex: z.number() }),
    z.object({
      type: z.literal("listen_select"),
      audioText: z.string(),
      choices: z.array(z.string()),
      answerIndex: z.number(),
    }),
    z.object({
      type: z.literal("listen_type"),
      audioText: z.string(),
      answer: z.string(),
      acceptable: z.array(z.string()),
    }),
    z.object({ type: z.literal("word_bank"), answer: z.array(z.string()), distractors: z.array(z.string()) }),
    z.object({
      type: z.literal("match_pairs"),
      pairs: z.array(z.object({ left: z.string(), right: z.string() })),
    }),
    z.object({
      type: z.literal("fill_blank"),
      sentence: z.string(),
      answer: z.string(),
      choices: z.array(z.string()),
    }),
  ]),
});
const aiExerciseList = z.object({ exercises: z.array(aiExercise) });

export type GeneratedExercise = { prompt: string; explanation: string; data: ExerciseData };

export async function generateExercises(input: {
  level: string;
  unitTitle: string;
  lessonTitle: string;
  topic: string;
  count: number;
  types: ExerciseType[];
}): Promise<{ items: GeneratedExercise[]; rejected: number }> {
  const system = `Bạn là giáo viên tiếng Anh soạn bài cho người Việt, theo phong cách app học kiểu trò chơi.
Quy tắc:
- Trình độ CEFR ${input.level.toUpperCase()}. Từ vựng và ngữ pháp phải vừa trình độ, câu ngắn, tự nhiên.
- "prompt" và "explanation" viết bằng tiếng Việt; nội dung cần học bằng tiếng Anh.
- multiple_choice: 3-4 lựa chọn, answerIndex bắt đầu từ 0.
- listen_select: audioText là câu/từ tiếng Anh sẽ được đọc lên; choices là các lựa chọn (có thể là nghĩa tiếng Việt hoặc câu tiếng Anh).
- listen_type: audioText và answer giống nhau (tiếng Anh); acceptable là các cách viết khác vẫn đúng (ví dụ dạng viết tắt).
- word_bank: answer là các từ của câu đúng theo thứ tự; distractors là 1-3 từ gây nhiễu không thuộc câu.
- match_pairs: 4-5 cặp từ tiếng Anh ↔ nghĩa tiếng Việt.
- fill_blank: sentence có đúng một "___"; choices gồm đáp án đúng và 2-3 đáp án sai.
- Mỗi câu phải có đúng một đáp án hợp lý. Không lặp lại cùng một câu.`;

  const response = await anthropic().beta.messages.parse({
    model: CONTENT_MODEL,
    max_tokens: 16000,
    output_config: { effort: "medium", format: betaZodOutputFormat(aiExerciseList) },
    ...fallbackParams(CONTENT_MODEL),
    system,
    messages: [
      {
        role: "user",
        content: `Unit: ${input.unitTitle}
Bài: ${input.lessonTitle}
Chủ đề / trọng tâm: ${input.topic}
Soạn ${input.count} câu, chỉ dùng các dạng: ${input.types.join(", ")}. Chia đều các dạng, sắp xếp từ dễ đến khó.`,
      },
    ],
  });

  if (response.stop_reason === "refusal") throw new Error("AI từ chối yêu cầu này.");
  const parsed = response.parsed_output;
  if (!parsed) throw new Error("AI trả về dữ liệu không đúng định dạng, thử lại nhé.");

  const items: GeneratedExercise[] = [];
  let rejected = 0;
  for (const ex of parsed.exercises) {
    const data = exerciseData.safeParse(ex.data);
    if (data.success && input.types.includes(data.data.type)) {
      items.push({ prompt: ex.prompt, explanation: ex.explanation, data: data.data });
    } else {
      rejected++;
    }
  }
  return { items, rejected };
}

// ---- Giải thích lỗi sai (học viên) ---------------------------------------

export async function explainMistake(input: {
  prompt: string;
  question: string;
  correct: string;
  given: string;
}): Promise<string | null> {
  const response = await anthropic().beta.messages.create({
    model: EXPLAIN_MODEL,
    max_tokens: 2000,
    output_config: { effort: "low" },
    ...fallbackParams(EXPLAIN_MODEL),
    system:
      "Bạn là gia sư tiếng Anh thân thiện cho người Việt. Giải thích lỗi sai bằng tiếng Việt trong tối đa 3 câu ngắn: vì sao đáp án của học viên sai, quy tắc cần nhớ, và một ví dụ. Không chào hỏi, không dùng markdown.",
    messages: [
      {
        role: "user",
        content: `Đề: ${input.prompt}
Nội dung câu hỏi: ${input.question}
Đáp án đúng: ${input.correct}
Học viên trả lời: ${input.given || "(bỏ trống)"}`,
      },
    ],
  });
  if (response.stop_reason === "refusal") return null;
  const text = response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  return text || null;
}
