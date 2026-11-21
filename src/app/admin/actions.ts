"use server";

import { and, asc, eq, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { courses, exercises, lessons, units } from "@/db/schema";
import { aiConfigured, generateExercises } from "@/lib/ai";
import { requireAdmin } from "@/lib/auth";
import { exerciseData, type ExerciseType } from "@/lib/exercises/types";

export type ActionState = { ok?: string; error?: string } | null;

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function createCourse(_: ActionState, f: FormData): Promise<ActionState> {
  await requireAdmin();
  const title = str(f, "title");
  const slug = str(f, "slug") || title.toLowerCase().normalize("NFD").replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
  if (!title) return { error: "Cần nhập tên khóa học" };
  await db.insert(courses).values({ title, slug, level: (str(f, "level") || "a1") as "a1" });
  revalidatePath("/admin");
  return { ok: "Đã tạo khóa học" };
}

export async function createUnit(_: ActionState, f: FormData): Promise<ActionState> {
  await requireAdmin();
  const courseId = str(f, "courseId");
  const title = str(f, "title");
  if (!title) return { error: "Cần nhập tên unit" };
  const [{ m }] = await db.select({ m: max(units.sortOrder) }).from(units).where(eq(units.courseId, courseId));
  await db.insert(units).values({ courseId, title, description: str(f, "description") || null, sortOrder: (m ?? 0) + 1 });
  revalidatePath("/admin");
  return { ok: "Đã tạo unit" };
}

export async function createLesson(_: ActionState, f: FormData): Promise<ActionState> {
  await requireAdmin();
  const unitId = str(f, "unitId");
  const title = str(f, "title");
  if (!title) return { error: "Cần nhập tên bài" };
  const [{ m }] = await db.select({ m: max(lessons.sortOrder) }).from(lessons).where(eq(lessons.unitId, unitId));
  await db.insert(lessons).values({ unitId, title, sortOrder: (m ?? 0) + 1 });
  revalidatePath("/admin");
  return { ok: "Đã tạo bài" };
}

export async function togglePublished(kind: "course" | "lesson", id: string, published: boolean) {
  await requireAdmin();
  if (kind === "course") await db.update(courses).set({ published }).where(eq(courses.id, id));
  else await db.update(lessons).set({ published }).where(eq(lessons.id, id));
  revalidatePath("/admin", "layout");
  revalidatePath("/learn");
}

const exerciseForm = z.object({
  prompt: z.string().min(1, "Cần nhập đề bài"),
  explanation: z.string().optional(),
  audioUrl: z.string().url().or(z.literal("")).optional(),
  imageUrl: z.string().url().or(z.literal("")).optional(),
  data: z.string(),
});

/** Tạo mới (không có id) hoặc cập nhật một câu. `data` là JSON, kiểm bằng schema chặt. */
export async function saveExercise(_: ActionState, f: FormData): Promise<ActionState> {
  await requireAdmin();
  const lessonId = str(f, "lessonId");
  const id = str(f, "id");
  const form = exerciseForm.safeParse(Object.fromEntries(f));
  if (!form.success) return { error: form.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };

  let json: unknown;
  try {
    json = JSON.parse(form.data.data);
  } catch {
    return { error: "JSON không hợp lệ" };
  }
  const data = exerciseData.safeParse(json);
  if (!data.success) {
    const issue = data.error.issues[0];
    return { error: `Dữ liệu bài tập sai: ${issue?.path.join(".")} ${issue?.message}` };
  }

  const values = {
    prompt: form.data.prompt,
    explanation: form.data.explanation || null,
    audioUrl: form.data.audioUrl || null,
    imageUrl: form.data.imageUrl || null,
    type: data.data.type,
    data: data.data,
  };
  if (id) {
    await db.update(exercises).set(values).where(and(eq(exercises.id, id), eq(exercises.lessonId, lessonId)));
  } else {
    const [{ m }] = await db.select({ m: max(exercises.sortOrder) }).from(exercises).where(eq(exercises.lessonId, lessonId));
    await db.insert(exercises).values({ ...values, lessonId, sortOrder: (m ?? 0) + 1 });
  }
  revalidatePath(`/admin/lessons/${lessonId}`);
  return { ok: id ? "Đã lưu" : "Đã thêm câu mới" };
}

export async function deleteExercise(lessonId: string, id: string) {
  await requireAdmin();
  await db.delete(exercises).where(and(eq(exercises.id, id), eq(exercises.lessonId, lessonId)));
  revalidatePath(`/admin/lessons/${lessonId}`);
}

/** AI soạn nháp và thêm vào cuối bài. Bài vẫn ở trạng thái nháp cho tới khi bạn xuất bản. */
export async function generateDraft(_: ActionState, f: FormData): Promise<ActionState> {
  await requireAdmin();
  if (!aiConfigured) return { error: "Chưa có ANTHROPIC_API_KEY trong .env.local" };

  const lessonId = str(f, "lessonId");
  const topic = str(f, "topic");
  const count = Math.min(15, Math.max(1, Number(f.get("count")) || 8));
  const types = f.getAll("types").map(String) as ExerciseType[];
  if (!topic) return { error: "Cần nhập chủ đề" };
  if (types.length === 0) return { error: "Chọn ít nhất một dạng bài" };

  const lesson = await db.query.lessons.findFirst({ where: eq(lessons.id, lessonId) });
  if (!lesson) return { error: "Không tìm thấy bài" };
  const unit = await db.query.units.findFirst({ where: eq(units.id, lesson.unitId) });
  const course = unit && (await db.query.courses.findFirst({ where: eq(courses.id, unit.courseId) }));

  try {
    const { items, rejected } = await generateExercises({
      level: course?.level ?? "a1",
      unitTitle: unit?.title ?? "",
      lessonTitle: lesson.title,
      topic,
      count,
      types,
    });
    if (items.length === 0) return { error: "AI chưa tạo được câu hợp lệ, thử lại nhé." };

    const existing = await db
      .select({ s: exercises.sortOrder })
      .from(exercises)
      .where(eq(exercises.lessonId, lessonId))
      .orderBy(asc(exercises.sortOrder));
    const start = (existing.at(-1)?.s ?? 0) + 1;
    await db.insert(exercises).values(
      items.map((it, i) => ({
        lessonId,
        sortOrder: start + i,
        type: it.data.type,
        prompt: it.prompt,
        explanation: it.explanation,
        data: it.data,
        aiGenerated: true,
      })),
    );
    revalidatePath(`/admin/lessons/${lessonId}`);
    return {
      ok: `AI đã thêm ${items.length} câu${rejected ? ` (bỏ ${rejected} câu sai định dạng)` : ""}. Hãy duyệt lại trước khi xuất bản.`,
    };
  } catch (err) {
    console.error("generateDraft failed", err);
    return { error: err instanceof Error ? err.message : "AI gặp lỗi, thử lại sau." };
  }
}
