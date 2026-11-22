# EngGo Constitution

Web học tiếng Anh kiểu trò chơi cho người Việt, phục vụ cả người lớn và trẻ em. Tài liệu này là
bộ quy tắc nền mà mọi spec, plan và task trong `.specify/` phải tuân theo. Từ khóa **BẮT BUỘC**
và **KHÔNG ĐƯỢC** là quy tắc cứng; **NÊN** là mặc định, chỉ được bỏ khi plan ghi rõ lý do.

## Core Principles

### I. Một codebase, hai đối tượng

- Sản phẩm là **một app với hai chế độ** (Người lớn / Bé), dùng chung backend và kho nội dung.
  **KHÔNG ĐƯỢC** tách thành hai app hay hai database riêng.
- Mọi dữ liệu học tập gắn với `profiles` (có `type: kid | adult`), không gắn trực tiếp với tài
  khoản đăng nhập. Một tài khoản có thể có nhiều hồ sơ.
- Tính năng mới **BẮT BUỘC** nêu rõ trong spec là dành cho chế độ nào. Ưu tiên hiện tại là người
  lớn; tính năng cho trẻ em **KHÔNG ĐƯỢC** làm thay đổi trải nghiệm người lớn và ngược lại.

Lý do: làm một mình, chỉ duy trì được một codebase; tách theo hồ sơ cho phép bán gói Family sau này.

### II. Server là nguồn sự thật

- Truy cập database **chỉ từ server** (Server Components, Server Actions, Route Handlers) qua
  Drizzle. Mọi bảng `public` bật RLS và không có policy; muốn mở truy cập từ client thì plan
  **BẮT BUỘC** thêm policy cụ thể và giải thích.
- Điểm số, XP, streak, tim, mở khóa bài **BẮT BUỘC** được tính lại ở server. Client chỉ chấm để
  phản hồi ngay; **KHÔNG ĐƯỢC** tin số liệu client gửi lên.
- Mọi truy vấn theo người dùng **BẮT BUỘC** lọc theo hồ sơ của phiên hiện tại (`requireProfile`);
  thao tác quản trị **BẮT BUỘC** qua `requireAdmin`.
- Bí mật (`DATABASE_URL`, `ANTHROPIC_API_KEY`, service key) **KHÔNG ĐƯỢC** có tiền tố
  `NEXT_PUBLIC_` và **KHÔNG ĐƯỢC** commit; `.env.local` luôn nằm ngoài git.

Lý do: Drizzle kết nối bằng role bỏ qua RLS, nên an toàn phụ thuộc hoàn toàn vào kỷ luật phía server.

### III. Logic học tập thuần, tách khỏi framework

- Luật chấm bài (`src/lib/exercises/`) và luật trò chơi (`src/lib/game.ts`) là **hàm thuần**:
  **KHÔNG ĐƯỢC** import Next.js, React, Supabase hay `@/db`. Đây là phần sẽ dùng lại cho app mobile.
- Mỗi dạng bài tập được định nghĩa một chỗ: schema Zod trong `types.ts` là chuẩn. Thêm dạng bài
  mới **BẮT BUỘC** cập nhật đủ: schema + `checkAnswer`/`correctAnswerText` + component trong
  `components/lesson/` + nhãn tiếng Việt + schema sinh bài của AI trong `lib/ai.ts`.
- Dữ liệu `exercises.data` (jsonb) **BẮT BUỘC** được kiểm bằng schema Zod trước khi ghi vào DB.

Lý do: logic thuần dễ test, dễ chuyển nền tảng, và một schema duy nhất tránh lệch giữa CMS, AI và player.

### IV. Nội dung dạng file, AI chỉ soạn nháp

- Bản gốc duy nhất của nội dung bài học là file YAML trong thư mục `content/` của repo. Nội dung
  **BẮT BUỘC** qua bộ kiểm tra tự động (`npm run content:check`) và chỉ vào database bằng
  `npm run content:import`. **KHÔNG ĐƯỢC** sửa nội dung bài học trực tiếp trong database.
- `/admin` dùng để xem trước, bật/tắt xuất bản và xem báo cáo kiểm tra; **KHÔNG ĐƯỢC** có chức năng
  sửa nội dung bài học.
- **KHÔNG ĐƯỢC** viết cứng nội dung bài học vào code; `scripts/seed.ts` chỉ chứa dữ liệu huy hiệu.
- Câu do AI tạo **BẮT BUỘC** đi qua schema chặt, được đánh dấu `ai_generated`, và chỉ đến với học
  viên sau khi người duyệt xuất bản bài.
- Tính năng AI hướng tới học viên **BẮT BUỘC** có đường lùi khi không có API key hoặc AI lỗi (ví dụ
  dùng lời giải soạn sẵn), và **NÊN** có giới hạn hoặc cache để kiểm soát chi phí.

Lý do: rủi ro lớn nhất của dự án là chất lượng và số lượng nội dung, không phải code. Nội dung dạng
file có lịch sử git, review được bằng diff và kiểm tra tự động trước khi tới học viên.

### V. An toàn cho trẻ em và quyền riêng tư

- Chế độ Bé **KHÔNG ĐƯỢC** có quảng cáo, chat giữa người dùng hay bảng xếp hạng công khai; tính
  năng cho trẻ **BẮT BUỘC** có cổng phụ huynh và sự đồng ý của phụ huynh khi thu dữ liệu.
- Chỉ thu dữ liệu cá nhân tối thiểu cần cho việc học. Spec có thu dữ liệu mới **BẮT BUỘC** nêu dữ
  liệu gì, để làm gì và ai xem được.
- Nội dung AI hiển thị cho trẻ **BẮT BUỘC** chạy theo kịch bản giới hạn, không hội thoại tự do.

Lý do: quy định bảo vệ dữ liệu cá nhân của Việt Nam (và COPPA nếu có người dùng Mỹ), và niềm tin
của phụ huynh là điều kiện để bán sản phẩm.

### VI. Đơn giản, hợp với một người làm

- Chọn giải pháp đơn giản nhất đáp ứng spec (YAGNI). Ưu tiên dịch vụ có sẵn (Supabase, Vercel) hơn
  tự vận hành.
- Thêm dependency hoặc dịch vụ trả phí mới **BẮT BUỘC** được nêu và biện minh trong plan.
- Mỗi feature **NÊN** đủ nhỏ để làm xong và kiểm chứng trong vài ngày; việc lớn phải chia nhỏ.

Lý do: chỉ có một người phát triển, nên chi phí duy trì quan trọng hơn sự linh hoạt lý thuyết.

## Ràng buộc kỹ thuật

- **Stack cố định**: Next.js 16 (App Router, Cache Components bật), TypeScript strict, Tailwind v4 +
  shadcn/ui (Base UI), Supabase (Auth + Postgres), Drizzle ORM, Zod, Claude API qua
  `@anthropic-ai/sdk`. Đổi stack là thay đổi constitution.
- **Next.js 16 khác bản cũ**: trước khi dùng API của Next **BẮT BUỘC** đọc hướng dẫn trong
  `node_modules/next/dist/docs/`. Dùng `proxy.ts` (không phải `middleware.ts`); `params`,
  `searchParams`, `cookies()` đều async; dữ liệu theo request phải nằm trong `<Suspense>` hoặc
  gọi `connection()`.
- **Database**: đổi schema chỉ qua `src/db/schema.ts` → `npm run db:generate` → `npm run db:migrate`.
  **KHÔNG ĐƯỢC** sửa tay migration đã sinh; SQL đặc biệt (RLS, FK sang `auth.users`) đặt trong
  custom migration.
- **Thời gian**: "ngày" cho streak và mục tiêu tính theo `Asia/Ho_Chi_Minh`.
- **Giao diện**: chữ trên UI bằng tiếng Việt; nội dung học bằng tiếng Anh. Mọi màn hình **BẮT
  BUỘC** dùng được ở chiều rộng 375px, không cuộn ngang.
- **AI**: model mặc định `claude-opus-5-5`, đổi qua biến môi trường `AI_MODEL` / `AI_EXPLAIN_MODEL`.

## Quy trình và cổng chất lượng

- **Khi nào dùng Spec Kit**: tính năng mới hoặc thay đổi hành vi người dùng thấy đi theo
  `/speckit-specify` → (`/speckit-clarify`) → `/speckit-plan` → `/speckit-tasks` →
  `/speckit-implement` → `/speckit-converge`. Sửa lỗi nhỏ, chỉnh chữ, cập nhật dependency có thể
  làm trực tiếp.
- **Nhánh**: làm trên nhánh riêng, không commit thẳng vào `main`.
- **Cổng trước khi merge** (tất cả **BẮT BUỘC** qua): `npm test`, `npm run typecheck`,
  `npm run lint`, `next build`. Thay đổi giao diện **BẮT BUỘC** được chạy thử trong trình duyệt, cả desktop và mobile.
- **Test**: dùng Vitest (`npm test`). Thay đổi logic thuần (Nguyên tắc III), gồm cả bộ kiểm tra
  nội dung trong `src/lib/content/`, **BẮT BUỘC** kèm unit test.
- **Tài liệu**: quyết định sản phẩm ghi trong `DECISIONS.md`; cách chạy và cấu trúc trong
  `README.md`. Feature làm thay đổi một trong hai thì cập nhật cùng lúc.

## Governance

- Constitution này đứng trên mọi tài liệu và thói quen khác trong repo. `DECISIONS.md` ghi các lựa
  chọn sản phẩm cụ thể và **KHÔNG ĐƯỢC** mâu thuẫn với constitution; nếu mâu thuẫn, sửa một trong
  hai trong cùng một thay đổi.
- Mục "Constitution Check" của mỗi plan **BẮT BUỘC** liệt kê mọi vi phạm kèm lý do và phương án đơn
  giản hơn đã cân nhắc. Vi phạm không có lý do thì plan không được duyệt.
- Sửa constitution qua `/speckit-constitution`, kèm Sync Impact Report. Phiên bản theo semver:
  MAJOR khi bỏ hoặc định nghĩa lại nguyên tắc; MINOR khi thêm nguyên tắc hoặc mở rộng đáng kể;
  PATCH khi chỉ làm rõ câu chữ.
- Rà soát constitution khi kết thúc mỗi giai đoạn của lộ trình (MVP, thử nghiệm, chế độ Bé).

**Version**: 1.1.0 | **Ratified**: 2026-11-21 | **Last Amended**: 2026-11-22
