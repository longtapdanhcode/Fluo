import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * AI phía học viên (giải thích lỗi sai). Tùy chọn: không có ANTHROPIC_API_KEY thì app dùng lời giải
 * thích soạn sẵn trong file bài. Model mặc định claude-opus-5-5; muốn rẻ hơn thì đặt AI_EXPLAIN_MODEL,
 * ví dụ claude-haiku-5-5. Soạn nháp bài học không gọi API: làm bằng skill /soan-bai trong Claude Code.
 */
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
