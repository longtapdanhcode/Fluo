import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { SourceFile } from "../../src/lib/content/types";

export const REPO_ROOT = path.resolve(__dirname, "../..");

/** Đọc đệ quy mọi file .yaml/.yml trong thư mục nội dung; đường dẫn trả về tương đối từ gốc repo. */
export async function loadContentFiles(dir = "content"): Promise<SourceFile[]> {
  const root = path.resolve(REPO_ROOT, dir);
  const out: SourceFile[] = [];
  async function walk(current: string) {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(current, e.name);
      if (e.isDirectory()) await walk(full);
      else if (/\.ya?ml$/.test(e.name)) {
        out.push({
          path: path.relative(REPO_ROOT, full).split(path.sep).join("/"),
          text: await readFile(full, "utf8"),
        });
      }
    }
  }
  await walk(root);
  return out;
}
