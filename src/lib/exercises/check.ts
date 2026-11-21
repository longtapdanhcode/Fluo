import type { ExerciseData, ExerciseResponse } from "./types";

/** Chuẩn hóa để so sánh: bỏ hoa/thường, dấu câu, khoảng trắng thừa, nháy cong. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[.,!?;:"“”()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Đáp án đúng ở dạng chữ, để hiện cho học viên khi trả lời sai. */
export function correctAnswerText(data: ExerciseData): string {
  switch (data.type) {
    case "multiple_choice":
      return data.choices[data.answerIndex]?.text ?? "";
    case "listen_select":
      return data.choices[data.answerIndex] ?? "";
    case "listen_type":
      return data.answer;
    case "word_bank":
      return data.answer.join(" ");
    case "fill_blank":
      return data.sentence.replace("___", data.answer);
    case "match_pairs":
      return data.pairs.map((p) => `${p.left} = ${p.right}`).join(", ");
  }
}

/** Câu trả lời của học viên ở dạng chữ (dùng cho AI giải thích lỗi). */
export function responseText(data: ExerciseData, res: ExerciseResponse): string {
  if (res.type === "multiple_choice" && data.type === "multiple_choice")
    return data.choices[res.index]?.text ?? "";
  if (res.type === "listen_select" && data.type === "listen_select")
    return data.choices[res.index] ?? "";
  if (res.type === "listen_type" || res.type === "fill_blank") return res.text;
  if (res.type === "word_bank") return res.words.join(" ");
  return "";
}

/**
 * Chấm một câu. Hàm thuần, chạy được cả ở client (phản hồi ngay)
 * và server (chấm lại khi nộp bài, để không tin client).
 */
export function checkAnswer(data: ExerciseData, res: ExerciseResponse): boolean {
  switch (data.type) {
    case "multiple_choice":
    case "listen_select":
      return res.type === data.type && res.index === data.answerIndex;
    case "listen_type": {
      if (res.type !== "listen_type") return false;
      const given = normalize(res.text);
      return [data.answer, ...data.acceptable].some((a) => normalize(a) === given);
    }
    case "fill_blank":
      return res.type === "fill_blank" && normalize(res.text) === normalize(data.answer);
    case "word_bank":
      return (
        res.type === "word_bank" &&
        normalize(res.words.join(" ")) === normalize(data.answer.join(" "))
      );
    case "match_pairs":
      // Ghép cặp chấm từng lượt ở client; câu này tính đúng nếu không ghép sai lần nào.
      return res.type === "match_pairs" && res.mistakes === 0;
  }
}
