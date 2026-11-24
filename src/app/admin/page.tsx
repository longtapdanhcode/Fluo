import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { contentReports, courses, exercises, lessons, units, type ContentReport } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { PublishToggle } from "./forms";

const OUTCOME_LABELS: Record<ContentReport["outcome"], string> = {
  imported: "Đã import",
  no_changes: "Không có thay đổi",
  blocked: "Bị chặn vì lỗi",
  cancelled: "Đã hủy ở bước xác nhận",
  dry_run: "Chạy thử",
};

const timeFormat = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  dateStyle: "short",
  timeStyle: "short",
});

export default async function AdminHome() {
  await requireAdmin();

  const [allCourses, unitRows, lessonRows, archivedLessons, [report]] = await Promise.all([
    db.select().from(courses).orderBy(asc(courses.sortOrder), asc(courses.title)),
    db.select().from(units).orderBy(asc(units.sortOrder)),
    db
      .select({
        id: lessons.id,
        unitId: lessons.unitId,
        title: lessons.title,
        published: lessons.published,
        sourcePath: lessons.sourcePath,
        total: sql<number>`count(${exercises.id})::int`,
        ai: sql<number>`(count(${exercises.id}) filter (where ${exercises.aiGenerated}))::int`,
        listen: sql<number>`(count(${exercises.id}) filter (where ${inArray(exercises.type, ["listen_select", "listen_type"])}))::int`,
        audio: sql<number>`(count(${exercises.id}) filter (where ${isNotNull(exercises.audioUrl)}))::int`,
      })
      .from(lessons)
      .leftJoin(exercises, and(eq(exercises.lessonId, lessons.id), isNull(exercises.archivedAt)))
      .where(isNull(lessons.archivedAt))
      .groupBy(lessons.id)
      .orderBy(asc(lessons.sortOrder)),
    db.select({ unitId: lessons.unitId }).from(lessons).where(isNotNull(lessons.archivedAt)),
    db.select().from(contentReports).orderBy(desc(contentReports.createdAt)).limit(1),
  ]);

  const courseOfUnit = new Map(unitRows.map((u) => [u.id, u.courseId]));
  const archivedCount = (courseId: string) =>
    unitRows.filter((u) => u.courseId === courseId && u.archivedAt).length +
    archivedLessons.filter((l) => courseOfUnit.get(l.unitId) === courseId).length;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-extrabold">Khóa học</h1>
        <p className="text-sm text-muted-foreground">
          Nội dung soạn trong thư mục <code>content/</code> rồi chạy <code>npm run content:import</code>. Ở đây chỉ xem
          trước và bật/tắt xuất bản: khóa và từng bài phải “Đã xuất bản” thì học viên mới thấy.
        </p>
      </div>

      <ReportPanel report={report} />

      {allCourses.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Chưa có khóa nào. Chạy <code>npm run content:import</code> để nạp nội dung.
        </p>
      )}

      {allCourses.map((c) => {
        const archived = archivedCount(c.id);
        return (
          <section key={c.id} className="rounded-2xl border p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 className="text-lg font-extrabold">{c.title}</h2>
              <span className="text-xs font-bold uppercase text-muted-foreground">
                {c.slug} · {c.level.replace("_", " ")} · {c.audience === "adult" ? "Người lớn" : "Trẻ em"}
              </span>
              <PublishToggle kind="course" id={c.id} published={c.published} />
            </div>
            {archived > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {archived} unit/bài đã gỡ (không còn trong file); lịch sử học vẫn giữ.
              </p>
            )}

            <div className="mt-4 flex flex-col gap-4">
              {unitRows
                .filter((u) => u.courseId === c.id && !u.archivedAt)
                .map((u, ui) => (
                  <div key={u.id} className="rounded-xl bg-muted/50 p-3 sm:p-4">
                    <h3 className="font-bold">
                      Unit {ui + 1}: {u.title}
                    </h3>
                    <ul className="mt-2 flex flex-col gap-2">
                      {lessonRows
                        .filter((l) => l.unitId === u.id)
                        .map((l) => (
                          <li key={l.id} className="flex flex-col gap-1 rounded-lg bg-background px-3 py-2">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                              <Link href={`/admin/lessons/${l.id}`} className="min-w-0 flex-1 font-semibold hover:underline">
                                {l.title}
                              </Link>
                              <Link
                                href={`/admin/lessons/${l.id}/preview`}
                                className="text-xs font-bold text-primary hover:underline"
                              >
                                Xem trước
                              </Link>
                              <PublishToggle kind="lesson" id={l.id} published={l.published} />
                            </div>
                            <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                              <span>{l.total} câu</span>
                              {l.ai > 0 && <span>{l.ai} câu AI</span>}
                              {l.listen > 0 && (
                                <span>
                                  Âm thanh {l.audio}/{l.listen}
                                </span>
                              )}
                              {l.sourcePath && <code className="break-all">{l.sourcePath}</code>}
                            </div>
                          </li>
                        ))}
                    </ul>
                  </div>
                ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ReportPanel({ report }: { report: ContentReport | undefined }) {
  if (!report) {
    return (
      <section className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
        Chưa có lần import nào được ghi lại.
      </section>
    );
  }
  const bad = report.errors.length > 0;
  return (
    <section className={`rounded-2xl border p-4 ${bad ? "border-destructive/50 bg-danger-soft" : ""}`}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="font-bold">Kiểm tra gần nhất</h2>
        <span className={`text-sm font-bold ${bad ? "text-destructive" : "text-success"}`}>
          {OUTCOME_LABELS[report.outcome]}
        </span>
        <span className="text-xs text-muted-foreground">
          {timeFormat.format(report.createdAt)}
          {report.gitCommit && ` · commit ${report.gitCommit}`}
        </span>
      </div>
      <p className="mt-1 text-sm">
        {report.errors.length} lỗi · {report.warnings.length} cảnh báo
      </p>
      {[...report.errors, ...report.warnings].length > 0 && (
        <ul className="mt-2 flex flex-col gap-1 text-xs">
          {[...report.errors, ...report.warnings].map((i, n) => (
            <li key={n} className="break-words">
              <span className={i.severity === "error" ? "font-bold text-destructive" : "font-bold text-orange-500"}>
                {i.severity === "error" ? "Lỗi" : "Cảnh báo"}
              </span>{" "}
              <code>
                {i.file}:{i.line ?? 1}
              </code>{" "}
              [{i.code}]{i.exerciseIndex ? ` câu #${i.exerciseIndex}${i.exerciseKey ? ` (${i.exerciseKey})` : ""}` : ""}{" "}
              {i.message}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
