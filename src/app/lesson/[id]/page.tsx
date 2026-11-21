import Link from "next/link";
import { notFound } from "next/navigation";
import { LessonPlayer } from "@/components/lesson/lesson-player";
import { buttonVariants } from "@/components/ui/button";
import { requireProfile } from "@/lib/auth";
import { getLessonWithExercises, isLessonUnlocked } from "@/lib/content";
import { minutesUntilNextHeart } from "@/lib/game";

export default async function LessonPage(props: PageProps<"/lesson/[id]">) {
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const profile = await requireProfile();
  const [content, unlocked] = await Promise.all([getLessonWithExercises(id), isLessonUnlocked(id, profile.id)]);
  if (!content || !unlocked || content.exercises.length === 0) notFound();

  if (profile.hearts <= 0) {
    const minutes = minutesUntilNextHeart(profile.heartsUpdatedAt);
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="text-6xl" aria-hidden>
          💔
        </div>
        <h1 className="text-2xl font-extrabold">Bạn đã hết tim</h1>
        <p className="text-muted-foreground">Tim tiếp theo hồi sau khoảng {minutes} phút.</p>
        <Link href="/learn" className={buttonVariants({ size: "lg" })}>
          Về trang học
        </Link>
      </main>
    );
  }

  return (
    <LessonPlayer
      lessonId={id}
      mode="learn"
      initialHearts={profile.hearts}
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
