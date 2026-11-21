/** Kiểm tra kết nối DATABASE_URL (không in mật khẩu). Chạy: npm run db:check */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Thiếu DATABASE_URL trong .env.local");
  try {
    const u = new URL(url);
    console.log(`URL hợp lệ · host ${u.hostname}:${u.port} · user ${u.username}`);
  } catch {
    console.log("✗ URL không đọc được. Mật khẩu có ký tự đặc biệt (@ # / ? %) thì phải mã hóa, ví dụ @ → %40.");
  }
  const sql = postgres(url, { prepare: false, max: 1, connect_timeout: 10 });
  try {
    const [r] = await sql`select count(*)::int as courses from courses`;
    console.log(`✓ Kết nối được · ${r.courses} khóa học`);
  } catch (e) {
    const err = e as { code?: string; message?: string };
    console.log(`✗ Lỗi: ${err.code ?? ""} ${err.message ?? e}`);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

main();
