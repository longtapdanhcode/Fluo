import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseContent } from "./parse";
import type { ContentIssue, SourceFile } from "./types";
import { countExceptions, validateContent } from "./validate";

const ROOT = path.resolve(__dirname, "../../../tests/fixtures/content");

function load(name: string): SourceFile[] {
  const out: SourceFile[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else out.push({ path: path.relative(ROOT, full).split(path.sep).join("/"), text: readFileSync(full, "utf8") });
    }
  };
  walk(path.join(ROOT, name));
  return out;
}

function check(name: string) {
  const { tree, issues } = parseContent(load(name));
  return { tree, issues: [...issues, ...validateContent(tree)] };
}

/** Dòng (bắt đầu từ 1) chứa `needle` trong file của fixture. */
function lineOf(name: string, file: string, needle: string): number {
  const text = readFileSync(path.join(ROOT, name, file), "utf8");
  return text.split("\n").findIndex((l) => l.includes(needle)) + 1;
}

const L1 = "01-u1/01-l1.yaml";
const pick = (i: ContentIssue) => ({
  severity: i.severity,
  code: i.code,
  file: i.file.split("/").slice(1).join("/"),
  line: i.line,
  exerciseKey: i.exerciseKey,
});

describe("validateContent trên fixture", () => {
  it("clean: không có lỗi hay cảnh báo", () => {
    expect(check("clean").issues).toEqual([]);
  });

  const single: [string, ContentIssue["code"], string, string][] = [
    ["unknown-word", "unknown_word", L1, "  - id: q5"],
    ["exception-no-reason", "exception_without_reason", L1, "  - id: q5"],
    ["duplicate-exercise", "duplicate_exercise", "02-u2/01-l2.yaml", "  - id: q2"],
    ["ambiguous-mc", "ambiguous_answer", L1, "  - id: q1"],
    ["ambiguous-word-bank", "ambiguous_answer", L1, "  - id: q2"],
    ["ambiguous-fill-blank", "ambiguous_answer", L1, "  - id: q3"],
    ["ambiguous-match-pairs", "ambiguous_answer", L1, "  - id: q4"],
    ["missing-explanation", "missing_explanation", L1, "  - id: q3"],
  ];
  for (const [name, code, file, needle] of single) {
    it(`${name}: đúng một lỗi ${code} ở đúng câu và dòng`, () => {
      const { issues } = check(name);
      expect(issues.map(pick)).toEqual([
        {
          severity: "error",
          code,
          file,
          line: lineOf(name, file, needle),
          exerciseKey: needle.split(": ")[1],
        },
      ]);
    });
  }

  it("unknown-word: thông báo nêu đúng từ", () => {
    expect(check("unknown-word").issues[0].message).toContain("grandmother");
  });

  it("duplicate-id: câu trùng mã trong bài", () => {
    const { issues } = check("duplicate-id");
    expect(issues.map((i) => i.code)).toEqual(["duplicate_id"]);
    // Câu thứ 4 (vốn là q4) bị đổi mã thành q3
    expect(issues[0]).toMatchObject({ exerciseKey: "q3", exerciseIndex: 4 });
  });

  it("duplicate-vocabulary: từ khai báo ở hai unit", () => {
    const { issues } = check("duplicate-vocabulary");
    expect(issues.map(pick)).toEqual([
      {
        severity: "error",
        code: "duplicate_vocabulary",
        file: "02-u2/unit.yaml",
        line: lineOf("duplicate-vocabulary", "02-u2/unit.yaml", "word: Hello"),
        exerciseKey: undefined,
      },
    ]);
  });

  it("acceptable-warning: chỉ cảnh báo, không chặn", () => {
    const { issues } = check("acceptable-warning");
    expect(issues.map((i) => [i.severity, i.code])).toEqual([["warning", "acceptable_duplicates_answer"]]);
  });

  it("many-errors: liệt kê mọi lỗi trong một lần chạy", () => {
    const codes = check("many-errors").issues.map((i) => i.code).sort();
    expect(codes).toEqual(["duplicate_vocabulary", "missing_explanation", "unknown_word"]);
  });

  it("đếm từ ngoại lệ", () => {
    expect(countExceptions(check("exception-no-reason").tree)).toBe(1);
    expect(countExceptions(check("clean").tree)).toBe(0);
  });
});
