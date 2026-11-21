import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { getUser } from "@/lib/auth";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

const features = [
  { icon: "🎯", title: "Bài ngắn 5 phút", text: "Chọn hình, nghe, xếp câu, ghép cặp: học như chơi." },
  { icon: "🔥", title: "Streak và XP", text: "Giữ chuỗi ngày học, nhận điểm kinh nghiệm mỗi bài." },
  { icon: "🤖", title: "AI giải thích lỗi", text: "Sai ở đâu, AI giải thích ngắn gọn bằng tiếng Việt." },
];

export default async function Home() {
  const user = await getUser();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4">
      <header className="flex items-center justify-between py-5">
        <span className="text-2xl font-extrabold text-primary">{site.name}</span>
        <Link href={user ? "/learn" : "/login"} className={buttonVariants({ variant: "ghost" })}>
          {user ? "Vào học" : "Đăng nhập"}
        </Link>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center gap-6 py-16 text-center">
        <div className="text-7xl" aria-hidden>
          🦊
        </div>
        <h1 className="max-w-2xl text-4xl font-extrabold tracking-tight sm:text-5xl">{site.tagline}</h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          Lộ trình từ con số 0, bài học ngắn, có âm thanh và phản hồi ngay. Miễn phí.
        </p>
        <div className="flex w-full max-w-sm flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href={user ? "/learn" : "/login"}
            className={cn(buttonVariants({ size: "lg" }), "h-12 px-6 text-base font-bold")}
          >
            Bắt đầu học
          </Link>
          <Link
            href="/try"
            className={cn(buttonVariants({ size: "lg", variant: "outline" }), "h-12 px-6 text-base font-bold")}
          >
            Thử 1 bài, không cần đăng ký
          </Link>
        </div>
      </section>

      <section className="grid gap-4 pb-16 sm:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="rounded-2xl border p-5">
            <div className="text-3xl" aria-hidden>
              {f.icon}
            </div>
            <h2 className="mt-2 font-bold">{f.title}</h2>
            <p className="text-sm text-muted-foreground">{f.text}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
