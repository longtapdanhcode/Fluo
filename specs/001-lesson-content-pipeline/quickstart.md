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
