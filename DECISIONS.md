# Quyết định dự án — Web học tiếng Anh

_Cập nhật: 2026-11-21 · Làm một mình_

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
| AI | **Sinh nội dung bài** (trong CMS, người duyệt lại) + **Giải thích lỗi sai** | Claude API, mặc định `claude-opus-5-5`; đổi model qua `AI_MODEL` / `AI_EXPLAIN_MODEL` (ví dụ Haiku cho phần giải thích lỗi để tiết kiệm) |
| Audio | TTS sinh sẵn khi soạn bài, lưu Supabase Storage | Không gọi TTS lúc học viên học |

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
- CMS soạn bài, có nút "AI tạo bản nháp"
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
