import { describe, expect, it } from "vitest";
import { parseContent } from "./parse";
import type { SourceFile } from "./types";

const COURSE = `id: demo
title: Demo
units: [greetings]
`;
const UNIT = `id: greetings
title: Chào hỏi
lessons: [hello, bye]
vocabulary:
  - word: hello
    meaning: xin chào
`;
const HELLO = `id: hello
title: Xin chào
exercises:
  - id: q1
    prompt: Chọn nghĩa của “hello”
    explanation: Lời chào.
    data:
      type: multiple_choice
      choices: [{ text: xin chào }, { text: tạm biệt }]
      answerIndex: 0
  - id: q2
    prompt: Xếp câu
    explanation: Câu chào.
    data:
      type: word_bank
      answer: [hello, Anna]
`;
const BYE = `id: bye
title: Tạm biệt
exercises:
  - id: q1
    prompt: Xếp câu
    explanation: Câu chào.
    data:
      type: word_bank
      answer: [hello, Anna]
`;

function files(overrides: Record<string, string | null> = {}): SourceFile[] {
  const base: Record<string, string | null> = {
    "content/demo/course.yaml": COURSE,
    "content/demo/01-greetings/unit.yaml": UNIT,
    "content/demo/01-greetings/01-hello.yaml": HELLO,
    "content/demo/01-greetings/02-bye.yaml": BYE,
    ...overrides,
  };
  return Object.entries(base)
    .filter((e): e is [string, string] => e[1] !== null)
    .map(([path, text]) => ({ path, text }));
}

describe("parseContent", () => {
  it("đọc bộ file hợp lệ thành cây đúng thứ tự", () => {
    const { tree, issues } = parseContent(files());
    expect(issues).toEqual([]);
    expect(tree.courses).toHaveLength(1);
    const course = tree.courses[0];
    expect(course.key).toBe("demo");
    expect(course.level).toBe("a1");
    expect(course.units.map((u) => u.key)).toEqual(["greetings"]);
    const unit = course.units[0];
    expect(unit.vocabulary[0]).toMatchObject({ word: "hello", meaning: "xin chào", line: 5 });
    expect(unit.lessons.map((l) => l.key)).toEqual(["hello", "bye"]);
    const hello = unit.lessons[0];
    expect(hello.file).toBe("content/demo/01-greetings/01-hello.yaml");
    expect(hello.xp).toBe(10);
    expect(hello.published).toBe(false);
    expect(hello.exercises.map((e) => [e.key, e.index, e.line])).toEqual([
      ["q1", 1, 4],
      ["q2", 2, 11],
    ]);
  });

  it("thứ tự bài theo unit.yaml, không theo tên file", () => {
    const { tree } = parseContent(
      files({ "content/demo/01-greetings/unit.yaml": UNIT.replace("[hello, bye]", "[bye, hello]") }),
    );
    expect(tree.courses[0].units[0].lessons.map((l) => l.key)).toEqual(["bye", "hello"]);
  });

  it("báo yaml_syntax kèm số dòng", () => {
    const broken = HELLO.replace("title: Xin chào", "title: [Xin chào");
    const { issues } = parseContent(files({ "content/demo/01-greetings/01-hello.yaml": broken }));
    const issue = issues.find((i) => i.code === "yaml_syntax");
    expect(issue).toBeDefined();
    expect(issue?.file).toBe("content/demo/01-greetings/01-hello.yaml");
    expect(issue?.line).toBeGreaterThan(0);
  });

  it("báo lỗi schema ở đúng câu và đúng dòng", () => {
    const bad = HELLO.replace("answerIndex: 0", "answerIndex: 5");
    const { issues } = parseContent(files({ "content/demo/01-greetings/01-hello.yaml": bad }));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      severity: "error",
      code: "schema",
      file: "content/demo/01-greetings/01-hello.yaml",
      line: 10,
      exerciseIndex: 1,
      exerciseKey: "q1",
    });
  });

  it("báo fill_blank không có đúng một chỗ trống", () => {
    const bad = HELLO.replace(
      "      type: word_bank\n      answer: [hello, Anna]",
      "      type: fill_blank\n      sentence: ___ Anna ___\n      answer: hello",
    );
    const { issues } = parseContent(files({ "content/demo/01-greetings/01-hello.yaml": bad }));
    expect(issues.map((i) => [i.code, i.exerciseKey])).toEqual([["schema", "q2"]]);
  });

  it("ttsVoice phải là tên giọng Kokoro", () => {
    const ok = parseContent(files({ "content/demo/course.yaml": COURSE + "ttsVoice: bf_emma\n" }));
    expect(ok.issues).toEqual([]);
    const bad = parseContent(files({ "content/demo/course.yaml": COURSE + "ttsVoice: en-US-AvaMultilingualNeural\n" }));
    expect(bad.issues).toHaveLength(1);
    expect(bad.issues[0]).toMatchObject({ code: "schema", file: "content/demo/course.yaml", line: 4 });
  });

  it("thiếu course.yaml → missing_manifest", () => {
    const { issues } = parseContent(files({ "content/demo/course.yaml": null }));
    expect(issues.some((i) => i.code === "missing_manifest")).toBe(true);
  });

  it("thiếu unit.yaml → missing_manifest", () => {
    const { issues } = parseContent(files({ "content/demo/01-greetings/unit.yaml": null }));
    expect(issues.filter((i) => i.code === "missing_manifest").length).toBeGreaterThan(0);
  });

  it("file bài không được liệt kê trong unit.yaml → missing_manifest", () => {
    const { issues } = parseContent(
      files({ "content/demo/01-greetings/unit.yaml": UNIT.replace("[hello, bye]", "[hello]") }),
    );
    expect(issues).toEqual([
      expect.objectContaining({ code: "missing_manifest", file: "content/demo/01-greetings/02-bye.yaml" }),
    ]);
  });

  it("unit.yaml liệt kê bài không có file → missing_manifest", () => {
    const { issues } = parseContent(files({ "content/demo/01-greetings/02-bye.yaml": null }));
    expect(issues).toEqual([
      expect.objectContaining({ code: "missing_manifest", file: "content/demo/01-greetings/unit.yaml" }),
    ]);
  });

  it("hai file bài cùng id → duplicate_id", () => {
    const { issues } = parseContent(
      files({ "content/demo/01-greetings/02-bye.yaml": BYE.replace("id: bye", "id: hello") }),
    );
    expect(issues.some((i) => i.code === "duplicate_id")).toBe(true);
  });

  it("liệt kê mọi lỗi trong một lần chạy", () => {
    const { issues } = parseContent(
      files({
        "content/demo/01-greetings/01-hello.yaml": HELLO.replace("answerIndex: 0", "answerIndex: 9"),
        "content/demo/01-greetings/02-bye.yaml": BYE.replace("title: Tạm biệt\n", ""),
      }),
    );
    expect(issues.length).toBe(2);
  });
});
