import Link from "next/link";
import { Suspense } from "react";
import Loading from "@/app/loading";
import { requireAdmin } from "@/lib/auth";
import { site } from "@/lib/site";

export const metadata = { title: "Quản trị" };

/** Kiểm tra quyền trong Suspense để layout không chặn render (Cache Components). */
async function AdminGate({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return children;
}

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/admin" className="font-extrabold">
            <span className="text-primary">{site.name}</span> · Soạn bài
          </Link>
          <Link href="/learn" className="text-sm text-muted-foreground hover:underline">
            Xem như học viên →
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <Suspense fallback={<Loading />}>
          <AdminGate>{children}</AdminGate>
        </Suspense>
      </main>
    </div>
  );
}
