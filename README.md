# EngGo: web học tiếng Anh kiểu trò chơi

Next.js 16 + Supabase (Auth, Postgres) + Drizzle ORM + Tailwind/shadcn + Claude API.
Các quyết định sản phẩm nằm trong [DECISIONS.md](DECISIONS.md).

## Chạy lần đầu

1. **Tạo project Supabase** (miễn phí) tại supabase.com, chọn region Singapore.
2. Copy `.env.example` thành `.env.local` và điền:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: lấy ở Project Settings → API
   - `DATABASE_URL`: lấy ở Connect → **Transaction pooler** (cổng 6543)
   - `ADMIN_EMAILS`: email của bạn, để vào `/admin`
   - `ANTHROPIC_API_KEY`: tùy chọn, chỉ dùng cho AI giải thích lỗi cho học viên (tính phí theo lượt; không có thì app dùng lời giải soạn sẵn)
   - `SUPABASE_SECRET_KEY`: tùy chọn, chỉ cần khi sinh âm thanh (`content:audio`); lấy khóa `sb_secret_…` ở Supabase → Project Settings → API Keys.
     Giọng đọc sinh trên máy bằng Kokoro, miễn phí, không cần tài khoản.
3. Trong Supabase → Authentication → URL Configuration, thêm Redirect URL `http://localhost:3000/auth/callback`.
   Muốn đăng nhập Google thì bật provider Google ở Authentication → Providers.
4. Tạo bảng và dữ liệu mẫu:

   ```bash
   npm install
   npm run db:migrate
   npm run db:seed          # huy hiệu
   npm run content:import   # nạp nội dung từ content/ (hỏi xác nhận trước khi ghi)
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
    admin/                 Xem trước bài, bật/tắt xuất bản, xem báo cáo kiểm tra nội dung
    actions/lesson.ts      Nộp bài (chấm lại phía server, XP, streak, tim), AI giải thích lỗi
  components/lesson/       Lesson player và 6 dạng bài
  db/schema.ts             Schema Drizzle
  lib/
    exercises/             Kiểu dữ liệu từng dạng bài + hàm chấm (thuần, dùng lại được cho app mobile)
    content/               Đọc file nội dung, kiểm tra, tính kế hoạch đồng bộ (thuần, có unit test)
    game.ts                Luật XP, streak, hồi tim
    ai.ts                  Gọi Claude API
    content.ts, auth.ts    Truy vấn nội dung, phiên đăng nhập
  proxy.ts                 Làm mới phiên Supabase, chặn trang cần đăng nhập
content/                   Bản gốc nội dung bài học (YAML): <khóa>/<unit>/<bài>.yaml
drizzle/                   File migration SQL
scripts/                   Lệnh content:* (check, import, draft, audio) và seed huy hiệu
tests/fixtures/content/    Bộ nội dung mẫu, mỗi bộ một loại lỗi, cho unit test
```

## Ghi chú kỹ thuật

- **Truy cập DB chỉ từ server** qua Drizzle. Mọi bảng đã bật RLS và không có policy, nên publishable key không đọc/ghi được dữ liệu.
- **Chấm bài hai lần**: client chấm để phản hồi ngay, server chấm lại khi nộp để tính XP.
- **Âm thanh**: `npm run content:audio` sinh mp3 bằng Kokoro (mô hình mở chạy trên máy, miễn phí; lần đầu tải khoảng 300 MB) một lần, lưu bucket công khai `lesson-audio` và điền `audio_url`. Câu chưa có âm thanh thì dùng giọng đọc của trình duyệt.
- **Nội dung**: file trong `content/` là bản gốc duy nhất; không sửa nội dung trực tiếp trong DB. Import nhận diện mục bằng `id` trong file, mục bị xóa khỏi file chỉ được gỡ (`archived_at`) nên tiến độ học viên không mất.
- **Đổi schema**: sửa `src/db/schema.ts` → `npm run db:generate` → `npm run db:migrate`.
- **AI**: soạn nháp bài bằng skill `/soan-bai` trong Claude Code (không gọi API). AI giải thích lỗi cho học viên dùng `claude-opus-5-5`; đặt `AI_EXPLAIN_MODEL=claude-haiku-5-5` để giảm chi phí.

## Soạn nội dung

Định dạng file: [specs/001-lesson-content-pipeline/contracts/content-format.md](specs/001-lesson-content-pipeline/contracts/content-format.md).

1. Viết hoặc sửa file trong `content/<khóa>/<unit>/`, hoặc nhờ Claude Code soạn nháp:
   `/soan-bai a1-starter greetings "Chào buổi sáng" good morning, fine`.
   Skill ghi file bài, thêm từ mới vào `unit.yaml`, chạy `content:check` và tự sửa. Xem nháp bằng `git diff` và sửa.
2. `npm run content:check`: báo lỗi kèm file và dòng (sai định dạng, từ chưa học, câu trùng, nhiều đáp án, thiếu giải thích…).
   Từ chưa học nhưng cần dùng (tên món ăn…) thì khai báo `exceptions` kèm lý do trong câu.
3. `npm run content:import`: in database đích và tóm tắt thay đổi, hỏi xác nhận rồi ghi trong một transaction.
   `--dry-run` để chỉ xem tóm tắt.
4. `npm run content:audio`: sinh âm thanh cho câu nghe và từ vựng mới hoặc đã đổi.
   Nghe thử giọng trước: `npm run content:audio -- --sample "Nice to meet you." --voice af_bella` (file trong `tmp-audio/`); đổi giọng ở `ttsVoice` của `course.yaml`.
5. Vào `/admin` xem trước bài và bật xuất bản. Bài mới (và mọi nháp AI) mặc định ở trạng thái nháp.

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
| `npm run typecheck` / `npm run lint` | Kiểm tra code (cổng trước khi merge: thêm `npm test` và `next build`) |
| `npm run db:generate` | Sinh migration từ schema |
| `npm run db:migrate` | Áp migration vào DB |
| `npm run db:seed` | Tạo huy hiệu |
| `npm test` | Unit test (Vitest) |
| `npm run content:check` | Kiểm tra nội dung trong `content/`, không cần DB |
| `npm run content:import` | Đồng bộ nội dung vào DB (`--dry-run`, `--yes`, `--replace-legacy`) |
| `npm run content:audio` | Sinh âm thanh (Kokoro) cho câu nghe và từ vựng; `--sample` để nghe thử |
| `/soan-bai` (trong Claude Code) | Soạn nháp một bài thành file YAML |
| `npm run db:studio` | Xem dữ liệu trên trình duyệt |

## Chưa làm (theo DECISIONS.md)

Bài kiểm tra xếp lớp, trao huy hiệu (đã có bảng), chế độ Bé + dashboard phụ huynh, ôn tập ngắt quãng, luyện nói, PWA.
