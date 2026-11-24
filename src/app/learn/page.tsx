import { Check, Lock, Star } from "lucide-react";
import Link from "next/link";
import { StatsBar } from "@/components/stats-bar";
import { getUser, isAdminEmail, requireProfile } from "@/lib/auth";
import { getActiveCourse, getCoursePath, type PathLesson } from "@/lib/content";
import { displayStreak } from "@/lib/game";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

export const metadata = { title: "Học" };

// Xếp nút bài học lượn sóng như một con đường.
const OFFSETS = [0, 40, 64, 40, 0, -40, -64, -40];

function LessonNode({ lesson, index }: { lesson: PathLesson; index: number }) {
  const style = { transform: `translateX(${OFFSETS[index % OFFSETS.length]}px)` };
  const base =
    "flex size-18 items-center justify-center rounded-full border-b-[6px] text-white transition active:translate-y-0.5 active:border-b-2";
  const icon =
    lesson.status === "done" ? (
      <Check className="size-8" strokeWidth={3} />
    ) : lesson.status === "current" ? (
      <Star className="size-8 fill-current" />
    ) : (
      <Lock className="size-7" />
    );

  return (
    <div className="flex flex-col items-center gap-1" style={style}>
      {lesson.status === "locked" ? (
        <span className={cn(base, "cursor-not-allowed border-zinc-300 bg-zinc-200 text-zinc-400")} aria-disabled>
          {icon}
        </span>
      ) : (
        <Link
          href={`/lesson/${lesson.id}`}
          className={cn(
            base,
            lesson.status === "done"
              ? "border-amber-600 bg-gold"
              : "border-[oklch(0.45_0.2_262)] bg-primary ring-4 ring-primary/25",
          )}
          aria-label={`Bài: ${lesson.title}`}
        >
          {icon}
        </Link>
      )}
      <span className="max-w-32 text-center text-xs font-semibold text-muted-foreground">{lesson.title}</span>
    </div>
  );
}

export default async function LearnPage() {
  const [profile, user] = await Promise.all([requireProfile(), getUser()]);
  const course = await getActiveCourse("adult");
  const path = course ? await getCoursePath(course.id, profile.id) : [];
  let index = 0;

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-xl font-extrabold text-primary">
            {site.name}
          </Link>
          <StatsBar
            streak={displayStreak(profile.streakCurrent, profile.lastActiveDate)}
            xp={profile.xpTotal}
            hearts={profile.hearts}
          />
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        {!course || path.length === 0 ? (
          <div className="rounded-2xl border p-6 text-center text-muted-foreground">
            Chưa có khóa học nào được xuất bản.
            {isAdminEmail(user?.email) && (
              <>
                {" "}
                <Link href="/admin" className="font-bold text-primary underline">
                  Vào trang quản trị
                </Link>{" "}
                để xuất bản bài, hoặc chạy <code>npm run content:import</code> để nạp nội dung.
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-10">
            {path.map((unit, u) => (
              <section key={unit.id} className="flex flex-col gap-8">
                <div className="rounded-2xl bg-primary p-4 text-primary-foreground">
                  <p className="text-xs font-bold uppercase opacity-80">Unit {u + 1}</p>
                  <h2 className="text-lg font-extrabold">{unit.title}</h2>
                  {unit.description && <p className="text-sm opacity-90">{unit.description}</p>}
                </div>
                <div className="flex flex-col items-center gap-6">
                  {unit.lessons.map((l) => (
                    <LessonNode key={l.id} lesson={l} index={index++} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      <footer className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 py-6 text-sm text-muted-foreground">
        <span>Xin chào, {profile.displayName}</span>
        <div className="flex items-center gap-4">
          {isAdminEmail(user?.email) && (
            <Link href="/admin" className="hover:underline">
              Quản trị
            </Link>
          )}
          <form action="/auth/signout" method="post">
            <button className="hover:underline">Đăng xuất</button>
          </form>
        </div>
      </footer>
    </div>
  );
}
