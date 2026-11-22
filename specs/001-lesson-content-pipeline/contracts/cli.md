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

## `npm run content:draft -- --course <id> --unit <id> --topic "<chủ đề>" --words "<w1, w2, …>" [--id <lesson-id>] [--title "<tên>"] [--count 8] [--types multiple_choice,word_bank,…] [--force]`

- Thiếu `ANTHROPIC_API_KEY`: báo lỗi, thoát `1`, không ghi file.
- Từ trong `--words` chưa có trong `unit.yaml` được in ra làm gợi ý để thêm vào danh sách từ. Lệnh không tự sửa `unit.yaml`.
- Ghi vào `content/<course-dir>/<unit-dir>/<lesson-id>.yaml`. File đã có mà không có `--force` thì thoát `1`.
- Thêm `lesson-id` vào cuối `unit.yaml > lessons`, sửa đúng dòng đó, giữ ghi chú. Thay đổi này hiện trong diff.
- Sau khi ghi, chạy kiểm tra trên toàn khóa rồi in lỗi liên quan tới file mới. Có lỗi vẫn thoát `0` vì file nháp được giữ để sửa (FR-022).

## `npm run content:audio [-- --course <id>] [--dry-run] [--limit N]`

- Thiếu `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` hoặc `SUPABASE_SECRET_KEY`: báo lỗi, thoát `1`.
- Gom các mục cần âm thanh: câu `listen_select` / `listen_type` và từ vựng chưa gỡ, có `audio_url` null hoặc `audio_hash` khác hash hiện tại. Các mục cùng hash chỉ sinh một lần.
- Mỗi mục: gọi Azure, upload `lesson-audio/<course>/<hash>.mp3`, rồi cập nhật `audio_url` và `audio_hash` của mọi dòng cùng hash. Giãn cách theo giới hạn gói F0; gặp 429 thì chờ `Retry-After`.
- In tiến độ và tổng kết `đã sinh / bỏ qua / lỗi`. Thoát `1` nếu có mục lỗi; chạy lại sẽ tiếp tục phần còn thiếu.

## Biến môi trường mới (`.env.example`)

| Biến | Dùng ở | Ghi chú |
|---|---|---|
| `AZURE_SPEECH_KEY` | `content:audio` | Bí mật |
| `AZURE_SPEECH_REGION` | `content:audio` | Ví dụ `southeastasia` |
| `SUPABASE_SECRET_KEY` | `content:audio` | Khóa `sb_secret_…`, chỉ dùng trong script, không bao giờ `NEXT_PUBLIC_` |

## Trang quản trị (UI)

| Route | Nội dung |
|---|---|
| `/admin` | Cây khóa → unit → bài (bỏ mục đã gỡ, ghi số mục đã gỡ). Mỗi bài có: số câu, số câu AI, số câu có âm thanh, `source_path`, nút xuất bản, link xem trước. Khóa có nút xuất bản. Có khung "Kiểm tra gần nhất" đọc `content_reports` mới nhất |
| `/admin/lessons/[id]` | Danh sách câu chỉ đọc (dạng, đề, đáp án, giải thích, cờ AI, có âm thanh hay không) kèm đường dẫn file |
| `/admin/lessons/[id]/preview` | `LessonPlayer` ở chế độ `preview`: như `trial`, không ghi gì, nút thoát về `/admin/lessons/[id]` |

Bỏ: các form tạo khóa, unit, bài, câu; `saveExercise`, `createCourse`, `createUnit`, `createLesson` và action AI tạo nháp. Giữ: `togglePublished`. Mọi route qua `requireAdmin`.
