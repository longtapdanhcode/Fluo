import Link from "next/link";
import { site } from "@/lib/site";
import { supabaseConfigured } from "@/lib/supabase/env";
import { LoginForm } from "./login-form";

export const metadata = { title: "Đăng nhập" };

export default async function LoginPage(props: PageProps<"/login">) {
  const { next, error } = await props.searchParams;
  const nextPath = typeof next === "string" && next.startsWith("/") ? next : "/learn";

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <Link href="/" className="text-center text-2xl font-extrabold text-primary">
        {site.name}
      </Link>
      <div className="text-center">
        <h1 className="text-2xl font-extrabold">Đăng nhập để lưu tiến độ</h1>
        <p className="mt-1 text-sm text-muted-foreground">Chưa có tài khoản? Nhập email, mình tạo luôn cho bạn.</p>
      </div>
      {error && (
        <p className="rounded-lg bg-danger-soft p-3 text-sm text-destructive">
          Đăng nhập không thành công. Thử lại nhé.
        </p>
      )}
      {supabaseConfigured ? (
        <LoginForm next={nextPath} />
      ) : (
        <p className="rounded-lg border p-4 text-sm text-muted-foreground">
          Chưa cấu hình Supabase. Điền <code>NEXT_PUBLIC_SUPABASE_URL</code> và{" "}
          <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> trong <code>.env.local</code> (xem README).
        </p>
      )}
    </main>
  );
}
