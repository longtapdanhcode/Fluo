import { LineCounter, parseDocument, type Document } from "yaml";
import { z } from "zod";
import { courseFile, lessonFile, unitFile } from "./schema";
import type {
  ContentIssue,
  ContentTree,
  CourseContent,
  LessonContent,
  SourceFile,
  UnitContent,
} from "./types";

/** Thông báo lỗi Zod bằng tiếng Việt, chỉ áp dụng cho lần parse này (không đổi cấu hình toàn cục). */
const viErrors = z.locales.vi().localeError;

type Parsed = {
  path: string;
  doc: Document;
  lc: LineCounter;
  raw: unknown;
};

const dirname = (p: string) => p.slice(0, Math.max(0, p.lastIndexOf("/")));
const basename = (p: string) => p.slice(p.lastIndexOf("/") + 1);

/** Dòng (bắt đầu từ 1) của node sâu nhất còn tồn tại theo đường dẫn. */
function lineAt(f: Parsed, path: readonly PropertyKey[]): number | undefined {
  for (let n = path.length; n >= 0; n--) {
    const node = f.doc.getIn(path.slice(0, n) as (string | number)[], true) as
      | { range?: [number, number, number] }
      | undefined;
    if (node && typeof node === "object" && node.range) return f.lc.linePos(node.range[0]).line;
  }
  return undefined;
}

function rawId(raw: unknown): string | undefined {
  if (raw && typeof raw === "object" && "id" in raw && typeof raw.id === "string") return raw.id;
  return undefined;
}

function rawExerciseKey(raw: unknown, index: number): string | undefined {
  if (raw && typeof raw === "object" && "exercises" in raw && Array.isArray(raw.exercises)) {
    return rawId(raw.exercises[index]);
  }
  return undefined;
}

/**
 * Đọc toàn bộ file nội dung thành cây khóa → unit → bài → câu, kèm số dòng.
 * Không dừng ở lỗi đầu tiên: mọi lỗi cú pháp, schema và thiếu khai báo đều được trả về.
 */
export function parseContent(files: SourceFile[]): { tree: ContentTree; issues: ContentIssue[] } {
  const issues: ContentIssue[] = [];
  const error = (i: Omit<ContentIssue, "severity">) => issues.push({ severity: "error", ...i });

  // 1. Cú pháp YAML
  const parsed: Parsed[] = [];
  const brokenDirs = new Set<string>();
  for (const file of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    const lc = new LineCounter();
    const doc = parseDocument(file.text, { lineCounter: lc, uniqueKeys: true });
    if (doc.errors.length > 0) {
      for (const e of doc.errors) {
        error({
          code: "yaml_syntax",
          file: file.path,
          line: e.linePos?.[0]?.line,
          message: `YAML sai cú pháp: ${e.message.split("\n")[0]}`,
        });
      }
      brokenDirs.add(dirname(file.path));
      continue;
    }
    parsed.push({ path: file.path, doc, lc, raw: doc.toJS() });
  }

  // 2. Schema
  function check<T>(f: Parsed, schema: z.ZodType<T>, isLesson = false): T | undefined {
    const result = schema.safeParse(f.raw, { error: viErrors });
    if (result.success) return result.data;
    for (const issue of result.error.issues) {
      const p = issue.path;
      const exIndex = isLesson && p[0] === "exercises" && typeof p[1] === "number" ? p[1] : undefined;
      error({
        code: "schema",
        file: f.path,
        line: lineAt(f, p),
        exerciseIndex: exIndex === undefined ? undefined : exIndex + 1,
        exerciseKey: exIndex === undefined ? undefined : rawExerciseKey(f.raw, exIndex),
        message: `Sai định dạng${p.length ? ` ở "${p.join(".")}"` : ""}: ${issue.message}`,
      });
    }
    return undefined;
  }

  type CourseEntry = { f: Parsed; data: z.infer<typeof courseFile> | undefined };
  type UnitEntry = { f: Parsed; data: z.infer<typeof unitFile> | undefined; id?: string };
  type LessonEntry = { f: Parsed; content: LessonContent | undefined; id?: string };

  const courses = new Map<string, CourseEntry>();
  const units = new Map<string, UnitEntry>(); // theo thư mục unit
  const lessonsByDir = new Map<string, LessonEntry[]>();

  for (const f of parsed) {
    const name = basename(f.path);
    if (name === "course.yaml") {
      courses.set(dirname(f.path), { f, data: check(f, courseFile) });
    } else if (name === "unit.yaml") {
      units.set(dirname(f.path), { f, data: check(f, unitFile), id: rawId(f.raw) });
    } else {
      const data = check(f, lessonFile, true);
      const content: LessonContent | undefined = data && {
        key: data.id,
        title: data.title,
        xp: data.xp,
        published: data.published,
        file: f.path,
        line: 1,
        exercises: data.exercises.map((ex, i) => ({
          key: ex.id,
          index: i + 1,
          prompt: ex.prompt,
          explanation: ex.explanation,
          choicesLang: ex.choicesLang,
          exceptions: ex.exceptions,
          aiGenerated: ex.aiGenerated,
          image: ex.image,
          data: ex.data,
          file: f.path,
          line: lineAt(f, ["exercises", i]),
        })),
      };
      const dir = dirname(f.path);
      lessonsByDir.set(dir, [...(lessonsByDir.get(dir) ?? []), { f, content, id: rawId(f.raw) }]);
    }
  }

  // 3. Ghép cây theo khai báo
  for (const [unitDir, u] of units) {
    if (!courses.has(dirname(unitDir)) && !brokenDirs.has(dirname(unitDir))) {
      error({
        code: "missing_manifest",
        file: u.f.path,
        line: 1,
        message: `Thiếu course.yaml trong thư mục "${dirname(unitDir)}": unit này không thuộc khóa nào`,
      });
    }
  }
  for (const [dir, list] of lessonsByDir) {
    if (units.has(dir) || brokenDirs.has(dir)) continue;
    if (courses.has(dir)) {
      for (const l of list) {
        error({
          code: "missing_manifest",
          file: l.f.path,
          line: 1,
          message: "File bài phải nằm trong thư mục của một unit (thư mục con có unit.yaml), không nằm cạnh course.yaml",
        });
      }
    } else {
      error({
        code: "missing_manifest",
        file: list[0].f.path,
        line: 1,
        message: `Thiếu unit.yaml trong thư mục "${dir}"`,
      });
    }
  }

  const tree: ContentTree = { courses: [] };

  for (const [courseDir, c] of courses) {
    if (!c.data) continue;
    const course: CourseContent = {
      key: c.data.id,
      title: c.data.title,
      description: c.data.description,
      level: c.data.level,
      audience: c.data.audience,
      published: c.data.published,
      ttsVoice: c.data.ttsVoice,
      commonWords: c.data.commonWords,
      names: c.data.names,
      units: [],
      file: c.f.path,
      dir: courseDir,
    };

    // Unit trong khóa, theo id
    const unitById = new Map<string, [string, UnitEntry]>();
    for (const [unitDir, u] of units) {
      if (dirname(unitDir) !== courseDir || !u.id) continue;
      const prev = unitById.get(u.id);
      if (prev) {
        error({
          code: "duplicate_id",
          file: u.f.path,
          line: lineAt(u.f, ["id"]),
          message: `Mã unit "${u.id}" trùng với ${prev[1].f.path}`,
        });
        continue;
      }
      unitById.set(u.id, [unitDir, u]);
    }
    const unitHasBroken = [...brokenDirs].some((d) => dirname(d) === courseDir);
    const listedUnits = new Set(c.data.units);
    c.data.units.forEach((id, i) => {
      if (!unitById.has(id) && !unitHasBroken) {
        error({
          code: "missing_manifest",
          file: c.f.path,
          line: lineAt(c.f, ["units", i]),
          message: `course.yaml liệt kê unit "${id}" nhưng không có thư mục nào chứa unit.yaml với id này`,
        });
      }
    });
    for (const [id, [, u]] of unitById) {
      if (!listedUnits.has(id)) {
        error({
          code: "missing_manifest",
          file: u.f.path,
          line: lineAt(u.f, ["id"]),
          message: `Unit "${id}" chưa được liệt kê trong ${c.f.path} > units`,
        });
      }
    }

    // Bài trong khóa: mã bài duy nhất trong cả khóa
    const lessonOwner = new Map<string, string>();
    for (const [unitDir] of unitById.values()) {
      for (const l of lessonsByDir.get(unitDir) ?? []) {
        if (!l.id) continue;
        const prev = lessonOwner.get(l.id);
        if (prev) {
          error({
            code: "duplicate_id",
            file: l.f.path,
            line: lineAt(l.f, ["id"]),
            message: `Mã bài "${l.id}" trùng với ${prev} (mã bài phải duy nhất trong khóa)`,
          });
        } else {
          lessonOwner.set(l.id, l.f.path);
        }
      }
    }

    for (const id of c.data.units) {
      const entry = unitById.get(id);
      if (!entry) continue;
      const [unitDir, u] = entry;
      const inDir = lessonsByDir.get(unitDir) ?? [];
      if (!u.data) continue;

      const unit: UnitContent = {
        key: u.data.id,
        title: u.data.title,
        description: u.data.description,
        vocabulary: u.data.vocabulary.map((v, i) => ({
          word: v.word,
          meaning: v.meaning,
          example: v.example,
          forms: v.forms,
          file: u.f.path,
          line: lineAt(u.f, ["vocabulary", i]),
        })),
        lessons: [],
        file: u.f.path,
        dir: unitDir,
      };

      const listed = new Set(u.data.lessons);
      u.data.lessons.forEach((lessonId, i) => {
        const found = inDir.find((l) => l.id === lessonId);
        if (!found) {
          if (!brokenDirs.has(unitDir)) {
            error({
              code: "missing_manifest",
              file: u.f.path,
              line: lineAt(u.f, ["lessons", i]),
              message: `unit.yaml liệt kê bài "${lessonId}" nhưng thư mục "${unitDir}" không có file bài nào mang id này`,
            });
          }
          return;
        }
        if (found.content && lessonOwner.get(lessonId) === found.f.path) unit.lessons.push(found.content);
      });
      for (const l of inDir) {
        if (l.id && !listed.has(l.id)) {
          error({
            code: "missing_manifest",
            file: l.f.path,
            line: lineAt(l.f, ["id"]),
            message: `Bài "${l.id}" chưa được liệt kê trong ${u.f.path} > lessons`,
          });
        }
      }
      course.units.push(unit);
    }

    tree.courses.push(course);
  }

  return { tree, issues };
}
