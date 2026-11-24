/**
 * Tạo dữ liệu huy hiệu. Chạy: npm run db:seed (chạy lại nhiều lần không tạo trùng).
 *
 * Nội dung bài học KHÔNG nằm ở đây: bản gốc là file YAML trong content/,
 * nạp vào database bằng `npm run content:import` (constitution, Nguyên tắc IV).
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";

const badges = [
  { code: "first_lesson", title: "Bước đầu tiên", description: "Hoàn thành bài học đầu tiên", icon: "🌱" },
  { code: "perfect_lesson", title: "Hoàn hảo", description: "Hoàn thành một bài không sai câu nào", icon: "💯" },
  { code: "streak_7", title: "Một tuần chăm chỉ", description: "Giữ chuỗi 7 ngày", icon: "🔥" },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Thiếu DATABASE_URL trong .env.local");
  const pg = postgres(url, { prepare: false, max: 1 });
  const db = drizzle(pg, { schema, casing: "snake_case" });

  await db.insert(schema.badges).values(badges).onConflictDoNothing();
  console.log(`✓ Đã có ${badges.length} huy hiệu. Nội dung bài học: chạy npm run content:import.`);
  await pg.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
