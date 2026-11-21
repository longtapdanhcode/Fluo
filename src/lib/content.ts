import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { courses, exercises, lessonCompletions, lessons, units } from "@/db/schema";

export type PathLesson = {
  id: string;
  title: string;
  xpReward: number;
  status: "done" | "current" | "locked";
};
export type PathUnit = { id: string; title: string; description: string | null; lessons: PathLesson[] };

/** Khóa học đầu tiên đã xuất bản cho đối tượng này. */
export async function getActiveCourse(audience: "adult" | "kid") {
  return db.query.courses.findFirst({
    where: and(eq(courses.published, true), eq(courses.audience, audience)),
    orderBy: asc(courses.sortOrder),
  });
}

/** Lộ trình: các unit và bài, bài N mở khi đã xong bài N-1. */
export async function getCoursePath(courseId: string, profileId: string): Promise<PathUnit[]> {
  const rows = await db
    .select({
      unitId: units.id,
      unitTitle: units.title,
      unitDescription: units.description,
      lessonId: lessons.id,
      lessonTitle: lessons.title,
      xpReward: lessons.xpReward,
    })
    .from(units)
    .innerJoin(lessons, and(eq(lessons.unitId, units.id), eq(lessons.published, true)))
    .where(eq(units.courseId, courseId))
    .orderBy(asc(units.sortOrder), asc(lessons.sortOrder));

  const lessonIds = rows.map((r) => r.lessonId);
  const done = new Set(
    lessonIds.length
      ? (
          await db
            .selectDistinct({ lessonId: lessonCompletions.lessonId })
            .from(lessonCompletions)
            .where(
              and(
                eq(lessonCompletions.profileId, profileId),
                inArray(lessonCompletions.lessonId, lessonIds),
              ),
            )
        ).map((r) => r.lessonId)
      : [],
  );

  const result: PathUnit[] = [];
  let previousDone = true;
  for (const r of rows) {
    let unit = result.at(-1);
    if (!unit || unit.id !== r.unitId) {
      unit = { id: r.unitId, title: r.unitTitle, description: r.unitDescription, lessons: [] };
      result.push(unit);
    }
    const isDone = done.has(r.lessonId);
    unit.lessons.push({
      id: r.lessonId,
      title: r.lessonTitle,
      xpReward: r.xpReward,
      status: isDone ? "done" : previousDone ? "current" : "locked",
    });
    previousDone = isDone;
  }
  return result;
}

/** Kiểm tra bài đã mở khóa cho hồ sơ này chưa (chống vào thẳng bằng URL). */
export async function isLessonUnlocked(lessonId: string, profileId: string) {
  const lesson = await db.query.lessons.findFirst({
    where: and(eq(lessons.id, lessonId), eq(lessons.published, true)),
  });
  if (!lesson) return false;
  const unit = await db.query.units.findFirst({ where: eq(units.id, lesson.unitId) });
  if (!unit) return false;
  const path = await getCoursePath(unit.courseId, profileId);
  return path.some((u) => u.lessons.some((l) => l.id === lessonId && l.status !== "locked"));
}

export async function getLessonWithExercises(lessonId: string) {
  const lesson = await db.query.lessons.findFirst({ where: eq(lessons.id, lessonId) });
  if (!lesson) return null;
  const items = await db
    .select()
    .from(exercises)
    .where(eq(exercises.lessonId, lessonId))
    .orderBy(asc(exercises.sortOrder));
  return { lesson, exercises: items };
}

/** Bài học thử cho khách: bài đầu tiên của khóa người lớn. */
export async function getTrialLessonId() {
  const course = await getActiveCourse("adult");
  if (!course) return null;
  const [row] = await db
    .select({ id: lessons.id })
    .from(lessons)
    .innerJoin(units, eq(units.id, lessons.unitId))
    .where(and(eq(units.courseId, course.id), eq(lessons.published, true)))
    .orderBy(asc(units.sortOrder), asc(lessons.sortOrder))
    .limit(1);
  return row?.id ?? null;
}
