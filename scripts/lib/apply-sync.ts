import { execSync } from "node:child_process";
import { desc, eq, inArray, notInArray } from "drizzle-orm";
import { db } from "@/db";
import {
  contentReports,
  courses,
  exerciseVocabulary,
  exercises,
  lessons,
  units,
  vocabulary,
  type ContentReportOutcome,
} from "@/db/schema";
import type { Changes, SyncPlan } from "@/lib/content/sync";
import type { ContentIssue } from "@/lib/content/types";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
// Bảng có cột id + archived_at (gỡ thay vì xóa)
type ArchivableTable = typeof units | typeof lessons | typeof exercises | typeof vocabulary;

async function applyChanges<T extends object>(
  tx: Tx,
  table: ArchivableTable | typeof courses,
  changes: Changes<T>,
  now: Date,
) {
  if (changes.insert.length) {
    // Chia nhỏ để không vượt giới hạn tham số của Postgres
    for (let i = 0; i < changes.insert.length; i += 200) {
      await tx.insert(table).values(changes.insert.slice(i, i + 200) as never);
    }
  }
  for (const u of changes.update) {
    await tx.update(table).set(u.values as never).where(eq(table.id, u.id));
  }
  if (changes.archive.length && table !== courses) {
    const t = table as ArchivableTable;
    await tx
      .update(t)
      .set({ archivedAt: now } as never)
      .where(inArray(t.id, changes.archive.map((a) => a.id)));
  }
}

/**
 * Áp dụng kế hoạch trong MỘT transaction (FR-012): lỗi giữa chừng thì không có gì được ghi.
 * Mục không còn trong file được gỡ bằng archived_at; lesson_completions không bị đụng tới.
 */
export async function applySync(plan: SyncPlan) {
  const now = new Date();
  await db.transaction(async (tx) => {
    for (const c of plan.deleteCourses) await tx.delete(courses).where(eq(courses.id, c.id));
    await applyChanges(tx, courses, plan.courses, now);
    await applyChanges(tx, units, plan.units, now);
    await applyChanges(tx, lessons, plan.lessons, now);
    await applyChanges(tx, exercises, plan.exercises, now);
    await applyChanges(tx, vocabulary, plan.vocabulary, now);
    for (const l of plan.links) {
      await tx.delete(exerciseVocabulary).where(eq(exerciseVocabulary.exerciseId, l.exerciseId));
      if (l.vocabularyIds.length) {
        await tx
          .insert(exerciseVocabulary)
          .values(l.vocabularyIds.map((vocabularyId) => ({ exerciseId: l.exerciseId, vocabularyId })));
      }
    }
  });
}

export function gitCommit(): string | null {
  try {
    const hash = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    const dirty = execSync("git status --porcelain", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    return dirty ? `${hash}-dirty` : hash;
  } catch {
    return null;
  }
}

const KEEP_REPORTS = 20;

/**
 * Lưu kết quả kiểm tra để /admin hiện (FR-010). Ghi ngoài transaction nội dung, nên vẫn lưu được
 * khi import bị chặn hoặc bị hủy. Chỉ giữ 20 bản mới nhất.
 */
export async function saveReport(input: {
  outcome: ContentReportOutcome;
  issues: ContentIssue[];
  summary?: Record<string, unknown>;
}) {
  await db.insert(contentReports).values({
    outcome: input.outcome,
    errors: input.issues.filter((i) => i.severity === "error"),
    warnings: input.issues.filter((i) => i.severity === "warning"),
    summary: input.summary ?? {},
    gitCommit: gitCommit(),
  });
  const keep = await db
    .select({ id: contentReports.id })
    .from(contentReports)
    .orderBy(desc(contentReports.createdAt))
    .limit(KEEP_REPORTS);
  if (keep.length === KEEP_REPORTS) {
    await db.delete(contentReports).where(notInArray(contentReports.id, keep.map((k) => k.id)));
  }
}

export async function closeDb() {
  await db.$client.end({ timeout: 5 });
}
