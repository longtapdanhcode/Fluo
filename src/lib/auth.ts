import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { db } from "@/db";
import { profiles, type Profile } from "@/db/schema";
import { currentHearts } from "@/lib/game";
import { supabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const getUser = cache(async () => {
  // Luôn phụ thuộc request (kể cả khi chưa cấu hình Supabase) để trang không bị prerender tĩnh.
  await connection();
  if (!supabaseConfigured) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
});

/** Người dùng hiện tại + hồ sơ người lớn (tự tạo ở lần đăng nhập đầu). */
export const requireProfile = cache(async (): Promise<Profile> => {
  const user = await getUser();
  if (!user) redirect("/login");

  // MVP: mỗi tài khoản dùng hồ sơ người lớn. Giai đoạn 2 thêm chọn hồ sơ con (cookie active_profile).
  let profile = await db.query.profiles.findFirst({
    where: and(eq(profiles.accountId, user.id), eq(profiles.type, "adult")),
    orderBy: asc(profiles.createdAt),
  });

  if (!profile) {
    const name =
      (user.user_metadata?.full_name as string | undefined) ?? user.email?.split("@")[0] ?? "Bạn";
    [profile] = await db
      .insert(profiles)
      .values({ accountId: user.id, type: "adult", displayName: name })
      .returning();
  }

  const h = currentHearts(profile.hearts, profile.heartsUpdatedAt);
  return { ...profile, hearts: h.hearts, heartsUpdatedAt: h.updatedAt };
});

export function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

export async function requireAdmin() {
  const user = await getUser();
  if (!user) redirect("/login?next=/admin");
  if (!isAdminEmail(user.email)) redirect("/learn");
  return user;
}
