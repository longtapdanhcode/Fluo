/**
 * Kiểm tra toàn bộ nội dung trong content/ mà không kết nối database.
 *   npm run content:check [-- --dir tests/fixtures/content/clean]
 * Thoát mã 1 nếu có lỗi. Hợp đồng: specs/001-lesson-content-pipeline/contracts/cli.md
 */
import { parseArgs } from "node:util";
import { parseContent } from "@/lib/content/parse";
import { formatIssues, formatSummary } from "@/lib/content/report";
import { countExceptions, validateContent } from "@/lib/content/validate";
import { loadContentFiles } from "./lib/load-files";

async function main(): Promise<number> {
  const { values: args } = parseArgs({ options: { dir: { type: "string", default: "content" } } });
  const started = performance.now();
  const files = await loadContentFiles(args.dir);
  if (files.length === 0) {
    console.log(`Không tìm thấy file .yaml nào trong "${args.dir}".`);
    return 1;
  }
  const { tree, issues: parseIssues } = parseContent(files);
  const issues = [...parseIssues, ...validateContent(tree)];
  if (issues.length) console.log(formatIssues(issues) + "\n");
  const exceptions = countExceptions(tree);
  if (exceptions) console.log(`Đang dùng ${exceptions} từ ngoại lệ.`);
  const ms = Math.round(performance.now() - started);
  console.log(`${formatSummary(tree, issues)} (${ms} ms)`);
  return issues.some((i) => i.severity === "error") ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
