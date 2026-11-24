import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { courses, exerciseVocabulary, exercises, lessons, units, vocabulary } from "@/db/schema";
import type { DbSnapshot } from "@/lib/content/sync";

/** Đọc mọi khóa, cùng unit / bài / câu / từ vựng / liên kết (kể cả mục đã gỡ) của các khóa có trong file. */
export async function loadSnapshot(courseSlugs: string[]): Promise<DbSnapshot> {
  const allCourses = await db
    .select({
      id: courses.id,
      slug: courses.slug,
      title: courses.title,
      description: courses.description,
      level: courses.level,
      audience: courses.audience,
      published: courses.published,
      ttsVoice: courses.ttsVoice,
    })
    .from(courses);
  const courseIds = allCourses.filter((c) => courseSlugs.includes(c.slug)).map((c) => c.id);
  if (courseIds.length === 0) {
    return { courses: allCourses, units: [], lessons: [], exercises: [], vocabulary: [], links: [] };
  }

  const unitRows = await db
    .select({
      id: units.id,
      courseId: units.courseId,
      key: units.key,
      title: units.title,
      description: units.description,
      sortOrder: units.sortOrder,
      archivedAt: units.archivedAt,
    })
    .from(units)
    .where(inArray(units.courseId, courseIds));
  const unitIds = unitRows.map((u) => u.id);

  const lessonRows = unitIds.length
    ? await db
        .select({
          id: lessons.id,
          unitId: lessons.unitId,
          contentKey: lessons.contentKey,
          title: lessons.title,
          xpReward: lessons.xpReward,
          sortOrder: lessons.sortOrder,
          published: lessons.published,
          sourcePath: lessons.sourcePath,
          archivedAt: lessons.archivedAt,
        })
        .from(lessons)
        .where(inArray(lessons.unitId, unitIds))
    : [];
  const lessonIds = lessonRows.map((l) => l.id);

  const exerciseRows = lessonIds.length
    ? await db
        .select({
          id: exercises.id,
          lessonId: exercises.lessonId,
          key: exercises.key,
          sortOrder: exercises.sortOrder,
          type: exercises.type,
          prompt: exercises.prompt,
          data: exercises.data,
          explanation: exercises.explanation,
          imageUrl: exercises.imageUrl,
          aiGenerated: exercises.aiGenerated,
          audioUrl: exercises.audioUrl,
          audioHash: exercises.audioHash,
          archivedAt: exercises.archivedAt,
        })
        .from(exercises)
        .where(inArray(exercises.lessonId, lessonIds))
    : [];

  const vocabRows = await db
    .select({
      id: vocabulary.id,
      courseId: vocabulary.courseId,
      unitId: vocabulary.unitId,
      word: vocabulary.word,
      wordKey: vocabulary.wordKey,
      meaningVi: vocabulary.meaningVi,
      example: vocabulary.example,
      forms: vocabulary.forms,
      sortOrder: vocabulary.sortOrder,
      audioUrl: vocabulary.audioUrl,
      audioHash: vocabulary.audioHash,
      archivedAt: vocabulary.archivedAt,
    })
    .from(vocabulary)
    .where(inArray(vocabulary.courseId, courseIds));

  const exerciseIds = exerciseRows.map((e) => e.id);
  const linkRows = exerciseIds.length
    ? await db
        .select({ exerciseId: exerciseVocabulary.exerciseId, vocabularyId: exerciseVocabulary.vocabularyId })
        .from(exerciseVocabulary)
        .where(inArray(exerciseVocabulary.exerciseId, exerciseIds))
    : [];

  return {
    courses: allCourses,
    units: unitRows,
    lessons: lessonRows,
    exercises: exerciseRows,
    vocabulary: vocabRows,
    links: linkRows,
  };
}
