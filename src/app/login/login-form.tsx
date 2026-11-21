"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const redirectTo = () =>
    `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo() },
    });
    setStatus(error ? "error" : "sent");
  }

  async function google() {
    await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo() },
    });
  }

  if (status === "sent") {
    return (
      <div className="rounded-2xl bg-success-soft p-5 text-center">
        <div className="text-3xl" aria-hidden>
          📬
        </div>
        <p className="mt-2 font-bold">Đã gửi link đăng nhập tới {email}</p>
        <p className="text-sm text-muted-foreground">Mở email và bấm vào link để vào học.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Button variant="outline" className="h-11 font-bold" onClick={google}>
        Tiếp tục với Google
      </Button>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> hoặc <span className="h-px flex-1 bg-border" />
      </div>
      <form onSubmit={sendLink} className="flex flex-col gap-3">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          required
          autoComplete="email"
          placeholder="ban@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-11"
        />
        <Button type="submit" className="h-11 font-bold" disabled={status === "sending"}>
          {status === "sending" ? "Đang gửi…" : "Gửi link đăng nhập"}
        </Button>
        {status === "error" && (
          <p className="text-sm text-destructive">Không gửi được email. Kiểm tra lại địa chỉ hoặc thử lại sau.</p>
        )}
      </form>
    </div>
  );
}
