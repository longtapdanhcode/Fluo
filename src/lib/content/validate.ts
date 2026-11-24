import { normalize } from "@/lib/exercises/check";
import { canonical } from "./sync";
import type { ContentIssue, ContentTree, ExerciseContent } from "./types";
import { buildKnownWords, findUnknownWords } from "./words";

/**
 * Quy tắc chất lượng nội dung (FR-007, FR-008a, research R7–R8). Chạy sau parseContent.
 * Trả về mọi lỗi và cảnh báo trong một lần, không dừng ở lỗi đầu tiên.
 */

function at(ex: ExerciseContent) {
  return { file: ex.file, line: ex.line, exerciseKey: ex.key, exerciseIndex: ex.index };
}

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const v of values.map(normalize)) (seen.has(v) ? dup : seen).add(v);
  return [...dup];
}

/** Lỗi "có thể có nhiều hơn một đáp án đúng" và cảnh báo liên quan của một câu. */
function answerIssues(ex: ExerciseContent): ContentIssue[] {
  const d = ex.data;
  const out: ContentIssue[] = [];
  const err = (message: string) => out.push({ severity: "error", code: "ambiguous_answer", ...at(ex), message });
  switch (d.type) {
    case "multiple_choice":
    case "listen_select": {
      const texts = d.type === "multiple_choice" ? d.choices.map((c) => c.text) : d.choices;
      const dup = duplicates(texts);
      if (dup.length) err(`Có thể có nhiều hơn một đáp án đúng: lựa chọn bị trùng (${dup.join(", ")})`);
      break;
    }
    case "word_bank": {
      const answer = new Set(d.answer.map(normalize));
      const bad = d.distractors.filter((w) => answer.has(normalize(w)));
      if (bad.length) err(`Có thể có nhiều hơn một đáp án đúng: từ gây nhiễu trùng từ trong đáp án (${bad.join(", ")})`);
      break;
    }
    case "fill_blank": {
      if (!d.choices) break;
      const hits = d.choices.filter((c) => normalize(c) === normalize(d.answer)).length;
      if (hits === 0) err(`Các lựa chọn không chứa đáp án "${d.answer}"`);
      else if (hits > 1) err(`Có thể có nhiều hơn một đáp án đúng: đáp án "${d.answer}" xuất hiện ${hits} lần trong lựa chọn`);
      else {
        const dup = duplicates(d.choices);
        if (dup.length) err(`Lựa chọn bị trùng (${dup.join(", ")})`);
      }
      break;
    }
    case "match_pairs": {
      const left = duplicates(d.pairs.map((p) => p.left));
      const right = duplicates(d.pairs.map((p) => p.right));
      if (left.length || right.length) {
        err(`Có thể có nhiều cách ghép đúng: vế bị trùng (${[...left, ...right].join(", ")})`);
      }
      break;
    }
    case "listen_type": {
      const same = d.acceptable.filter((a) => normalize(a) === normalize(d.answer));
      if (same.length) {
        out.push({
          severity: "warning",
          code: "acceptable_duplicates_answer",
          ...at(ex),
          message: `Đáp án chấp nhận thêm trùng đáp án chính sau khi chuẩn hóa (${same.join(", ")}); có thể bỏ`,
        });
      }
      break;
    }
  }
  return out;
}

/** Khóa so sánh câu trùng: dạng + đề + dữ liệu, sau chuẩn hóa. */
function duplicateKey(ex: ExerciseContent): string {
  return `${ex.data.type}|${normalize(ex.prompt)}|${canonical(ex.data).toLowerCase()}`;
}

export function validateContent(tree: ContentTree): ContentIssue[] {
  const issues: ContentIssue[] = [];

  for (const course of tree.courses) {
    // Từ vựng khai báo trùng giữa các unit
    const wordOwner = new Map<string, string>();
    for (const unit of course.units) {
      for (const v of unit.vocabulary) {
        const key = normalize(v.word);
        const owner = wordOwner.get(key);
        if (owner) {
          issues.push({
            severity: "error",
            code: "duplicate_vocabulary",
            file: v.file,
            line: v.line,
            message: `Từ "${v.word}" đã khai báo ở unit "${owner}"; mỗi từ chỉ giới thiệu ở một unit`,
          });
        } else {
          wordOwner.set(key, unit.key);
        }
      }
    }

    const seenExercises = new Map<string, ExerciseContent>();
    course.units.forEach((unit, unitIndex) => {
      const known = buildKnownWords(course, unitIndex);
      for (const lesson of unit.lessons) {
        const keys = new Set<string>();
        for (const ex of lesson.exercises) {
          if (keys.has(ex.key)) {
            issues.push({
              severity: "error",
              code: "duplicate_id",
              ...at(ex),
              message: `Mã câu "${ex.key}" bị trùng trong bài "${lesson.key}"`,
            });
          }
          keys.add(ex.key);

          if (!ex.explanation?.trim()) {
            issues.push({
              severity: "error",
              code: "missing_explanation",
              ...at(ex),
              message: "Thiếu lời giải thích tiếng Việt (explanation)",
            });
          }

          for (const e of ex.exceptions) {
            if (!e.reason?.trim()) {
              issues.push({
                severity: "error",
                code: "exception_without_reason",
                ...at(ex),
                message: `Từ ngoại lệ "${e.word}" thiếu lý do (reason)`,
              });
            }
          }

          const unknown = findUnknownWords(ex, known);
          if (unknown.length) {
            issues.push({
              severity: "error",
              code: "unknown_word",
              ...at(ex),
              message: `Từ chưa học: ${unknown.join(", ")}. Thêm vào vocabulary của unit "${unit.key}" hoặc unit trước, hoặc khai báo exceptions kèm lý do`,
            });
          }

          issues.push(...answerIssues(ex));

          const dupKey = duplicateKey(ex);
          const first = seenExercises.get(dupKey);
          if (first) {
            issues.push({
              severity: "error",
              code: "duplicate_exercise",
              ...at(ex),
              message: `Câu trùng với câu "${first.key}" ở ${first.file}:${first.line ?? 1}`,
            });
          } else {
            seenExercises.set(dupKey, ex);
          }
        }
      }
    });
  }

  return issues;
}

/** Tổng số từ ngoại lệ đang dùng (FR-008a). */
export function countExceptions(tree: ContentTree): number {
  let n = 0;
  for (const c of tree.courses)
    for (const u of c.units) for (const l of u.lessons) for (const e of l.exercises) n += e.exceptions.length;
  return n;
}
