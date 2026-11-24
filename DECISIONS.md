# Quyết định dự án — Web học tiếng Anh

_Cập nhật: 2026-11-22 · Làm một mình_

## Sản phẩm

| Hạng mục | Quyết định | Ghi chú |
|---|---|---|
| Mô hình | **1 app, 2 chế độ (Bé / Người lớn)** | Chung backend và kho nội dung; giao diện đổi theo loại hồ sơ |
| Đối tượng MVP | **Người lớn trước** | Chế độ Bé làm ở giai đoạn 2, nhưng schema có sẵn `profile.type = kid \| adult` ngay từ đầu |
| Kiếm tiền | **Chưa kiếm tiền** | Tập trung sản phẩm và người dùng; quyết định lại sau giai đoạn thử nghiệm |
| Tên miền | **Chọn sau** | Phát triển trên domain mặc định của Vercel |

## Kỹ thuật

| Hạng mục | Quyết định | Ghi chú |
|---|---|---|
| Tech stack | **Next.js + Supabase**, deploy Vercel | Postgres + Auth + Storage của Supabase; Tailwind + shadcn/ui; Drizzle ORM |
| Luyện nói | **Chưa làm trong MVP** | MVP chỉ nghe / đọc / viết |
| AI | **Soạn nháp bài** bằng skill `/soan-bai` trong Claude Code (ghi ra file YAML, người duyệt bằng diff; không gọi API nên không tốn phí theo lượt) + **Giải thích lỗi sai** cho học viên | Giải thích lỗi dùng Claude API (tùy chọn), mặc định `claude-opus-5-5`, đổi qua `AI_EXPLAIN_MODEL` (ví dụ Haiku để tiết kiệm); không có khóa thì dùng lời giải soạn sẵn |
| Nội dung | **File YAML trong `content/` là bản gốc** | Kiểm tra tự động (`content:check`), đồng bộ bằng `content:import`; `/admin` chỉ xem trước và xuất bản. Xem tính năng 001 |
| Audio | **Kokoro-82M** (mô hình mở Apache-2.0, chạy trên máy người soạn, miễn phí), sinh sẵn bằng `content:audio`, lưu bucket công khai `lesson-audio` | Giọng mặc định `af_heart`. Không gọi TTS lúc học viên học; chưa có âm thanh thì dùng giọng trình duyệt. Ban đầu chọn Azure Speech nhưng không đăng ký được (2026-11-23) |

## Dạng bài tập MVP

1. Chọn đáp án / chọn hình
2. Nghe rồi chọn / gõ lại câu vừa nghe
3. Xếp từ thành câu
4. Ghép cặp + điền chỗ trống

## Phạm vi MVP

- Đăng nhập (email, Google), hồ sơ người lớn
- Bài kiểm tra xếp lớp ngắn
- Lộ trình Khóa → Unit → Bài → Câu hỏi, 1 khóa A1 khoảng 3 unit
- XP, streak, tim, huy hiệu
- Nội dung dạng file có kiểm tra tự động, AI soạn nháp ra file (thay cho CMS soạn trực tiếp)
- AI giải thích khi trả lời sai

## Thiết kế

| Hạng mục | Quyết định | Ghi chú |
|---|---|---|
| Giao diện chính (người lớn) | **Hallmark, theme Hum** | Giấy kem, thẻ chữ card-stock, vàng lê; token trong `src/app/home.css` trên `[data-theme="hum"]` |
| Giao diện chế độ Bé | **taste-skill, hướng One motif** | Trắng, xám, bạc hà, thẻ chữ bấm được; code nằm ở nhánh `design/taste`, dùng lại khi làm chế độ Bé |

## Để sau

- Chế độ Bé (giao diện riêng, cổng phụ huynh, dashboard phụ huynh)
- Luyện nói / chấm phát âm
- Ôn tập ngắt quãng (FSRS), league, PWA
- Hội thoại AI đóng vai, thanh toán, tên miền
