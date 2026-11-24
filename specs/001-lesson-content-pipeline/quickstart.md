# Quickstart: kiểm chứng tính năng 001

Các bước chứng minh tính năng chạy đúng từ đầu tới cuối. Định dạng file: [contracts/content-format.md](contracts/content-format.md). Lệnh: [contracts/cli.md](contracts/cli.md).

## Chuẩn bị

1. `.env.local` có `DATABASE_URL` và `SUPABASE_SECRET_KEY` (Supabase → Project Settings → API Keys). Không cần khóa AI hay TTS.
2. Có Claude Code mở trong repo (để soạn nháp ở bước 6).
3. Cài đặt và áp migration:

```bash
npm install
```

```bash
npm run db:migrate
```

## 1. Test đơn vị (US2, SC-004)

```bash
npm test
```

Kỳ vọng: mọi test trong `src/lib/content/` qua. Mỗi fixture trong `tests/fixtures/content/` (mỗi fixture một loại lỗi của FR-007) được báo đúng mã lỗi và đúng dòng; fixture `clean` không có lỗi.

## 2. Kiểm tra nội dung mẫu (SC-001, SC-007)

```bash
npm run content:check
```

Kỳ vọng: `✓ Không có lỗi · 1 khóa, 2 unit, 4 bài, …`, chạy dưới 10 giây.

## 3. Import lần đầu thay seed cũ (US1, R6)

```bash
npm run content:import -- --replace-legacy
```

Kỳ vọng: in host đích và tóm tắt, hỏi xác nhận. Sau khi đồng ý, `/admin` hiện 1 khóa, 2 unit, 4 bài. Tiếp theo, đăng nhập bằng tài khoản học viên, học xong bài "Xin chào!".

## 4. Chạy lại không trùng, giữ tiến độ (SC-002, SC-003)

```bash
npm run content:import
```

Kỳ vọng: `Không có thay đổi`, không hỏi.

Tiếp theo:
1. Sửa `explanation` của một câu trong `01-hello.yaml`, đổi tên file thành `01-xin-chao.yaml`, đảo thứ tự hai bài trong `unit.yaml`.
2. Chạy `npm run content:import -- --dry-run`. Kỳ vọng: tóm tắt có 1 câu sửa và 2 bài sửa thứ tự, DB không đổi.
3. Chạy `npm run content:import -- --yes`. Kỳ vọng: `/learn` vẫn đánh dấu "Xin chào!" là đã học.

## 5. Kiểm tra chặn lỗi (US2)

Thêm vào một bài ở unit 1 một câu chứa "grandmother" và bỏ `explanation`, rồi chạy:

```bash
npm run content:import
```

Kỳ vọng: 2 lỗi (`unknown_word`, `missing_explanation`) có file, dòng và id câu; DB không đổi; thoát mã 1; `/admin` hiện 2 lỗi đó trong khung "Kiểm tra gần nhất". Hoàn tác thay đổi trước khi sang bước sau.

## 6. AI soạn nháp (US4, SC-005)

Trong Claude Code:

```text
/soan-bai a1-starter greetings "Chào buổi sáng ở văn phòng" good morning, how, fine, thanks
```

Kỳ vọng: Claude Code báo đường dẫn file mới, các từ đã thêm vào vocabulary, và `content:check` sạch. Dùng `git diff` để thấy file bài mới và một dòng thêm trong `unit.yaml`. Sửa nếu có lỗi, rồi chạy `content:import`. Trong `/admin`, bài mới chưa xuất bản và các câu mang cờ AI. Xem trước, rồi bật xuất bản.

## 7. Âm thanh (US5, SC-006)

Nghe thử giọng trước (không cần khóa):

```bash
npm run content:audio -- --sample "Nice to meet you." --voice af_heart
```

Rồi sinh cho cả khóa:

```bash
npm run content:audio
```

Kỳ vọng: lần đầu tải mô hình Kokoro (vài phút), rồi sinh đủ âm thanh cho các câu nghe và từ vựng. Trong `/admin`, cột "có âm thanh" bằng số câu nghe. Học bài có câu nghe thì nghe giọng Kokoro. Chạy lại lệnh thì in `0 đã sinh`.

## 8. Trang quản trị (US6) và cổng chất lượng

- Kiểm tra bằng trình duyệt ở desktop và 375px:
  - `/admin`: cây bài, số liệu, khung kiểm tra gần nhất.
  - `/admin/lessons/[id]`: không còn ô sửa.
  - `/admin/lessons/[id]/preview`: chơi được, không cộng XP.
  - Tài khoản không phải admin bị chặn.
- Chạy cổng chất lượng:

```bash
npm run typecheck
```

```bash
npm run lint
```

```bash
npx next build
```

## Kết quả chạy lại (T063, 2026-11-24)

| Bước | Kết quả |
|---|---|
| 1. Test | 57/57 qua (6 file test). SC-004 đạt. |
| 2. `content:check` | Sạch: 1 khóa, 2 unit, 5 bài, 26 câu, 33 từ, 20 ms. Có 5 bài vì đã thêm bài nháp ở bước 6. |
| 3. Import thay seed cũ | Đã làm khi cài đặt 001, chỉ chạy một lần, không chạy lại. |
| 4. Chạy lại, giữ tiến độ | Import lại báo `Không có thay đổi` (SC-002). Đổi tên file `01-hello.yaml` → `01-xin-chao.yaml` chỉ làm 1 bài bị sửa, không thêm hay lưu trữ bài nào. T024 đã kiểm sửa đề, đổi tên bài, đảo thứ tự: lượt học xong bài "Xin chào!" vẫn còn, cùng id (SC-003). |
| 5. Chặn lỗi | Đủ 2 lỗi `missing_explanation` và `unknown_word`, có file, dòng, id câu; thoát mã 1; database không đổi. |
| 6. `/soan-bai` | Bài "Hỏi thăm sức khỏe": 8 câu, `content:check` sạch ngay lần đầu, import xong bài chưa xuất bản, 8 câu mang cờ AI; xem trước và bật/tắt xuất bản chạy đúng (T049, T057). |
| 7. Âm thanh | Bài mới: sinh 6 file (2 câu nghe, 4 từ), 0 lỗi; lần chạy thứ hai `0 đã sinh`, tổng 41 file (SC-006). |
| 8. Quản trị, cổng chất lượng | T057 đạt cả 4 ý. typecheck, lint, `next build` qua. |
| SC-007 | Khóa giả 4 unit × 8 bài, 326 câu: kiểm xong trong 44 ms (0,4 s cả khởi động). |
| SC-008 | Trang quản trị không còn ô sửa nội dung; nội dung chỉ sửa qua file trong git. |
