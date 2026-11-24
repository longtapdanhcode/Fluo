import { describe, expect, it } from "vitest";
import { planSync } from "./sync";
import { DEMO, applyPlan, emptySnapshot, makeTree } from "./testing";

async function imported(overrides: Record<string, string | null> = {}) {
  const plan = await planSync(makeTree(overrides), emptySnapshot());
  return applyPlan(emptySnapshot(), plan);
}

describe("planSync · US3 từ vựng", () => {
  const UNIT = "content/demo/01-greetings/unit.yaml";

  it("thêm từ vựng và nối câu ↔ từ khi import lần đầu", async () => {
    const plan = await planSync(makeTree(), emptySnapshot());
    expect(plan.summary.vocabulary.added).toBe(5);
    const vocabId = (w: string) => plan.vocabulary.insert.find((v) => v.wordKey === w)!.id;
    const ex = (label: string) => plan.links.find((l) => l.label === label)!;
    expect(ex("demo/hello#q1").vocabularyIds).toEqual([vocabId("hello")]);
    expect(ex("demo/hello#q2").vocabularyIds).toEqual([vocabId("good morning")]);
    expect(ex("demo/members#q1").vocabularyIds).toEqual([vocabId("father")]);
  });

  it("sửa nghĩa → cập nhật cùng dòng; xóa khỏi file → gỡ; chạy lại → không đổi", async () => {
    const snap = await imported();
    const hello = snap.vocabulary.find((v) => v.wordKey === "hello")!;
    const edited = DEMO[UNIT].replace("meaning: xin chào", "meaning: chào (thân mật)").replace(
      "  - word: goodbye\n    meaning: tạm biệt\n",
      "",
    );
    const plan = await planSync(makeTree({ [UNIT]: edited, "content/demo/01-greetings/02-bye.yaml": DEMO["content/demo/01-greetings/02-bye.yaml"].replace("goodbye", "hello") }), snap);
    expect(plan.vocabulary.update).toEqual([
      expect.objectContaining({ id: hello.id, values: { meaningVi: "chào (thân mật)" } }),
    ]);
    expect(plan.vocabulary.archive.map((a) => a.label)).toEqual(["demo: goodbye"]);
    const again = await planSync(makeTree({ [UNIT]: edited, "content/demo/01-greetings/02-bye.yaml": DEMO["content/demo/01-greetings/02-bye.yaml"].replace("goodbye", "hello") }), applyPlan(snap, plan));
    expect(again.isEmpty).toBe(true);
  });

  it("thêm từ mới mà không sửa câu nào → câu cũ vẫn được nối với từ mới", async () => {
    const snap = await imported();
    const withAnna = DEMO["content/demo/01-greetings/unit.yaml"] + "  - word: Anna\n    meaning: tên riêng\n";
    const plan = await planSync(makeTree({ [UNIT]: withAnna }), snap);
    expect(plan.exercises.update).toEqual([]);
    const anna = plan.vocabulary.insert.find((v) => v.wordKey === "anna")!;
    const bye = plan.links.find((l) => l.label === "demo/bye#q1")!;
    expect(bye.vocabularyIds).toContain(anna.id);
  });

  it("từ ngoại lệ không được nối", async () => {
    const BYE = "content/demo/01-greetings/02-bye.yaml";
    const withException = DEMO[BYE].replace(
      "    explanation: Lời chào tạm biệt.\n",
      "    explanation: Lời chào tạm biệt.\n    exceptions:\n      - word: goodbye\n        reason: thử\n",
    );
    const plan = await planSync(makeTree({ [BYE]: withException }), emptySnapshot());
    expect(plan.links.find((l) => l.label === "demo/bye#q1")).toBeUndefined();
  });
});

describe("planSync · US1 import", () => {
  it("DB trống → thêm mới toàn bộ, published lấy từ file", async () => {
    const plan = await planSync(makeTree(), emptySnapshot());
    expect(plan.summary.courses.added).toBe(1);
    expect(plan.summary.units.added).toBe(2);
    expect(plan.summary.lessons.added).toBe(3);
    expect(plan.summary.exercises.added).toBe(4);
    expect(plan.courses.insert[0]).toMatchObject({ slug: "demo", published: true, ttsVoice: "af_heart" });
    const byKey = Object.fromEntries(plan.lessons.insert.map((l) => [l.contentKey, l]));
    expect(byKey["demo/hello"]).toMatchObject({ published: true, sortOrder: 1, sourcePath: "content/demo/01-greetings/01-hello.yaml" });
    expect(byKey["demo/bye"]).toMatchObject({ published: false, sortOrder: 2 });
    expect(plan.isEmpty).toBe(false);
  });

  it("chạy lại với DB khớp file → kế hoạch rỗng", async () => {
    const snap = await imported();
    const plan = await planSync(makeTree(), snap);
    expect(plan.isEmpty).toBe(true);
    expect(plan.issues).toEqual([]);
  });

  it("sửa một câu → đúng 1 cập nhật, cùng id", async () => {
    const snap = await imported();
    const tree = makeTree({
      "content/demo/01-greetings/01-hello.yaml": DEMO["content/demo/01-greetings/01-hello.yaml"].replace(
        "explanation: Lời chào.",
        "explanation: Lời chào phổ biến nhất.",
      ),
    });
    const plan = await planSync(tree, snap);
    expect(plan.summary.exercises).toEqual({ added: 0, updated: 1, archived: 0, restored: 0 });
    expect(plan.exercises.update[0].values).toEqual({ explanation: "Lời chào phổ biến nhất." });
    const old = snap.exercises.find((e) => e.key === "q1" && e.prompt.includes("hello"))!;
    expect(plan.exercises.update[0].id).toBe(old.id);
  });

  it("đổi thứ tự bài và đổi tên file → chỉ đổi sortOrder/sourcePath, giữ id", async () => {
    const snap = await imported();
    const files = { ...DEMO };
    files["content/demo/01-greetings/unit.yaml"] = files["content/demo/01-greetings/unit.yaml"].replace("[hello, bye]", "[bye, hello]");
    files["content/demo/01-greetings/01-xin-chao.yaml"] = files["content/demo/01-greetings/01-hello.yaml"];
    const tree = makeTree({ ...files, "content/demo/01-greetings/01-hello.yaml": null });
    const plan = await planSync(tree, snap);
    expect(plan.summary.lessons).toEqual({ added: 0, updated: 2, archived: 0, restored: 0 });
    const hello = snap.lessons.find((l) => l.contentKey === "demo/hello")!;
    const upd = plan.lessons.update.find((u) => u.id === hello.id)!;
    expect(upd.values).toEqual({ sortOrder: 2, sourcePath: "content/demo/01-greetings/01-xin-chao.yaml" });
    expect(plan.exercises.insert).toEqual([]);
  });

  it("chuyển bài sang unit khác → đổi unitId, cùng content_key", async () => {
    const snap = await imported();
    const files: Record<string, string | null> = {
      "content/demo/01-greetings/unit.yaml": DEMO["content/demo/01-greetings/unit.yaml"].replace("[hello, bye]", "[hello]"),
      "content/demo/02-family/unit.yaml": DEMO["content/demo/02-family/unit.yaml"].replace("[members]", "[members, bye]"),
      "content/demo/01-greetings/02-bye.yaml": null,
      "content/demo/02-family/02-bye.yaml": DEMO["content/demo/01-greetings/02-bye.yaml"],
    };
    const plan = await planSync(makeTree(files), snap);
    const bye = snap.lessons.find((l) => l.contentKey === "demo/bye")!;
    const family = snap.units.find((u) => u.key === "family")!;
    expect(plan.lessons.update).toEqual([
      expect.objectContaining({ id: bye.id, values: { unitId: family.id, sourcePath: "content/demo/02-family/02-bye.yaml" } }),
    ]);
    expect(plan.lessons.insert).toEqual([]);
  });

  it("xóa file bài → gỡ bài; thêm lại → khôi phục, giữ trạng thái xuất bản", async () => {
    const snap = await imported();
    const removed = {
      "content/demo/01-greetings/unit.yaml": DEMO["content/demo/01-greetings/unit.yaml"].replace("[hello, bye]", "[bye]"),
      "content/demo/01-greetings/01-hello.yaml": null,
    };
    const plan = await planSync(makeTree(removed), snap);
    expect(plan.lessons.archive.map((a) => a.label)).toEqual(["demo/hello"]);
    const afterRemove = applyPlan(snap, plan);
    const hello = afterRemove.lessons.find((l) => l.contentKey === "demo/hello")!;
    expect(hello.archivedAt).not.toBeNull();
    expect(afterRemove.lessons).toHaveLength(3); // không xóa dòng nào

    const back = await planSync(makeTree(), afterRemove);
    expect(back.summary.lessons.restored).toBe(1);
    const upd = back.lessons.update.find((u) => u.id === hello.id)!;
    expect(upd.values).toMatchObject({ archivedAt: null });
    expect(upd.values).not.toHaveProperty("published");
  });

  it("bài đã xuất bản trên /admin nhưng file ghi published: false → không đổi", async () => {
    const snap = await imported();
    snap.lessons.find((l) => l.contentKey === "demo/bye")!.published = true;
    const plan = await planSync(makeTree(), snap);
    expect(plan.isEmpty).toBe(true);
  });

  it("xóa câu khỏi file → gỡ câu", async () => {
    const snap = await imported();
    const text = DEMO["content/demo/01-greetings/01-hello.yaml"];
    const plan = await planSync(
      makeTree({ "content/demo/01-greetings/01-hello.yaml": text.slice(0, text.indexOf("  - id: q2")) }),
      snap,
    );
    expect(plan.exercises.archive.map((a) => a.label)).toEqual(["demo/hello#q2"]);
  });

  it("khóa trong DB không có trong file → cảnh báo orphan_course", async () => {
    const snap = await imported();
    snap.courses.push({ ...snap.courses[0], id: "other", slug: "old-course" });
    const plan = await planSync(makeTree(), snap);
    expect(plan.issues).toEqual([expect.objectContaining({ severity: "warning", code: "orphan_course" })]);
  });

  it("khóa cũ chưa có key → lỗi legacy_course; --replace-legacy thì xóa rồi tạo lại", async () => {
    const snap = await imported();
    for (const u of snap.units) u.key = null;
    const plan = await planSync(makeTree(), snap);
    expect(plan.issues).toEqual([expect.objectContaining({ severity: "error", code: "legacy_course" })]);
    expect(plan.summary.lessons.added).toBe(0);

    const replaced = await planSync(makeTree(), snap, { replaceLegacy: true });
    expect(replaced.issues).toEqual([]);
    expect(replaced.deleteCourses).toEqual([{ id: snap.courses[0].id, slug: "demo" }]);
    expect(replaced.summary.lessons.added).toBe(3);
  });
});
