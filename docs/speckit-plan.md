# Kế hoạch làm việc với Spec Kit

Dùng file này để bắt đầu mỗi phiên mới. Mỗi tính năng đi trọn một vòng Spec Kit, trên một nhánh riêng, rồi mới sang tính năng tiếp theo.

## Bối cảnh cho phiên mới (dán cho Claude đọc trước)

> Dự án EngGo: web học tiếng Anh kiểu trò chơi cho người Việt, làm một mình. Đọc `DECISIONS.md`, `README.md`, `.specify/memory/constitution.md` và `docs/speckit-plan.md` trước khi làm.
> Stack: Next.js 16 (App Router, Cache Components), Supabase (Auth + Postgres), Drizzle, Tailwind v4 + shadcn, Claude API. Next 16 khác bản cũ: đọc `node_modules/next/dist/docs/` trước khi dùng API của Next.
> Thiết kế: người lớn và quản trị dùng **Hallmark** (theme Hum, token trong `src/app/home.css`); chế độ Bé dùng **taste-skill** (nhánh `design/taste`).
> Figma: https://www.figma.com/design/O4Gr7vf0UwWFXhAZ1w1PbZ (tài khoản sinh viên, chạy `whoami` để chắc chắn đúng tài khoản trước khi đọc). Trang "Người lớn · Hallmark", "Quản trị · Hallmark", "Chế độ Bé · taste-skill", "Design system".

## Trước khi bắt đầu phiên mới

- [ ] Commit `DECISIONS.md` (đang sửa dở) và push `main` (đang đi trước GitHub 1 commit).
- [ ] `npm run db:check` báo kết nối được Supabase.
- [ ] `npm run dev` chạy được, mở http://localhost:3000.

## Vòng làm một tính năng

Gõ lần lượt trong Claude Code, đọc kỹ kết quả từng bước rồi mới sang bước sau:

| Bước | Lệnh | Bạn cần làm |
|---|---|---|
| 0 | `git switch -c feat/<số>-<tên>` | Tạo nhánh từ `main` (Spec Kit chưa bật extension git nên không tự tạo nhánh) |
| 1 | `/speckit-specify <mô tả>` | Đọc `specs/<số>-<tên>/spec.md`: đúng ý chưa, thiếu gì |
| 2 | `/speckit-clarify` | Trả lời tối đa 5 câu hỏi để làm rõ |
| 3 | `/speckit-plan <ràng buộc kỹ thuật>` | Xem `plan.md`: mục Constitution Check không có vi phạm vô lý |
| 4 | `/speckit-tasks` | Xem `tasks.md`: các bước đủ nhỏ, đúng thứ tự |
| 5 | `/speckit-analyze` | Sửa nếu spec, plan, tasks lệch nhau |
| 6 | `/speckit-implement` | Theo dõi, chạy thử khi xong |
| 7 | `/speckit-converge` | Lặp 6–7 tới khi báo `Converged` |
| 8 | Cổng chất lượng | `npm run typecheck`, `npm run lint`, `npx next build`, chạy thử trên trình duyệt (desktop và 375px) |
| 9 | Gộp | Commit, gộp vào `main`, push. Cập nhật `DECISIONS.md` / `README.md` nếu tính năng thay đổi chúng |

Sửa lỗi nhỏ, chỉnh chữ, cập nhật dependency: làm thẳng, không cần vòng này.

---

## Lộ trình tính năng (làm theo thứ tự)

### 001 · Quy trình nội dung bài học

> **Trạng thái (2026-11-23)**: đã cài đặt trên nhánh `feat/001-content-pipeline` (spec, plan, tasks trong `specs/001-lesson-content-pipeline/`). Lệnh mới: `npm test`, `content:check`, `content:import`, `content:audio` (Kokoro, miễn phí) và skill `/soan-bai` trong Claude Code để soạn nháp; cách dùng ở mục "Soạn nội dung" của README.

Nền móng cho mọi nội dung sau này: nội dung lưu thành file trong repo, có kiểm tra tự động, AI soạn nháp, âm thanh TTS.

**`/speckit-specify`**
```text
Quy trình nội dung bài học cho EngGo (người lớn trước, chế độ Bé dùng lại sau). Nội dung khóa học được lưu thành file trong repo (mỗi bài một file trong content/<khóa>/<unit>/), là bản gốc duy nhất; một lệnh import đồng bộ file vào database Supabase, chạy lại nhiều lần không tạo trùng. Mỗi unit có danh sách từ vựng; thêm bảng từ vựng (từ, nghĩa tiếng Việt, ví dụ, âm thanh) và nối câu hỏi với các từ nó dùng, làm nền cho ôn tập ngắt quãng sau này. Lệnh import chặn và báo rõ lỗi khi: câu sai định dạng theo schema hiện có của 6 dạng bài, câu dùng từ chưa học (ngoài danh sách từ của unit đó và các unit trước), câu trùng, câu có nhiều hơn một đáp án đúng, thiếu lời giải thích. Có lệnh dùng AI soạn nháp một bài từ chủ đề và danh sách từ, ghi ra file để người duyệt bằng diff trước khi import. Có lệnh sinh âm thanh TTS một lần cho mọi câu cần nghe, lưu lên Supabase Storage và điền audio_url. Trang /admin chuyển sang vai trò xem trước, bật/tắt xuất bản và hiện lỗi kiểm tra; sửa nội dung làm trên file. Ngoài phạm vi: soạn nội dung thật của cả khóa A1 (tính năng 002), chế độ Bé.
```

**`/speckit-clarify`**: các điểm nên chốt: định dạng file (JSON hay YAML), nhà cung cấp TTS (Azure / Google), model AI cho lệnh soạn nháp, có cần file chuyển đổi khóa A1 mẫu hiện có sang định dạng mới không.

**`/speckit-plan`**
```text
Dùng stack hiện có: Next.js 16, Drizzle (đổi schema qua src/db/schema.ts → db:generate → db:migrate), Supabase Postgres + Storage, Zod (dùng lại src/lib/exercises/types.ts làm schema chuẩn), Claude API qua src/lib/ai.ts, script chạy bằng tsx trong scripts/. Logic kiểm tra nội dung là hàm thuần trong src/lib/content/ để test được. Thêm Vitest và unit test cho phần kiểm tra (gỡ TODO(TEST_RUNNER) trong constitution). Không thêm dịch vụ trả phí ngoài TTS; ghi lý do chọn nhà cung cấp TTS trong plan.
```

**Xong khi**: khóa A1 mẫu hiện có (4 bài) được chuyển thành file, import sạch, không lỗi kiểm tra; một bài mới tạo bằng AI đi qua đủ vòng nháp → duyệt → import → nghe được âm thanh; test chạy qua.

### 002 · Nội dung khóa A1 người lớn

Dùng quy trình 001 để dựng nội dung thật: mỗi bài soạn bằng `/soan-bai` trong Claude Code (hoặc tay) → `git diff` → `npm run content:check` → `npm run content:import` → `npm run content:audio` → xuất bản ở `/admin`.

**`/speckit-specify`**
```text
Nội dung khóa "Tiếng Anh A1: Khởi đầu" cho người lớn Việt Nam mới bắt đầu: 4 unit (Chào hỏi, Gia đình, Số đếm và thời gian, Ăn uống), mỗi unit 8 bài, mỗi bài 8–10 câu trộn đủ 6 dạng bài, khoảng 400 từ vựng theo trình độ CEFR A1. Câu tự nhiên, đúng ngữ pháp, mỗi câu chỉ có một đáp án đúng, có lời giải thích tiếng Việt và âm thanh. Bài sau chỉ dùng từ của bài đó và các bài trước. Không chép nội dung có bản quyền từ app hay giáo trình khác; nguồn mở (nếu dùng) phải ghi nguồn. Có một danh sách để giáo viên soát lần cuối.
```

**Xong khi**: 32 bài được import, không lỗi kiểm tra, đã chơi thử ít nhất 1 bài mỗi unit, có danh sách cho giáo viên soát.

### 003 · Đồng bộ giao diện app theo Figma (Hallmark)

Hiện chỉ trang chủ đã theo Hallmark; các màn khác vẫn là giao diện cũ.

**`/speckit-specify`**
```text
Làm lại giao diện các màn người lớn và quản trị theo thiết kế Hallmark (theme Hum) trong Figma, giữ nguyên toàn bộ logic, route và dữ liệu: đăng nhập (kèm trạng thái đã gửi email), lộ trình học, màn bài học với 6 dạng bài, phản hồi đúng/sai và AI giải thích, ôn lại câu sai, kết quả, hết tim, kết quả học thử, trang quản trị (danh sách khóa học, soạn bài). Dùng chung token của Hallmark (hiện ở src/app/home.css) cho mọi màn người lớn thay vì token riêng từng trang. Mọi màn dùng được ở 375px.
```

**`/speckit-plan`**: ghi rõ: đọc thiết kế bằng Figma MCP (`get_design_context` trên từng frame, load skill `figma-design-to-code` trước), chuyển token Hallmark từ `[data-theme="hum"]` thành token dùng chung cho cả nhóm route người lớn, giữ shadcn cho các thành phần có sẵn.

**Xong khi**: so ảnh chụp từng màn với frame Figma tương ứng, không màn nào còn giao diện cũ.

### 004 · Bài kiểm tra xếp lớp

```text
Bài kiểm tra xếp lớp khoảng 10 câu cho người lớn mới đăng ký, chạy ngay sau lần đăng nhập đầu tiên (bỏ qua được). Câu khó dần qua các unit của khóa A1; dựa trên kết quả, mở khóa sẵn tới unit phù hợp và ghi trình độ vào hồ sơ. Làm lại được trong trang hồ sơ.
```

### 005 · Huy hiệu và trang hồ sơ

```text
Trao huy hiệu khi đạt điều kiện (bài đầu tiên, bài không sai câu nào, chuỗi 7 ngày; bảng badges đã có) với thông báo khi nhận, và trang hồ sơ hiện tổng XP, lịch chuỗi ngày học, huy hiệu đã có, các bài đã học.
```

### 006 trở đi (spec sau, khi tới lượt)

- **Ôn tập ngắt quãng (FSRS)** dựa trên bảng từ vựng của 001.
- **Mục tiêu hằng ngày và nhắc học** (email / web push).
- **Chế độ Bé**: hồ sơ con, cổng phụ huynh, giao diện taste-skill lấy từ nhánh `design/taste`, nội dung riêng.
- **PWA**, **luyện nói**, **thanh toán**.

## Việc làm thẳng, không cần Spec Kit

- Deploy lên Vercel: biến môi trường, thêm domain vào Redirect URLs của Supabase, mã hóa ký tự `@` trong mật khẩu database thành `%40`.
- CI trên GitHub Actions: typecheck, lint, build mỗi lần push.
- Gỡ skill thiết kế không còn dùng nếu muốn gọn repo.
