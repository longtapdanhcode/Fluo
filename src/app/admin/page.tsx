import { asc, count, eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { courses, exercises, lessons, units } from "@/db/schema";
import { PublishToggle, QuickAddForm } from "./forms";

export default async function AdminHome() {
  const [allCourses, allUnits, allLessons] = await Promise.all([
    db.select().from(courses).orderBy(asc(courses.sortOrder)),
    db.select().from(units).orderBy(asc(units.sortOrder)),
    db
      .select({
        id: lessons.id,
        unitId: lessons.unitId,
        title: lessons.title,
        published: lessons.published,
        exerciseCount: count(exercises.id),
      })
      .from(lessons)
      .leftJoin(exercises, eq(exercises.lessonId, lessons.id))
      .groupBy(lessons.id)
      .orderBy(asc(lessons.sortOrder)),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-extrabold">Khóa học</h1>
        <p className="text-sm text-muted-foreground">
          Khóa học và từng bài phải ở trạng thái “Đã xuất bản” thì học viên mới thấy.
        </p>
      </div>

      {allCourses.map((c) => (
        <section key={c.id} className="rounded-2xl border p-5">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-extrabold">{c.title}</h2>
            <span className="text-xs font-bold uppercase text-muted-foreground">
              {c.level.replace("_", " ")} · {c.audience === "adult" ? "Người lớn" : "Trẻ em"}
            </span>
            <PublishToggle kind="course" id={c.id} published={c.published} />
          </div>

          <div className="mt-4 flex flex-col gap-4">
            {allUnits
              .filter((u) => u.courseId === c.id)
              .map((u) => (
                <div key={u.id} className="rounded-xl bg-muted/50 p-4">
                  <h3 className="font-bold">
                    Unit {u.sortOrder}: {u.title}
                  </h3>
                  <ul className="mt-2 flex flex-col gap-1">
                    {allLessons
                      .filter((l) => l.unitId === u.id)
                      .map((l) => (
                        <li key={l.id} className="flex items-center gap-3 rounded-lg bg-background px-3 py-2">
                          <Link href={`/admin/lessons/${l.id}`} className="flex-1 font-semibold hover:underline">
                            {l.title}
                          </Link>
                          <span className="text-xs text-muted-foreground">{l.exerciseCount} câu</span>
                          <PublishToggle kind="lesson" id={l.id} published={l.published} />
                        </li>
                      ))}
                  </ul>
                  <div className="mt-2 max-w-md">
                    <QuickAddForm kind="lesson" parentId={u.id} placeholder="Tên bài mới" />
                  </div>
                </div>
              ))}
            <div className="max-w-md">
              <QuickAddForm kind="unit" parentId={c.id} placeholder="Tên unit mới" />
            </div>
          </div>
        </section>
      ))}

      <section className="max-w-md">
        <h2 className="mb-2 font-bold">Thêm khóa học</h2>
        <QuickAddForm kind="course" placeholder="Ví dụ: Tiếng Anh A1 cho người mới" />
      </section>
    </div>
  );
}
