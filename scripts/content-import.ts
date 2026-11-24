/**
 * Đồng bộ thư mục content/ vào database.
 *   npm run content:import                     kiểm tra, in tóm tắt, hỏi xác nhận rồi ghi
 *   npm run content:import -- --dry-run        chỉ in tóm tắt, không ghi nội dung
 *   npm run content:import -- --yes            không hỏi (chạy không tương tác)
 *   npm run content:import -- --replace-legacy xóa khóa tạo trước quy trình file rồi tạo lại (luôn hỏi)
 * Hợp đồng: specs/001-lesson-content-pipeline/contracts/cli.md
 */
import "./lib/env";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import { parseContent } from "@/lib/content/parse";
import { formatIssues, formatPlan, formatSummary } from "@/lib/content/report";
import { planSync } from "@/lib/content/sync";
import { validateContent } from "@/lib/content/validate";
import { applySync, closeDb, saveReport } from "./lib/apply-sync";
import { loadSnapshot } from "./lib/db-snapshot";
import { loadContentFiles } from "./lib/load-files";

/** Hỏi y/N. Đọc được cả câu trả lời truyền qua pipe (echo y | …); hết input thì coi là "không". */
async function confirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise<string>((resolve) => {
    rl.once("close", () => resolve(""));
    rl.question(`${question} (y/N) `).then(resolve, () => resolve(""));
  });
  rl.close();
  if (!process.stdin.isTTY) console.log(answer);
  return /^(y|yes|c|có)$/i.test(answer.trim());
}

function dbHost(): string {
  try {
    const url = new URL(process.env.DATABASE_URL ?? "");
    return `${url.hostname}:${url.port || "5432"}${url.pathname}`;
  } catch {
    return "(DATABASE_URL không hợp lệ)";
  }
}

async function main(): Promise<number> {
  const { values: args } = parseArgs({
    options: {
      "dry-run": { type: "boolean", default: false },
      yes: { type: "boolean", default: false },
      "replace-legacy": { type: "boolean", default: false },
      dir: { type: "string", default: "content" },
    },
  });

  // 1. Kiểm tra
  const files = await loadContentFiles(args.dir);
  const { tree, issues: parseIssues } = parseContent(files);
  const issues = [...parseIssues, ...validateContent(tree)];
  if (issues.length) console.log(formatIssues(issues) + "\n");
  if (issues.some((i) => i.severity === "error")) {
    console.log(formatSummary(tree, issues));
    await saveReport({ outcome: "blocked", issues });
    console.log("Import bị chặn: sửa các lỗi trên rồi chạy lại. Database không thay đổi.");
    return 1;
  }

  // 2–3. Tính kế hoạch, in đích và tóm tắt
  const snapshot = await loadSnapshot(tree.courses.map((c) => c.key));
  const plan = await planSync(tree, snapshot, { replaceLegacy: args["replace-legacy"] });
  const allIssues = [...issues, ...plan.issues];
  if (plan.issues.length) console.log(formatIssues(plan.issues) + "\n");
  if (plan.issues.some((i) => i.severity === "error")) {
    await saveReport({ outcome: "blocked", issues: allIssues });
    console.log("Import bị chặn. Database không thay đổi.");
    return 1;
  }

  console.log(`Đích: ${dbHost()}`);
  console.log(formatPlan(plan));
  const summary = { ...plan.summary, deletedCourses: plan.deleteCourses.map((c) => c.slug) };

  // 4. Không có thay đổi
  if (plan.isEmpty) {
    await saveReport({ outcome: "no_changes", issues: allIssues, summary });
    return 0;
  }

  // 5. Chạy thử / xác nhận
  if (args["dry-run"]) {
    await saveReport({ outcome: "dry_run", issues: allIssues, summary });
    console.log("\nChạy thử: không ghi gì vào database.");
    return 0;
  }
  if (plan.deleteCourses.length) {
    const slugs = plan.deleteCourses.map((c) => c.slug).join(", ");
    const ok = await confirm(`\nXÓA khóa cũ "${slugs}" (kể cả lượt học của khóa đó) rồi tạo lại từ file?`);
    if (!ok) {
      await saveReport({ outcome: "cancelled", issues: allIssues, summary });
      console.log("Đã hủy. Database không thay đổi.");
      return 0;
    }
  }
  if (!args.yes && !(await confirm("\nGhi vào database?"))) {
    await saveReport({ outcome: "cancelled", issues: allIssues, summary });
    console.log("Đã hủy. Database không thay đổi.");
    return 0;
  }

  // 6. Ghi trong một transaction
  try {
    await applySync(plan);
  } catch (e) {
    console.error(`\n✗ Ghi thất bại, đã hoàn tác toàn bộ: ${e instanceof Error ? e.message : e}`);
    return 1;
  }
  await saveReport({ outcome: "imported", issues: allIssues, summary });
  console.log("\n✓ Đã import.");
  return 0;
}

main()
  .then(async (code) => {
    await closeDb();
    process.exit(code);
  })
  .catch(async (e) => {
    console.error(e);
    await closeDb().catch(() => {});
    process.exit(1);
  });
