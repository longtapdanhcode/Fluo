"use client";

import { useTransition } from "react";
import { cn } from "@/lib/utils";
import { togglePublished } from "./actions";

export function PublishToggle({
  kind,
  id,
  published,
}: {
  kind: "course" | "lesson";
  id: string;
  published: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => togglePublished(kind, id, !published))}
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-xs font-bold",
        published ? "bg-success-soft text-success" : "bg-muted text-muted-foreground",
      )}
      title="Bấm để đổi trạng thái"
    >
      {pending ? "…" : published ? "Đã xuất bản" : "Nháp"}
    </button>
  );
}
