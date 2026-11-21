import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { units } from "@/db/schema";
import { aiConfigured } from "@/lib/ai";
import { getLessonWithExercises } from "@/lib/content";
import { ExerciseEditor, GenerateForm, NewExercise, PublishToggle } from "../../forms";

export default async function AdminLessonPage(props: PageProps<"/admin/lessons/[id]">) {
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
          ← {unit?.title}
        </Link>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="text-2xl font-extrabold">{lesson.title}</h1>
          <PublishToggle kind="lesson" id={lesson.id} published={lesson.published} />
        </div>
        <p className="text-sm text-muted-foreground">
          {exercises.length} câu · {lesson.xpReward} XP
        </p>
      </div>

      <GenerateForm lessonId={lesson.id} defaultTopic={lesson.title} aiReady={aiConfigured} />

      <section className="flex flex-col gap-3">
        <h2 className="font-bold">Các câu hỏi</h2>
        {exercises.length === 0 && <p className="text-sm text-muted-foreground">Chưa có câu nào.</p>}
        {exercises.map((e, i) => (
          <ExerciseEditor key={e.id} lessonId={lesson.id} index={i} exercise={e} />
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-bold">Thêm câu thủ công</h2>
        <NewExercise lessonId={lesson.id} />
      </section>
    </div>
  );
}
