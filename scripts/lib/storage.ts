import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Bucket công khai chứa mp3 của bài học (research R4). Nội dung bài học không phải dữ liệu riêng tư. */
export const AUDIO_BUCKET = "lesson-audio";

/** Client Storage dùng secret key: chỉ dùng trong script trên máy người soạn, không bao giờ ở client. */
export function storageClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function ensureBucket(client: SupabaseClient) {
  const { data } = await client.storage.getBucket(AUDIO_BUCKET);
  if (data) return;
  const { error } = await client.storage.createBucket(AUDIO_BUCKET, {
    public: true,
    allowedMimeTypes: ["audio/mpeg"],
    fileSizeLimit: "2MB",
  });
  if (error && !/already exists/i.test(error.message)) throw new Error(`Không tạo được bucket: ${error.message}`);
}

/** Upload (ghi đè nếu đã có) và trả về URL công khai. */
export async function uploadMp3(client: SupabaseClient, path: string, bytes: Uint8Array): Promise<string> {
  const { error } = await client.storage
    .from(AUDIO_BUCKET)
    .upload(path, bytes, { contentType: "audio/mpeg", upsert: true, cacheControl: "31536000" });
  if (error) throw new Error(`Upload ${path} lỗi: ${error.message}`);
  return client.storage.from(AUDIO_BUCKET).getPublicUrl(path).data.publicUrl;
}
