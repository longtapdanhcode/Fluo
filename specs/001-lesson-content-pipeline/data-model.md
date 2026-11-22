# Data Model: Quy trình nội dung bài học (001)

Thay đổi đi qua `src/db/schema.ts` → `npm run db:generate` → `npm run db:migrate`. SQL bật RLS cho bảng mới đặt trong custom migration (constitution).

## Bảng hiện có: thay đổi

### `courses`

| Cột | Kiểu | Thay đổi | Ghi chú |
|---|---|---|---|
| `slug` | text unique | giữ | Khóa đồng bộ = `id` trong `course.yaml` |
| `tts_voice` | text null | **mới** | Giọng Azure khai báo trong `course.yaml`; script âm thanh đọc từ đây |
| `published` | boolean | giữ | Chỉ `/admin` đổi; import chỉ đặt khi tạo mới (FR-015) |

### `units`

| Cột | Kiểu | Thay đổi | Ghi chú |
|---|---|---|---|
| `key` | text null | **mới** | `id` trong `unit.yaml`; null = dữ liệu cũ trước quy trình này |
| `archived_at` | timestamptz null | **mới** | Đặt khi unit không còn trong file |
| index `(course_id, sort_order)` unique | | **bỏ** | Thay bằng unique `(course_id, key)` |

### `lessons`

| Cột | Kiểu | Thay đổi | Ghi chú |
|---|---|---|---|
| `content_key` | text null, unique | **mới** | `"<course-slug>/<lesson-id>"`; không đổi khi chuyển unit |
| `source_path` | text null | **mới** | Đường dẫn file tương đối từ gốc repo, hiện ở `/admin` |
| `archived_at` | timestamptz null | **mới** | |
| index `(unit_id, sort_order)` unique | | **bỏ** | Đổi thành index thường `(unit_id, sort_order)` |

### `exercises`

| Cột | Kiểu | Thay đổi | Ghi chú |
|---|---|---|---|
| `key` | text null | **mới** | `id` của câu trong file; unique `(lesson_id, key)` |
| `audio_hash` | text null | **mới** | sha256(giọng + văn bản đọc) của file âm thanh hiện tại |
| `archived_at` | timestamptz null | **mới** | |
| `explanation` | text | giữ (nullable trong DB) | File bắt buộc có (FR-007e) |
| `ai_generated` | boolean | giữ | Lấy từ `aiGenerated` trong file |

## Bảng mới

### `vocabulary`

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | uuid pk | |
| `course_id` | uuid fk → courses, cascade | |
| `unit_id` | uuid fk → units, cascade | Unit giới thiệu từ |
| `word` | text | Từ hoặc cụm từ, giữ nguyên cách viết |
| `word_key` | text | `normalize(word)`; unique `(course_id, word_key)` |
| `meaning_vi` | text | |
| `example` | text null | Câu ví dụ tiếng Anh |
| `forms` | text[] default `{}` | Dạng bất quy tắc |
| `sort_order` | integer | Thứ tự trong unit |
| `audio_url` | text null | |
| `audio_hash` | text null | |
| `archived_at` | timestamptz null | |

### `exercise_vocabulary`

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `exercise_id` | uuid fk → exercises, cascade | |
| `vocabulary_id` | uuid fk → vocabulary, cascade | |
| pk | `(exercise_id, vocabulary_id)` | Index phụ trên `vocabulary_id` để truy vấn chiều ngược (FR-020) |

Mỗi lần import, liên kết của một câu được tính lại toàn bộ (xóa cũ, chèn mới) trong transaction.

### `content_reports`

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | uuid pk | |
| `created_at` | timestamptz default now | |
| `outcome` | text | `imported` \| `no_changes` \| `blocked` (có lỗi) \| `cancelled` (từ chối xác nhận) \| `dry_run` |
| `errors` | jsonb | `ContentIssue[]` |
| `warnings` | jsonb | `ContentIssue[]` |
| `summary` | jsonb | Số mục thêm / sửa / gỡ theo loại |
| `git_commit` | text null | `git rev-parse --short HEAD` lúc chạy, kèm `-dirty` nếu cây làm việc có thay đổi |

Chỉ giữ 20 bản mới nhất (import xóa bản cũ hơn). Ghi bảng này nằm **ngoài** transaction nội dung (FR-010).

Mọi bảng mới: `ENABLE ROW LEVEL SECURITY`, không policy (constitution, Nguyên tắc II).

## Kiểu thuần (src/lib/content, không phụ thuộc DB)

```text
ContentIssue {
  severity: "error" | "warning"
  code: "yaml_syntax" | "schema" | "unknown_word" | "duplicate_exercise" | "ambiguous_answer"
      | "missing_explanation" | "duplicate_id" | "duplicate_vocabulary" | "missing_manifest"
      | "exception_without_reason" | "legacy_course" | "orphan_course" | "acceptable_duplicates_answer"
  file: string            // đường dẫn tương đối
  line?: number
  exerciseKey?: string
  exerciseIndex?: number  // 1-based
  message: string         // tiếng Việt, đủ để sửa
}

ContentTree { courses: CourseContent[] }      // đã qua Zod, kèm vị trí node
SyncPlan   { inserts / updates / archives / restores theo loại, linksToRebuild, audioInvalidated }
```

## Quy tắc trạng thái

```text
Bài:     (chưa có) --import--> chưa xuất bản (hoặc xuất bản nếu file ghi published: true lần đầu)
         chưa xuất bản <--/admin--> đã xuất bản
         bất kỳ --file bị xóa--> gỡ (archived_at)  --file thêm lại--> trạng thái xuất bản cũ
Âm thanh: có (hash khớp) --văn bản đọc hoặc giọng đổi--> cần sinh lại (audio_url = null) --content:audio--> có
```

Học viên chỉ thấy: khóa `published` · unit `archived_at IS NULL` · bài `published AND archived_at IS NULL` · câu `archived_at IS NULL`. Cập nhật `src/lib/content.ts` (`getCoursePath`, `isLessonUnlocked`, `getLessonWithExercises`, `getTrialLessonId`) và phần chấm điểm trong `src/app/actions/lesson.ts` theo các điều kiện này.
