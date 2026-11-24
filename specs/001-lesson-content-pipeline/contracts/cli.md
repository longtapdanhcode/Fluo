# Contract: Lệnh dòng lệnh

Mọi lệnh chạy bằng `tsx --conditions=react-server` (research R2), đọc `.env.local`, in thông báo bằng tiếng Việt.
Mã thoát: `0` thành công · `1` có lỗi kiểm tra hoặc lỗi chạy · `2` sai tham số.

## `npm run content:check [-- --dir content]`

- Đọc toàn bộ thư mục, chạy mọi quy tắc kiểm tra. **Không** kết nối DB.
- In lỗi theo nhóm file, mỗi dòng có dạng `file:dòng  [mã lỗi]  câu #n (id)  mô tả`. Sau đó in cảnh báo và số từ ngoại lệ đang dùng.
- Dòng cuối: `✓ Không có lỗi · N khóa, N unit, N bài, N câu, N từ` hoặc `✗ N lỗi, N cảnh báo`.

## `npm run content:import [-- --dry-run] [--yes] [--replace-legacy]`

1. Chạy kiểm tra như `content:check`. Có lỗi thì lưu báo cáo (`outcome=blocked`) và thoát `1`.
2. Đọc ảnh chụp DB, tính `SyncPlan`.
3. In `Đích: <host DB>`, rồi in tóm tắt thêm / sửa / gỡ / khôi phục theo loại và danh sách bài bị gỡ.
4. Không có thay đổi: lưu báo cáo `no_changes`, thoát `0`, không hỏi.
5. Có `--dry-run`: lưu báo cáo `dry_run` và thoát `0`. Nếu không có `--yes`, hỏi `Ghi vào database? (y/N)`; từ chối thì lưu báo cáo `cancelled` và thoát `0`.
6. Áp dụng trong một transaction. Thành công thì lưu báo cáo `imported`; lỗi giữa chừng thì rollback, in lỗi và thoát `1`.
- Khóa trong DB có unit hoặc bài thiếu `key` gây lỗi `legacy_course`. Thêm `--replace-legacy` thì xóa khóa đó rồi tạo lại; lệnh này luôn hỏi xác nhận riêng, kể cả khi có `--yes`.

## Skill Claude Code `/soan-bai <khóa> <unit> "<chủ đề>" <từ 1, từ 2, …>` (thay `content:draft`, cập nhật 2026-11-23)

Định nghĩa ở `.claude/skills/soan-bai/SKILL.md`. Không gọi API trả phí, không ghi DB.
- Đọc `course.yaml`, `unit.yaml` của unit đích và các unit trước (từ đã học), cùng `contracts/content-format.md`.
- Từ trọng tâm chưa có thì thêm vào `vocabulary` của `unit.yaml` đích (kèm nghĩa) và báo cho người soạn.
- Ghi `<unit-dir>/<NN>-<lesson-id>.yaml`. Không ghi đè file có sẵn trừ khi người soạn bảo.
- Bài có `published: false`, mọi câu có `aiGenerated: true`.
- Thêm `lesson-id` vào cuối `unit.yaml > lessons`, giữ ghi chú.
- Chạy `npm run content:check`, sửa đến khi sạch, rồi báo đường dẫn file và các bước tiếp theo (diff → import → audio → xuất bản).

## `npm run content:audio [-- --course <id>] [--dry-run] [--limit N]`

- Sinh giọng bằng Kokoro-82M chạy trên máy (research R3). Lần đầu tải mô hình vào cache, sau đó chạy offline.
- Thiếu `SUPABASE_SECRET_KEY`: báo lỗi, thoát `1`.
- Gom các mục cần âm thanh: câu `listen_select` / `listen_type` và từ vựng chưa gỡ, có `audio_url` null hoặc `audio_hash` khác hash hiện tại. Các mục cùng hash chỉ sinh một lần.
- Mỗi mục: sinh mp3 (24 kHz mono 48 kbps), upload `lesson-audio/<course>/<hash>.mp3`, rồi cập nhật `audio_url` và `audio_hash` của mọi dòng cùng hash. Không cần giãn cách.
- Giọng không có trong Kokoro thì mục đó lỗi, kèm danh sách giọng hợp lệ.
- In tiến độ và tổng kết `đã sinh / bỏ qua / lỗi`. Thoát `1` nếu có mục lỗi; chạy lại sẽ tiếp tục phần còn thiếu.

## `npm run content:audio -- --sample "<câu>" [--voice af_heart]`

- Nghe thử: sinh một file `tmp-audio/<giọng>-<thời điểm>.mp3`. Không cần khóa, không ghi Storage hay DB. Dùng để chọn `ttsVoice` cho khóa.

## Biến môi trường mới (`.env.example`)

| Biến | Dùng ở | Ghi chú |
|---|---|---|
| `SUPABASE_SECRET_KEY` | `content:audio` | Khóa `sb_secret_…`, chỉ dùng trong script, không bao giờ `NEXT_PUBLIC_` |

## Trang quản trị (UI)

| Route | Nội dung |
|---|---|
| `/admin` | Cây khóa → unit → bài (bỏ mục đã gỡ, ghi số mục đã gỡ). Mỗi bài có: số câu, số câu AI, số câu có âm thanh, `source_path`, nút xuất bản, link xem trước. Khóa có nút xuất bản. Có khung "Kiểm tra gần nhất" đọc `content_reports` mới nhất |
| `/admin/lessons/[id]` | Danh sách câu chỉ đọc (dạng, đề, đáp án, giải thích, cờ AI, có âm thanh hay không) kèm đường dẫn file |
| `/admin/lessons/[id]/preview` | `LessonPlayer` ở chế độ `preview`: như `trial`, không ghi gì, nút thoát về `/admin/lessons/[id]` |

Bỏ: các form tạo khóa, unit, bài, câu; `saveExercise`, `createCourse`, `createUnit`, `createLesson` và action AI tạo nháp. Giữ: `togglePublished`. Mọi route qua `requireAdmin`.
