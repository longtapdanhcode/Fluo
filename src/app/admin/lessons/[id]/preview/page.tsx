import { notFound } from "next/navigation";
import { LessonPlayer } from "@/components/lesson/lesson-player";
import { requireAdmin } from "@/lib/auth";
import { getLessonWithExercises } from "@/lib/content";
import { GAME } from "@/lib/game";

export const metadata = { title: "Xem trước bài" };

/** Quản trị viên chơi thử bài (kể cả chưa xuất bản); không ghi tiến độ, XP hay tim. */
export default async function AdminLessonPreview(props: PageProps<"/admin/lessons/[id]/preview">) {
  await requireAdmin();
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const content = await getLessonWithExercises(id);
  if (!content) notFound();

  if (content.exercises.length === 0) {
    return <p className="text-sm text-muted-foreground">Bài này chưa có câu nào.</p>;
  }

  return (
    <div className="-mx-4 -my-6">
      <LessonPlayer
        lessonId={content.lesson.id}
        mode="preview"
        exitHref={`/admin/lessons/${content.lesson.id}`}
        initialHearts={GAME.maxHearts}
        exercises={content.exercises.map((e) => ({
          id: e.id,
          prompt: e.prompt,
          data: e.data,
          audioUrl: e.audioUrl,
          imageUrl: e.imageUrl,
          explanation: e.explanation,
        }))}
      />
    </div>
  );
}
