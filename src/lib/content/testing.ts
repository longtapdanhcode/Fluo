/**
 * Tiện ích cho unit test của src/lib/content (không dùng trong app).
 */
import { parseContent } from "./parse";
import type { DbSnapshot, SyncPlan } from "./sync";
import type { ContentTree, SourceFile } from "./types";

export const DEMO: Record<string, string> = {
  "content/demo/course.yaml": `id: demo
title: Demo
published: true
ttsVoice: af_heart
units: [greetings, family]
commonWords: [i, you, my, is, am, are, to, a, this]
names: [Anna]
`,
  "content/demo/01-greetings/unit.yaml": `id: greetings
title: Chào hỏi
lessons: [hello, bye]
vocabulary:
  - word: hello
    meaning: xin chào
  - word: good morning
    meaning: chào buổi sáng
  - word: meet
    meaning: gặp
    forms: [met]
  - word: goodbye
    meaning: tạm biệt
`,
  "content/demo/01-greetings/01-hello.yaml": `id: hello
title: Xin chào
published: true
exercises:
  - id: q1
    prompt: Chọn nghĩa của “hello”
    explanation: Lời chào.
    data:
      type: multiple_choice
      choices: [{ text: xin chào }, { text: tạm biệt }]
      answerIndex: 0
  - id: q2
    prompt: Nghe và chọn
    explanation: Chào buổi sáng.
    data:
      type: listen_select
      audioText: Good morning
      choices: [Chào buổi sáng, Chúc ngủ ngon]
      answerIndex: 0
`,
  "content/demo/01-greetings/02-bye.yaml": `id: bye
title: Tạm biệt
exercises:
  - id: q1
    prompt: Xếp câu
    explanation: Lời chào tạm biệt.
    data:
      type: word_bank
      answer: [goodbye, Anna]
`,
  "content/demo/02-family/unit.yaml": `id: family
title: Gia đình
lessons: [members]
vocabulary:
  - word: father
    meaning: bố
`,
  "content/demo/02-family/01-members.yaml": `id: members
title: Thành viên
exercises:
  - id: q1
    prompt: Xếp câu
    explanation: Giới thiệu bố.
    data:
      type: word_bank
      answer: [this, is, my, father]
`,
};

export function makeFiles(overrides: Record<string, string | null> = {}, base = DEMO): SourceFile[] {
  return Object.entries({ ...base, ...overrides })
    .filter((e): e is [string, string] => e[1] !== null)
    .map(([path, text]) => ({ path, text }));
}

export function makeTree(overrides: Record<string, string | null> = {}): ContentTree {
  const { tree, issues } = parseContent(makeFiles(overrides));
  if (issues.length) throw new Error(`Fixture lỗi: ${JSON.stringify(issues, null, 2)}`);
  return tree;
}

export function emptySnapshot(): DbSnapshot {
  return { courses: [], units: [], lessons: [], exercises: [], vocabulary: [], links: [] };
}

/** Áp kế hoạch vào ảnh chụp trong bộ nhớ, giống những gì script làm với DB. */
export function applyPlan(snap: DbSnapshot, plan: SyncPlan, now = new Date("2026-11-22T00:00:00Z")): DbSnapshot {
  const next: DbSnapshot = structuredClone(snap);
  const del = new Set(plan.deleteCourses.map((c) => c.id));
  next.courses = next.courses.filter((c) => !del.has(c.id));
  const unitIds = new Set(next.units.filter((u) => del.has(u.courseId)).map((u) => u.id));
  next.units = next.units.filter((u) => !unitIds.has(u.id));
  next.lessons = next.lessons.filter((l) => !unitIds.has(l.unitId));

  function apply<T extends { id: string }>(rows: T[], c: SyncPlan["courses" | "units" | "lessons" | "exercises" | "vocabulary"]) {
    const changes = c as unknown as { insert: T[]; update: { id: string; values: Partial<T> }[]; archive: { id: string }[] };
    rows.push(...structuredClone(changes.insert));
    for (const u of changes.update) Object.assign(rows.find((r) => r.id === u.id)!, u.values);
    for (const a of changes.archive) Object.assign(rows.find((r) => r.id === a.id)!, { archivedAt: now });
  }
  apply(next.courses, plan.courses);
  apply(next.units, plan.units);
  apply(next.lessons, plan.lessons);
  apply(next.exercises, plan.exercises);
  apply(next.vocabulary, plan.vocabulary);
  for (const l of plan.links) {
    next.links = next.links.filter((x) => x.exerciseId !== l.exerciseId);
    next.links.push(...l.vocabularyIds.map((vocabularyId) => ({ exerciseId: l.exerciseId, vocabularyId })));
  }
  return next;
}
