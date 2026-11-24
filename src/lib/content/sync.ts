import type { ExerciseData, ExerciseType } from "@/lib/exercises/types";
import { normalize } from "@/lib/exercises/check";
import { audioHash, audioText } from "./audio";
import type { CefrLevel, ContentIssue, ContentTree } from "./types";
import { linkWords, type VocabRef } from "./words";

/**
 * Tính kế hoạch đồng bộ file → database (research R5). Hàm thuần: nhận ảnh chụp DB dạng object,
 * trả về danh sách thêm / sửa / gỡ / khôi phục; script áp dụng kế hoạch trong một transaction.
 * Không bao giờ xóa dòng (trừ khi thay khóa cũ bằng --replace-legacy) và không đụng tiến độ học viên.
 */

export type CourseRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  level: CefrLevel;
  audience: "adult" | "kid";
  published: boolean;
  ttsVoice: string | null;
};
export type UnitRow = {
  id: string;
  courseId: string;
  key: string | null;
  title: string;
  description: string | null;
  sortOrder: number;
  archivedAt: Date | null;
};
export type LessonRow = {
  id: string;
  unitId: string;
  contentKey: string | null;
  title: string;
  xpReward: number;
  sortOrder: number;
  published: boolean;
  sourcePath: string | null;
  archivedAt: Date | null;
};
export type ExerciseRow = {
  id: string;
  lessonId: string;
  key: string | null;
  sortOrder: number;
  type: ExerciseType;
  prompt: string;
  data: ExerciseData;
  explanation: string | null;
  imageUrl: string | null;
  aiGenerated: boolean;
  audioUrl: string | null;
  audioHash: string | null;
  archivedAt: Date | null;
};
export type VocabRow = {
  id: string;
  courseId: string;
  unitId: string;
  word: string;
  wordKey: string;
  meaningVi: string;
  example: string | null;
  forms: string[];
  sortOrder: number;
  audioUrl: string | null;
  audioHash: string | null;
  archivedAt: Date | null;
};
export type LinkRow = { exerciseId: string; vocabularyId: string };

export type DbSnapshot = {
  /** Mọi khóa trong DB (để cảnh báo khóa không có trong thư mục nội dung). */
  courses: CourseRow[];
  units: UnitRow[];
  lessons: LessonRow[];
  exercises: ExerciseRow[];
  vocabulary: VocabRow[];
  links: LinkRow[];
};

export type Update<T> = { id: string; values: Partial<T>; label: string; restored: boolean };
export type Changes<T> = {
  insert: T[];
  update: Update<T>[];
  archive: { id: string; label: string }[];
};

export type EntityName = "courses" | "units" | "lessons" | "exercises" | "vocabulary" | "links";
export type Counts = { added: number; updated: number; archived: number; restored: number };

export type SyncPlan = {
  /** Khóa cũ (trước quy trình file) bị xóa rồi tạo lại khi chạy --replace-legacy. */
  deleteCourses: { id: string; slug: string }[];
  courses: Changes<CourseRow>;
  units: Changes<UnitRow>;
  lessons: Changes<LessonRow>;
  exercises: Changes<ExerciseRow>;
  vocabulary: Changes<VocabRow>;
  /** Thay toàn bộ liên kết của từng câu bằng danh sách mới. */
  links: { exerciseId: string; vocabularyIds: string[]; label: string }[];
  issues: ContentIssue[];
  summary: Record<EntityName, Counts>;
  isEmpty: boolean;
};

export type SyncOptions = { replaceLegacy?: boolean; newId?: () => string };

/** JSON có khóa sắp xếp, để so sánh jsonb (Postgres tự sắp khóa) với dữ liệu từ file. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  return JSON.stringify(value ?? null);
}

function diff<T extends object>(current: T, wanted: Partial<T>): Partial<T> | null {
  const out: Partial<T> = {};
  let changed = false;
  for (const key of Object.keys(wanted) as (keyof T)[]) {
    if (canonical(current[key]) !== canonical(wanted[key])) {
      out[key] = wanted[key];
      changed = true;
    }
  }
  return changed ? out : null;
}

function emptyChanges<T>(): Changes<T> {
  return { insert: [], update: [], archive: [] };
}

/** Cập nhật mục đã có (kèm khôi phục nếu đang bị gỡ) hoặc trả về null nếu không đổi. */
function upsert<T extends { id: string; archivedAt?: Date | null }>(
  changes: Changes<T>,
  existing: T,
  wanted: Partial<T>,
  label: string,
) {
  const restored = existing.archivedAt != null;
  const values = diff(existing, restored ? { ...wanted, archivedAt: null } : wanted);
  if (values) changes.update.push({ id: existing.id, values, label, restored });
}

export async function planSync(
  tree: ContentTree,
  snap: DbSnapshot,
  options: SyncOptions = {},
): Promise<SyncPlan> {
  const newId = options.newId ?? (() => crypto.randomUUID());
  const plan: SyncPlan = {
    deleteCourses: [],
    courses: emptyChanges(),
    units: emptyChanges(),
    lessons: emptyChanges(),
    exercises: emptyChanges(),
    vocabulary: emptyChanges(),
    links: [],
    issues: [],
    summary: {} as SyncPlan["summary"],
    isEmpty: true,
  };

  for (const course of tree.courses) {
    let dbCourse = snap.courses.find((c) => c.slug === course.key);
    let dbUnits = dbCourse ? snap.units.filter((u) => u.courseId === dbCourse!.id) : [];
    const unitIds = new Set(dbUnits.map((u) => u.id));
    let dbLessons = snap.lessons.filter((l) => unitIds.has(l.unitId));

    // Khóa tạo trước quy trình file (seed cũ): chưa có khóa nhận diện
    const legacy = dbUnits.some((u) => u.key === null) || dbLessons.some((l) => l.contentKey === null);
    if (dbCourse && legacy) {
      if (!options.replaceLegacy) {
        plan.issues.push({
          severity: "error",
          code: "legacy_course",
          file: course.file,
          line: 1,
          message: `Khóa "${course.key}" trong database được tạo trước quy trình nội dung dạng file (unit hoặc bài chưa có mã). Chạy lại với --replace-legacy để xóa khóa cũ (kể cả lượt học của khóa đó) và tạo lại từ file.`,
        });
        continue;
      }
      plan.deleteCourses.push({ id: dbCourse.id, slug: dbCourse.slug });
      dbCourse = undefined;
      dbUnits = [];
      dbLessons = [];
    }

    const voice = course.ttsVoice ?? null;

    // Khóa học: published chỉ đặt khi tạo mới (FR-015)
    const courseValues = {
      title: course.title,
      description: course.description ?? null,
      level: course.level,
      audience: course.audience,
      ttsVoice: voice,
    };
    let courseId: string;
    if (dbCourse) {
      courseId = dbCourse.id;
      const values = diff(dbCourse, courseValues);
      if (values) plan.courses.update.push({ id: courseId, values, label: course.key, restored: false });
    } else {
      courseId = newId();
      plan.courses.insert.push({ id: courseId, slug: course.key, published: course.published, ...courseValues });
    }

    // Unit
    const unitIdByKey = new Map<string, string>();
    course.units.forEach((unit, i) => {
      const label = `${course.key}/${unit.key}`;
      const wanted = { title: unit.title, description: unit.description ?? null, sortOrder: i + 1 };
      const existing = dbUnits.find((u) => u.key === unit.key);
      if (existing) {
        unitIdByKey.set(unit.key, existing.id);
        upsert(plan.units, existing, wanted, label);
      } else {
        const id = newId();
        unitIdByKey.set(unit.key, id);
        plan.units.insert.push({ id, courseId, key: unit.key, archivedAt: null, ...wanted });
      }
    });
    for (const u of dbUnits) {
      if (u.archivedAt === null && !unitIdByKey.has(u.key ?? "")) {
        plan.units.archive.push({ id: u.id, label: `${course.key}/${u.key}` });
      }
    }

    // Bài: nhận diện bằng "<khóa>/<bài>", không đổi khi chuyển unit
    const lessonIdByKey = new Map<string, string>();
    const exerciseRefs: { id: string; ex: (typeof course.units)[number]["lessons"][number]["exercises"][number]; label: string }[] = [];
    for (const unit of course.units) {
      for (const [i, lesson] of unit.lessons.entries()) {
        const contentKey = `${course.key}/${lesson.key}`;
        const wanted = {
          unitId: unitIdByKey.get(unit.key)!,
          title: lesson.title,
          xpReward: lesson.xp,
          sortOrder: i + 1,
          sourcePath: lesson.file,
        };
        const existing = dbLessons.find((l) => l.contentKey === contentKey);
        let lessonId: string;
        if (existing) {
          lessonId = existing.id;
          upsert(plan.lessons, existing, wanted, contentKey);
        } else {
          lessonId = newId();
          plan.lessons.insert.push({
            id: lessonId,
            contentKey,
            published: lesson.published,
            archivedAt: null,
            ...wanted,
          });
        }
        lessonIdByKey.set(contentKey, lessonId);

        // Câu hỏi
        const dbExercises = existing ? snap.exercises.filter((e) => e.lessonId === existing.id) : [];
        const seen = new Set<string>();
        for (const [j, ex] of lesson.exercises.entries()) {
          const label = `${contentKey}#${ex.key}`;
          const wantedEx = {
            lessonId,
            key: ex.key,
            sortOrder: j + 1,
            type: ex.data.type,
            prompt: ex.prompt,
            data: ex.data,
            explanation: ex.explanation ?? null,
            imageUrl: ex.image ?? null,
            aiGenerated: ex.aiGenerated,
          };
          const old = dbExercises.find((e) => e.key === ex.key);
          seen.add(ex.key);
          if (old) {
            // Văn bản đọc hoặc giọng đổi → bỏ âm thanh cũ để sinh lại (FR-017)
            const text = audioText(ex.data);
            const expected = voice && text ? await audioHash(voice, text) : null;
            const audioReset =
              old.audioHash !== null && old.audioHash !== expected ? { audioUrl: null, audioHash: null } : {};
            upsert(plan.exercises, old, { ...wantedEx, ...audioReset }, label);
            exerciseRefs.push({ id: old.id, ex, label });
          } else {
            const id = newId();
            plan.exercises.insert.push({ id, audioUrl: null, audioHash: null, archivedAt: null, ...wantedEx });
            exerciseRefs.push({ id, ex, label });
          }
        }
        for (const e of dbExercises) {
          if (e.archivedAt === null && !seen.has(e.key ?? "")) {
            plan.exercises.archive.push({ id: e.id, label: `${contentKey}#${e.key}` });
          }
        }
      }
    }
    for (const l of dbLessons) {
      if (l.archivedAt === null && !lessonIdByKey.has(l.contentKey ?? "")) {
        plan.lessons.archive.push({ id: l.id, label: l.contentKey ?? l.id });
      }
    }

    // Từ vựng: nhận diện bằng normalize(word) trong khóa
    const dbVocab = dbCourse ? snap.vocabulary.filter((v) => v.courseId === dbCourse!.id) : [];
    const vocabRefs: VocabRef[] = [];
    const seenWords = new Set<string>();
    for (const unit of course.units) {
      for (const [i, v] of unit.vocabulary.entries()) {
        const wordKey = normalize(v.word);
        if (seenWords.has(wordKey)) continue;
        seenWords.add(wordKey);
        const label = `${course.key}: ${v.word}`;
        const wanted = {
          courseId,
          unitId: unitIdByKey.get(unit.key)!,
          word: v.word,
          wordKey,
          meaningVi: v.meaning,
          example: v.example ?? null,
          forms: v.forms,
          sortOrder: i + 1,
        };
        const old = dbVocab.find((x) => x.wordKey === wordKey);
        if (old) {
          const expected = voice ? await audioHash(voice, v.word) : null;
          const audioReset =
            old.audioHash !== null && old.audioHash !== expected ? { audioUrl: null, audioHash: null } : {};
          upsert(plan.vocabulary, old, { ...wanted, ...audioReset }, label);
          vocabRefs.push({ id: old.id, wordKey, forms: v.forms });
        } else {
          const id = newId();
          plan.vocabulary.insert.push({ id, audioUrl: null, audioHash: null, archivedAt: null, ...wanted });
          vocabRefs.push({ id, wordKey, forms: v.forms });
        }
      }
    }
    for (const v of dbVocab) {
      if (v.archivedAt === null && !seenWords.has(v.wordKey)) {
        plan.vocabulary.archive.push({ id: v.id, label: `${course.key}: ${v.word}` });
      }
    }

    // Liên kết câu ↔ từ: tính lại cho mọi câu của khóa, để từ mới thêm cũng nối với câu cũ
    for (const { id, ex, label } of exerciseRefs) {
      const wanted = linkWords(ex, vocabRefs).sort();
      const current = snap.links
        .filter((l) => l.exerciseId === id)
        .map((l) => l.vocabularyId)
        .sort();
      if (canonical(wanted) !== canonical(current)) plan.links.push({ exerciseId: id, vocabularyIds: wanted, label });
    }
  }

  // Khóa trong DB mà thư mục nội dung không có: không động tới, chỉ cảnh báo
  const slugs = new Set(tree.courses.map((c) => c.key));
  for (const c of snap.courses) {
    if (!slugs.has(c.slug)) {
      plan.issues.push({
        severity: "warning",
        code: "orphan_course",
        file: "content/",
        message: `Khóa "${c.slug}" có trong database nhưng không có trong thư mục nội dung; import không động tới khóa này.`,
      });
    }
  }

  const count = <T>(c: Changes<T>): Counts => ({
    added: c.insert.length,
    updated: c.update.filter((u) => !u.restored).length,
    archived: c.archive.length,
    restored: c.update.filter((u) => u.restored).length,
  });
  plan.summary = {
    courses: count(plan.courses),
    units: count(plan.units),
    lessons: count(plan.lessons),
    exercises: count(plan.exercises),
    vocabulary: count(plan.vocabulary),
    links: { added: 0, updated: plan.links.length, archived: 0, restored: 0 },
  };
  plan.isEmpty =
    plan.deleteCourses.length === 0 &&
    Object.values(plan.summary).every((c) => c.added + c.updated + c.archived + c.restored === 0);
  return plan;
}
