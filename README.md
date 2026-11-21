# EngGo: web học tiếng Anh kiểu trò chơi

Next.js 16 + Supabase (Auth, Postgres) + Drizzle ORM + Tailwind/shadcn + Claude API.
Các quyết định sản phẩm nằm trong [DECISIONS.md](DECISIONS.md).

## Chạy lần đầu

1. **Tạo project Supabase** (miễn phí) tại supabase.com, chọn region Singapore.
2. Copy `.env.example` thành `.env.local` và điền:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: lấy ở Project Settings → API
   - `DATABASE_URL`: lấy ở Connect → **Transaction pooler** (cổng 6543)
   - `ADMIN_EMAILS`: email của bạn, để vào `/admin`
   - `ANTHROPIC_API_KEY`: tùy chọn, dùng cho AI soạn bài và giải thích lỗi
3. Trong Supabase → Authentication → URL Configuration, thêm Redirect URL `http://localhost:3000/auth/callback`.
   Muốn đăng nhập Google thì bật provider Google ở Authentication → Providers.
4. Tạo bảng và dữ liệu mẫu:

   ```bash
   npm install
   npm run db:migrate
   npm run db:seed
   npm run dev
   ```

5. Mở http://localhost:3000. Vào `/try` để học thử không cần đăng nhập.

## Cấu trúc

```
src/
  app/
    page.tsx               Trang chủ
    login/                 Đăng nhập bằng link email hoặc Google
    auth/callback          Supabase chuyển về đây sau khi đăng nhập
    learn/                 Lộ trình học (unit → bài, mở khóa dần)
    lesson/[id]/           Màn chơi bài học
    try/                   Học thử cho khách, không lưu tiến độ
    admin/                 CMS soạn bài, có AI tạo nháp
    actions/lesson.ts      Nộp bài (chấm lại phía server, XP, streak, tim), AI giải thích lỗi
  components/lesson/       Lesson player và 6 dạng bài
  db/schema.ts             Schema Drizzle
  lib/
    exercises/             Kiểu dữ liệu từng dạng bài + hàm chấm (thuần, dùng lại được cho app mobile)
    game.ts                Luật XP, streak, hồi tim
    ai.ts                  Gọi Claude API
    content.ts, auth.ts    Truy vấn nội dung, phiên đăng nhập
  proxy.ts                 Làm mới phiên Supabase, chặn trang cần đăng nhập
drizzle/                   File migration SQL
scripts/seed.ts            Khóa A1 mẫu
```

## Ghi chú kỹ thuật

- **Truy cập DB chỉ từ server** qua Drizzle. Mọi bảng đã bật RLS và không có policy, nên publishable key không đọc/ghi được dữ liệu.
- **Chấm bài hai lần**: client chấm để phản hồi ngay, server chấm lại khi nộp để tính XP.
- **Âm thanh**: chưa có file audio thì dùng giọng đọc của trình duyệt. Sau này sinh TTS một lần rồi điền `audio_url`.
- **Đổi schema**: sửa `src/db/schema.ts` → `npm run db:generate` → `npm run db:migrate`.
- **Model AI** mặc định `claude-opus-5-5`. Đặt `AI_EXPLAIN_MODEL=claude-haiku-5-5` nếu muốn giảm chi phí phần giải thích lỗi.

## Quy trình phát triển (Spec Kit)

Dự án dùng [Spec Kit](https://github.com/github/spec-kit) để làm theo hướng "viết spec trước".
Quy tắc nền nằm trong [.specify/memory/constitution.md](.specify/memory/constitution.md).

Với mỗi tính năng mới, gõ lần lượt trong Claude Code, xem lại kết quả từng bước trước khi sang bước sau:

```text
/speckit-specify  Mô tả tính năng: làm gì, cho ai, vì sao
/speckit-clarify  (tùy chọn) trả lời câu hỏi để làm rõ spec
/speckit-plan     Dùng stack hiện tại của dự án
/speckit-tasks
/speckit-analyze  (tùy chọn) kiểm tra spec, plan, tasks có khớp nhau
/speckit-implement
/speckit-converge (lặp lại implement + converge tới khi báo Converged)
```

Spec của từng tính năng nằm trong `specs/<số>-<tên>/`. Sửa lỗi nhỏ thì không cần đi qua quy trình này.
Cập nhật Spec Kit: `uv tool upgrade specify-cli`, rồi `specify integration upgrade claude`.

## Lệnh

| Lệnh | Việc |
|---|---|
| `npm run dev` | Chạy local |
| `npm run typecheck` / `npm run lint` | Kiểm tra code |
| `npm run db:generate` | Sinh migration từ schema |
| `npm run db:migrate` | Áp migration vào DB |
| `npm run db:seed` | Tạo lại khóa A1 mẫu |
| `npm run db:studio` | Xem dữ liệu trên trình duyệt |

## Chưa làm (theo DECISIONS.md)

Bài kiểm tra xếp lớp, trao huy hiệu (đã có bảng), chế độ Bé + dashboard phụ huynh, ôn tập ngắt quãng, luyện nói, PWA.
