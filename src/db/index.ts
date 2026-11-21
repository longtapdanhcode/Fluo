import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pg?: ReturnType<typeof postgres> };

function client() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Thiếu DATABASE_URL trong .env.local");
  // prepare: false để chạy được qua connection pooler (Supavisor, transaction mode).
  return postgres(url, { prepare: false, max: 5, connect_timeout: 10, idle_timeout: 20 });
}

const pg = globalForDb.pg ?? client();
if (process.env.NODE_ENV !== "production") globalForDb.pg = pg;

/** Truy cập DB phía server. Kết nối bằng role postgres nên bỏ qua RLS: luôn tự lọc theo profile. */
export const db = drizzle(pg, { schema, casing: "snake_case" });
