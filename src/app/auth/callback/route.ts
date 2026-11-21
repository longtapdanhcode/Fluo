import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Supabase chuyển về đây sau khi bấm link email hoặc đăng nhập Google. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/learn";
  // Chỉ cho phép đường dẫn nội bộ, tránh open redirect.
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/learn";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/login?error=1`);
}
