import Link from "next/link";
import { LessonPlayer } from "@/components/lesson/lesson-player";
import { buttonVariants } from "@/components/ui/button";
import { getLessonWithExercises, getTrialLessonId } from "@/lib/content";
import { GAME } from "@/lib/game";

export const metadata = { title: "Học thử" };

/** Khách học thử bài đầu tiên, không cần đăng nhập, không lưu tiến độ. */
export default async function TryPage() {
  const id = await getTrialLessonId();
  const content = id ? await getLessonWithExercises(id) : null;

  if (!content || content.exercises.length === 0) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-muted-foreground">Chưa có bài học thử. Chạy <code>npm run db:seed</code> để thêm bài mẫu.</p>
        <Link href="/" className={buttonVariants()}>
          Về trang chủ
        </Link>
      </main>
    );
  }

  return (
    <LessonPlayer
      lessonId={content.lesson.id}
      mode="trial"
      initialHearts={GAME.maxHearts}
      exercises={content.exercises.map((e) => ({
        id: e.id,
        prompt: e.prompt,
        data: e.data,
        audioUrl: e.audioUrl,
        imageUrl: e.imageUrl,
      }))}
    />
  );
}
