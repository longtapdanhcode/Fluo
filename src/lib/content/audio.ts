import type { ExerciseData } from "@/lib/exercises/types";

/** Văn bản cần đọc của một câu hỏi; null nếu dạng bài không cần âm thanh. */
export function audioText(data: ExerciseData): string | null {
  return data.type === "listen_select" || data.type === "listen_type" ? data.audioText : null;
}

/**
 * sha256(giọng + "\n" + văn bản) dạng hex. Dùng Web Crypto (có trên Node 20+ và trình duyệt)
 * để giữ thuần, dùng lại được cho app mobile.
 */
export async function audioHash(voice: string, text: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${voice}\n${text}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
