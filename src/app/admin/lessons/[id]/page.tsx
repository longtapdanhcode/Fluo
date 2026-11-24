import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { units } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { getLessonWithExercises } from "@/lib/content";
import { correctAnswerText } from "@/lib/exercises/check";
import { exerciseTypeLabels } from "@/lib/exercises/types";
import { buttonVariants } from "@/components/ui/button";
import { PublishToggle } from "../../forms";

/** Xem nội dung bài ở dạng chỉ đọc. Sửa nội dung trong file nguồn rồi chạy content:import. */
export default async function AdminLessonPage(props: PageProps<"/admin/lessons/[id]">) {
  await requireAdmin();
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const content = await getLessonWithExercises(id);
  if (!content) notFound();
  const { lesson, exercises } = content;
  const unit = await db.query.units.findFirst({ where: eq(units.id, lesson.unitId) });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin" className="text-sm text-muted-foreground hover:underline">
          ← {unit?.title ?? "Khóa học"}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-extrabold">{lesson.title}</h1>
          <PublishToggle kind="lesson" id={lesson.id} published={lesson.published} />
          {lesson.archivedAt && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">Đã gỡ</span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {exercises.length} câu · {lesson.xpReward} XP
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-dashed p-4 text-sm sm:flex-row sm:items-center">
        <p className="flex-1">
          Sửa nội dung trong file{" "}
          <code className="break-all font-bold">{lesson.sourcePath ?? "(chưa có, dữ liệu tạo trước quy trình file)"}</code>{" "}
          rồi chạy <code>npm run content:import</code>.
        </p>
        <Link href={`/admin/lessons/${lesson.id}/preview`} className={buttonVariants()}>
          Xem trước
        </Link>
      </div>

      <ol className="flex flex-col gap-3">
        {exercises.length === 0 && <p className="text-sm text-muted-foreground">Chưa có câu nào.</p>}
        {exercises.map((e, i) => (
          <li key={e.id} className="rounded-xl border p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
              <span>Câu {i + 1}</span>
              <span>· {exerciseTypeLabels[e.data.type]}</span>
              {e.key && <code className="normal-case">{e.key}</code>}
              {e.aiGenerated && <span className="rounded-full bg-muted px-2 py-0.5 normal-case">AI tạo</span>}
              {(e.data.type === "listen_select" || e.data.type === "listen_type") && (
                <span className="normal-case">{e.audioUrl ? "🔊 có âm thanh" : "🔇 chưa có âm thanh"}</span>
              )}
            </div>
            <p className="mt-2 font-semibold">{e.prompt}</p>
            <p className="mt-1 text-sm">
              Đáp án: <span className="font-bold">{correctAnswerText(e.data)}</span>
            </p>
            {e.explanation && <p className="mt-1 text-sm text-muted-foreground">{e.explanation}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}
