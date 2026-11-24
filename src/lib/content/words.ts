import { normalize } from "@/lib/exercises/check";
import type { CourseContent, ExerciseContent } from "./types";

/**
 * Trích chữ tiếng Anh của một câu hỏi và so với từ đã học (research R7).
 * Không dùng thư viện NLP: biến thể thường gặp được đoán bằng quy tắc; dạng bất quy tắc khai báo
 * trong `forms` của từ vựng; còn lại dùng ngoại lệ có lý do.
 */

const VI_LETTERS = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

/** Chuỗi có chữ cái tiếng Việt có dấu thì coi là tiếng Việt. */
export function isVietnamese(s: string): boolean {
  return VI_LETTERS.test(s);
}

function choiceTexts(ex: ExerciseContent, choices: string[]): string[] {
  if (ex.choicesLang === "vi") return [];
  if (ex.choicesLang === "en") return choices;
  return choices.filter((c) => !isVietnamese(c));
}

/** Các đoạn trong ngoặc kép của đề bài (tiếng Việt) mà là tiếng Anh, ví dụ: Chọn nghĩa của “Hello”. */
function quotedEnglish(prompt: string): string[] {
  const out: string[] = [];
  for (const m of prompt.matchAll(/[“"]([^”"]+)[”"]/g)) if (!isVietnamese(m[1])) out.push(m[1]);
  return out;
}

/** Mọi đoạn chữ tiếng Anh của câu, theo bảng R7. */
export function englishTexts(ex: ExerciseContent): string[] {
  const d = ex.data;
  const fromPrompt = quotedEnglish(ex.prompt);
  switch (d.type) {
    case "multiple_choice":
      return [...fromPrompt, ...choiceTexts(ex, d.choices.map((c) => c.text))];
    case "listen_select":
      return [...fromPrompt, d.audioText, ...choiceTexts(ex, d.choices)];
    case "listen_type":
      return [...fromPrompt, d.audioText, d.answer, ...d.acceptable];
    case "word_bank":
      return [...fromPrompt, d.answer.join(" "), ...d.distractors];
    case "match_pairs":
      return [...fromPrompt, ...d.pairs.map((p) => p.left)];
    case "fill_blank":
      // Câu đã điền đáp án, để cụm từ nằm vắt qua chỗ trống ("Good ___" + night) vẫn khớp
      return [...fromPrompt, d.sentence.replace("___", d.answer), ...(d.choices ?? [])];
  }
}

/** Tách thành token đã chuẩn hóa; bỏ số, chỗ trống "___" và dấu nháy thừa. */
export function tokenize(text: string): string[] {
  return normalize(text)
    .split(/[\s\-–—/]+/)
    .map((t) => t.replace(/^'+|'+$/g, "").replace(/_+/g, ""))
    .filter((t) => t.length > 0 && !/\d/.test(t));
}

const CONTRACTIONS: Record<string, string[]> = {
  "can't": ["can", "not"],
  "won't": ["will", "not"],
  "shan't": ["shall", "not"],
  "i'm": ["i", "am"],
  "let's": ["let", "us"],
};

/** Tách dạng rút gọn thành các từ: don't → do not, they're → they are, Lan's → lan. */
export function expandToken(token: string): string[] {
  if (CONTRACTIONS[token]) return CONTRACTIONS[token];
  const suffixes: [string, string | null][] = [
    ["n't", "not"],
    ["'re", "are"],
    ["'ve", "have"],
    ["'ll", "will"],
    ["'d", "would"],
    ["'s", null],
    ["'m", "am"],
  ];
  for (const [suffix, word] of suffixes) {
    if (token.endsWith(suffix) && token.length > suffix.length) {
      const base = token.slice(0, -suffix.length);
      return word ? [base, word] : [base];
    }
  }
  return [token];
}

const VOWEL = /[aeiou]/;

/** Các dạng gốc có thể của một từ: số nhiều, -ing, -ed. */
export function candidates(word: string): string[] {
  const out = new Set([word]);
  const add = (w: string) => w.length > 1 && out.add(w);
  const undouble = (stem: string) => {
    const n = stem.length;
    if (n >= 3 && stem[n - 1] === stem[n - 2] && !VOWEL.test(stem[n - 1])) add(stem.slice(0, -1));
  };
  if (word.endsWith("ies")) add(word.slice(0, -3) + "y");
  if (word.endsWith("es")) add(word.slice(0, -2));
  if (word.endsWith("s") && !word.endsWith("ss")) add(word.slice(0, -1));
  if (word.endsWith("ing") && word.length > 4) {
    const stem = word.slice(0, -3);
    add(stem);
    add(stem + "e");
    undouble(stem);
  }
  if (word.endsWith("ied")) add(word.slice(0, -3) + "y");
  if (word.endsWith("ed") && word.length > 3) {
    const stem = word.slice(0, -2);
    add(stem);
    add(word.slice(0, -1));
    undouble(stem);
  }
  return [...out];
}

/** Các từ (đã tách dạng rút gọn) xuất hiện trong chữ tiếng Anh của câu. */
export function exerciseWords(ex: ExerciseContent): string[] {
  return englishTexts(ex).flatMap(tokenize).flatMap(expandToken);
}

/** Tập từ đã học tới hết unit thứ `uptoUnitIndex` (bắt đầu từ 0) của khóa. */
export function buildKnownWords(course: CourseContent, uptoUnitIndex: number): Set<string> {
  const known = new Set<string>();
  const addAll = (s: string) => tokenize(s).flatMap(expandToken).forEach((t) => known.add(t));
  course.commonWords.forEach(addAll);
  course.names.forEach(addAll);
  for (const unit of course.units.slice(0, uptoUnitIndex + 1)) {
    for (const v of unit.vocabulary) {
      addAll(v.word);
      v.forms.forEach(addAll);
    }
  }
  return known;
}

export function isKnown(word: string, known: Set<string>): boolean {
  return candidates(word).some((c) => known.has(c));
}

/** Từ chưa học trong câu (không tính từ ngoại lệ của câu), theo thứ tự xuất hiện, không lặp. */
export function findUnknownWords(ex: ExerciseContent, known: Set<string>): string[] {
  const exceptions = new Set(ex.exceptions.flatMap((e) => tokenize(e.word)));
  const out: string[] = [];
  for (const w of exerciseWords(ex)) {
    if (exceptions.has(w) || isKnown(w, known) || out.includes(w)) continue;
    out.push(w);
  }
  return out;
}

export type VocabRef = { id: string; wordKey: string; forms: string[] };

/** Các từ vựng mà câu sử dụng; cụm từ khớp theo chuỗi con, từ đơn khớp theo dạng gốc hoặc `forms`. */
export function linkWords(ex: ExerciseContent, vocab: VocabRef[]): string[] {
  const exceptions = new Set(ex.exceptions.flatMap((e) => tokenize(e.word)));
  const words = exerciseWords(ex).filter((w) => !exceptions.has(w));
  const roots = new Set(words.flatMap(candidates));
  const surface = new Set(words);
  const joined = englishTexts(ex)
    .map((t) => ` ${tokenize(t).flatMap(expandToken).join(" ")} `)
    .join("|");
  const ids: string[] = [];
  for (const v of vocab) {
    const parts = v.wordKey.split(" ");
    const hit =
      parts.length > 1
        ? joined.includes(` ${v.wordKey} `)
        : roots.has(v.wordKey) || v.forms.some((f) => surface.has(normalize(f)));
    if (hit) ids.push(v.id);
  }
  return ids;
}
