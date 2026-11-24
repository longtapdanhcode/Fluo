import type { EntityName, SyncPlan } from "./sync";
import type { ContentIssue, ContentTree } from "./types";

const ENTITY_LABELS: Record<EntityName, string> = {
  courses: "Khóa",
  units: "Unit",
  lessons: "Bài",
  exercises: "Câu",
  vocabulary: "Từ vựng",
  links: "Liên kết câu ↔ từ",
};

/** Tóm tắt kế hoạch import: số mục thêm / sửa / gỡ / khôi phục và danh sách bài bị gỡ. */
export function formatPlan(plan: SyncPlan): string {
  if (plan.isEmpty) return "Không có thay đổi.";
  const lines: string[] = [];
  for (const c of plan.deleteCourses) lines.push(`  ⚠ Xóa khóa cũ "${c.slug}" rồi tạo lại từ file`);
  for (const [name, label] of Object.entries(ENTITY_LABELS) as [EntityName, string][]) {
    const c = plan.summary[name];
    if (name === "links") {
      if (c.updated) lines.push(`  ${label.padEnd(18)} cập nhật cho ${c.updated} câu`);
      continue;
    }
    const parts = [
      c.added && `+${c.added} thêm`,
      c.updated && `~${c.updated} sửa`,
      c.archived && `-${c.archived} gỡ`,
      c.restored && `↺${c.restored} khôi phục`,
    ].filter(Boolean);
    if (parts.length) lines.push(`  ${label.padEnd(18)} ${parts.join(", ")}`);
  }
  if (plan.lessons.archive.length) {
    lines.push("  Bài bị gỡ khỏi lộ trình (lịch sử học vẫn giữ):");
    for (const a of plan.lessons.archive) lines.push(`    - ${a.label}`);
  }
  if (plan.units.archive.length) {
    lines.push("  Unit bị gỡ:");
    for (const a of plan.units.archive) lines.push(`    - ${a.label}`);
  }
  return lines.join("\n");
}

/** In lỗi theo nhóm file, mỗi dòng: `file:dòng  [mã]  câu #n (id)  mô tả`. */
export function formatIssues(issues: ContentIssue[]): string {
  if (issues.length === 0) return "";
  const byFile = new Map<string, ContentIssue[]>();
  for (const i of issues) byFile.set(i.file, [...(byFile.get(i.file) ?? []), i]);
  const lines: string[] = [];
  for (const [file, list] of [...byFile].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(file);
    for (const i of [...list].sort((a, b) => (a.line ?? 0) - (b.line ?? 0))) {
      const where = `${file}:${i.line ?? 1}`;
      const ex = i.exerciseIndex ? `  câu #${i.exerciseIndex}${i.exerciseKey ? ` (${i.exerciseKey})` : ""}` : "";
      const mark = i.severity === "error" ? "✗" : "!";
      lines.push(`  ${mark} ${where}  [${i.code}]${ex}  ${i.message}`);
    }
  }
  return lines.join("\n");
}

export function countTree(tree: ContentTree) {
  let units = 0;
  let lessons = 0;
  let exercises = 0;
  let words = 0;
  for (const c of tree.courses) {
    units += c.units.length;
    for (const u of c.units) {
      words += u.vocabulary.length;
      lessons += u.lessons.length;
      for (const l of u.lessons) exercises += l.exercises.length;
    }
  }
  return { courses: tree.courses.length, units, lessons, exercises, words };
}

/** Dòng tổng kết cuối của content:check / content:import. */
export function formatSummary(tree: ContentTree, issues: ContentIssue[]): string {
  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.length - errors;
  if (errors > 0) return `✗ ${errors} lỗi, ${warnings} cảnh báo`;
  const n = countTree(tree);
  const warn = warnings ? ` · ${warnings} cảnh báo` : "";
  return `✓ Không có lỗi · ${n.courses} khóa, ${n.units} unit, ${n.lessons} bài, ${n.exercises} câu, ${n.words} từ${warn}`;
}
