import { describe, expect, it } from "vitest";
import type { ExerciseData } from "@/lib/exercises/types";
import type { ExerciseContent } from "./types";
import { makeTree } from "./testing";
import {
  buildKnownWords,
  candidates,
  englishTexts,
  expandToken,
  findUnknownWords,
  isKnown,
  linkWords,
  tokenize,
} from "./words";

function ex(data: ExerciseData, extra: Partial<ExerciseContent> = {}): ExerciseContent {
  return { key: "q", index: 1, prompt: "Đề", exceptions: [], aiGenerated: false, data, file: "f.yaml", ...extra };
}

describe("englishTexts", () => {
  it("lấy đoạn tiếng Anh trong ngoặc kép của đề, bỏ đoạn tiếng Việt", () => {
    const e = ex(
      { type: "multiple_choice", choices: [{ text: "Xin chào" }, { text: "Tạm biệt" }], answerIndex: 0 },
      { prompt: "Chọn nghĩa đúng của “Hello”, không phải “Tạm biệt”" },
    );
    expect(englishTexts(e)).toEqual(["Hello"]);
  });

  it("lựa chọn tự nhận theo dấu tiếng Việt; choicesLang ghi đè", () => {
    const data: ExerciseData = { type: "listen_select", audioText: "Who are you?", choices: ["Who are you?", "anh"], answerIndex: 0 };
    expect(englishTexts(ex(data))).toEqual(["Who are you?", "Who are you?", "anh"]);
    expect(englishTexts(ex(data, { choicesLang: "vi" }))).toEqual(["Who are you?"]);
  });

  it("đúng trường cho từng dạng bài", () => {
    expect(englishTexts(ex({ type: "word_bank", answer: ["I", "am"], distractors: ["is"] }))).toEqual(["I am", "is"]);
    expect(englishTexts(ex({ type: "match_pairs", pairs: [{ left: "mother", right: "mẹ" }, { left: "father", right: "bố" }] }))).toEqual([
      "mother",
      "father",
    ]);
    expect(
      englishTexts(ex({ type: "fill_blank", sentence: "She ___ my sister.", answer: "is", choices: ["is", "am"] })),
    ).toEqual(["She is my sister.", "is", "am"]);
    expect(
      englishTexts(ex({ type: "listen_type", audioText: "I am 20", answer: "I am 20", acceptable: ["I'm 20"] })),
    ).toEqual(["I am 20", "I am 20", "I'm 20"]);
  });
});

describe("tokenize, expandToken, candidates", () => {
  it("bỏ dấu câu, số và chỗ trống", () => {
    expect(tokenize("Good ___, see you 20 times!")).toEqual(["good", "see", "you", "times"]);
    expect(tokenize("I’m twenty-one")).toEqual(["i'm", "twenty", "one"]);
  });

  it("tách dạng rút gọn", () => {
    expect(expandToken("i'm")).toEqual(["i", "am"]);
    expect(expandToken("don't")).toEqual(["do", "not"]);
    expect(expandToken("can't")).toEqual(["can", "not"]);
    expect(expandToken("they're")).toEqual(["they", "are"]);
    expect(expandToken("lan's")).toEqual(["lan"]);
  });

  it("đoán dạng gốc", () => {
    expect(candidates("brothers")).toContain("brother");
    expect(candidates("watches")).toContain("watch");
    expect(candidates("families")).toContain("family");
    expect(candidates("making")).toContain("make");
    expect(candidates("running")).toContain("run");
    expect(candidates("studied")).toContain("study");
    expect(candidates("stopped")).toContain("stop");
    expect(candidates("liked")).toContain("like");
    expect(candidates("class")).not.toContain("clas");
  });
});

describe("buildKnownWords, findUnknownWords, linkWords", () => {
  const course = makeTree().courses[0];

  it("từ đã học gồm unit hiện tại và trước đó, cụm từ, forms, commonWords, names", () => {
    const u1 = buildKnownWords(course, 0);
    expect(isKnown("good", u1)).toBe(true); // từ thành phần của "good morning"
    expect(isKnown("met", u1)).toBe(true); // forms của "meet"
    expect(isKnown("anna", u1)).toBe(true); // names
    expect(isKnown("father", u1)).toBe(false); // unit sau
    expect(isKnown("father", buildKnownWords(course, 1))).toBe(true);
  });

  it("báo từ chưa học, không lặp; bỏ qua từ ngoại lệ", () => {
    const known = buildKnownWords(course, 0);
    const e = ex({ type: "word_bank", answer: ["My", "father", "met", "my", "father"], distractors: [] });
    expect(findUnknownWords(e, known)).toEqual(["father"]);
    expect(findUnknownWords({ ...e, exceptions: [{ word: "father", reason: "thử" }] }, known)).toEqual([]);
  });

  it("nối câu với từ vựng, cụm từ khớp nguyên cụm, từ ngoại lệ không được nối", () => {
    const vocab = [
      { id: "v-hello", wordKey: "hello", forms: [] },
      { id: "v-gm", wordKey: "good morning", forms: [] },
      { id: "v-meet", wordKey: "meet", forms: ["met"] },
      { id: "v-nice", wordKey: "nice", forms: [] },
    ];
    const e = ex({ type: "word_bank", answer: ["Good", "morning", "I", "met", "you"], distractors: ["hello"] });
    expect(linkWords(e, vocab).sort()).toEqual(["v-gm", "v-hello", "v-meet"]);
    const blank = ex({ type: "fill_blank", sentence: "Good ___, nice!", answer: "morning", choices: ["morning", "hello"] });
    expect(linkWords(blank, vocab).sort()).toEqual(["v-gm", "v-hello", "v-nice"]);
    const onlyGood = ex({ type: "word_bank", answer: ["Good", "night"], distractors: [] });
    expect(linkWords(onlyGood, vocab)).toEqual([]);
    expect(linkWords({ ...e, exceptions: [{ word: "hello", reason: "x" }] }, vocab).sort()).toEqual(["v-gm", "v-meet"]);
  });
});
