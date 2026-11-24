"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { courses, lessons } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";

/**
 * Trang quản trị chỉ còn bật/tắt xuất bản. Nội dung bài học sửa trong file content/
 * rồi chạy `npm run content:import` (constitution, Nguyên tắc IV).
 */
export async function togglePublished(kind: "course" | "lesson", id: string, published: boolean) {
  await requireAdmin();
  if (kind === "course") await db.update(courses).set({ published }).where(eq(courses.id, id));
  else await db.update(lessons).set({ published }).where(eq(lessons.id, id));
  revalidatePath("/admin", "layout");
  revalidatePath("/learn");
}
