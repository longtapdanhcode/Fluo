# Implementation Plan: Quy trình nội dung bài học

**Branch**: `feat/001-content-pipeline` | **Date**: 2026-11-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-lesson-content-pipeline/spec.md`

## Summary

Chuyển bản gốc nội dung bài học từ database và seed viết cứng sang file YAML trong `content/`. Một bộ kiểm tra thuần (`src/lib/content/`) đọc file, kiểm schema 6 dạng bài và các quy tắc chất lượng (từ chưa học, câu trùng, nhiều đáp án, thiếu giải thích…), báo lỗi kèm số dòng.

Lệnh import tính kế hoạch đồng bộ bằng hàm thuần rồi ghi trong một transaction. Mục được nhận diện bằng khóa ổn định; mục không còn trong file thì gỡ (không xóa) để giữ tiến độ học viên. Lệnh in host đích và hỏi xác nhận trước khi ghi.

Ngoài ra có thêm:
- Bảng từ vựng nối nhiều-nhiều với câu hỏi.
- Lệnh AI soạn nháp ra file YAML.
- Lệnh sinh âm thanh bằng Azure Speech, lưu Supabase Storage theo hash nội dung.
- `/admin` chuyển sang chỉ xem trước, xuất bản và hiện báo cáo kiểm tra.

Thêm Vitest cho phần logic thuần. Constitution được sửa lên v1.1.0 để khớp cách soạn mới.

## Technical Context

**Language/Version**: TypeScript 5 (strict), Node 20+

**Primary Dependencies**:
- Có sẵn: Next.js 16.4 (App Router, Cache Components), Drizzle ORM 0.45, Zod 4, `@anthropic-ai/sdk`, `@supabase/supabase-js`, `tsx`.
- **Thêm**: `yaml` 2.x (dependency) và `vitest` (devDependency).

**Storage**: Supabase Postgres (qua Drizzle, chỉ từ server và script) và Supabase Storage (bucket công khai `lesson-audio`).

**Testing**: Vitest cho `src/lib/content/*` với fixture YAML trong `tests/fixtures/content/`. Phần UI kiểm thủ công trong trình duyệt theo [quickstart.md](quickstart.md).

**Target Platform**: script chạy trên máy người soạn (macOS/Linux, Node); app web deploy Vercel.

**Project Type**: web app Next.js một project, kèm script dòng lệnh trong `scripts/`.

**Performance Goals**: kiểm tra một khóa cỡ 32 bài, 300 câu, 400 từ dưới 10 giây (SC-007). Import một khóa dưới 30 giây qua pooler.

**Constraints**:
- Import là tất cả hoặc không (một transaction).
- Không mất `lesson_completions`.
- Gói Azure F0 giới hạn khoảng 20 yêu cầu/phút, nên script âm thanh phải giãn cách và chạy tiếp được sau khi dừng.
- Mọi màn quản trị dùng được ở 375px.

**Scale/Scope**: 1–2 khóa, dưới 50 bài, dưới 500 câu, dưới 500 từ trong giai đoạn MVP. Một người soạn.

Không còn mục NEEDS CLARIFICATION. Các quyết định nằm ở [research.md](research.md), từ R1 tới R12.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Nguyên tắc | Đánh giá | Ghi chú |
|---|---|---|
| I. Một codebase, hai đối tượng | ✅ | Spec ghi rõ chế độ Người lớn. Định dạng file có `audience`, không giả định gì riêng cho người lớn. Không thêm app hay DB mới |
| II. Server là nguồn sự thật | ✅ | Script và route admin truy cập DB phía server. Bảng mới bật RLS, không policy. `SUPABASE_SECRET_KEY`, `AZURE_SPEECH_KEY` không có `NEXT_PUBLIC_` và chỉ dùng trong script. Preview qua `requireAdmin`, không ghi tiến độ. Bucket âm thanh đọc công khai vì nội dung bài học công khai; ghi chỉ bằng secret key |
| III. Logic thuần, tách framework | ✅ | `src/lib/content/` không import Next, React, Supabase hay `@/db`; chỉ dùng `zod`, `yaml` và `src/lib/exercises/`. `exerciseData` vẫn là schema duy nhất cho data câu hỏi. Không thêm dạng bài mới. Schema AI trong `lib/ai.ts` được cập nhật cho lệnh nháp |
| IV. Nội dung dạng file, AI chỉ soạn nháp | ✅ (đã sửa) | Bản v1.0.0 ghi "soạn qua `/admin`". Constitution **đã sửa lên v1.1.0** trên nhánh này (task T058, research R11) trước khi viết code. Tinh thần giữ nguyên: nội dung không viết cứng trong code, AI chỉ ra nháp có cờ `ai_generated` và chưa xuất bản tới khi người duyệt |
| V. An toàn trẻ em, riêng tư | ✅ | Không thu dữ liệu cá nhân mới. Không có tính năng cho trẻ |
| VI. Đơn giản | ✅ | 2 dependency mới (`yaml`, `vitest`) có lý do ở R1 và R10. Azure gọi REST bằng `fetch`, không SDK. Dịch vụ ngoài mới duy nhất là Azure Speech, dùng gói miễn phí (R3). Feature chia được thành các bước kiểm chứng độc lập theo user story |
| Ràng buộc kỹ thuật | ✅ | Đổi schema qua `schema.ts` → generate → migrate. RLS đặt trong custom migration. Đọc `node_modules/next/dist/docs/` trước khi viết route preview (R12) |
| Quy trình | ✅ | Làm trên nhánh riêng. Cổng: typecheck, lint, build, `npm test`, chạy thử trình duyệt desktop và 375px. Cập nhật README (lệnh mới, biến môi trường) và DECISIONS (Azure TTS, nội dung dạng file) |

**Re-check sau Phase 1**: thiết kế ở data-model và contracts không tạo vi phạm mới. Vi phạm duy nhất (Nguyên tắc IV) được xử lý bằng sửa đổi constitution, ghi trong Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/001-lesson-content-pipeline/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── content-format.md
│   └── cli.md
├── checklists/requirements.md
└── tasks.md             # tạo bởi /speckit-tasks
```

### Source Code (repository root)

```text
content/
└── a1-starter/                       # chuyển từ scripts/seed.ts
    ├── course.yaml
    ├── 01-greetings/{unit.yaml, 01-hello.yaml, 02-introduce.yaml}
    └── 02-family/{unit.yaml, 01-members.yaml, 02-how-many.yaml}

src/
├── db/schema.ts                      # cột mới, bảng vocabulary, exercise_vocabulary, content_reports
├── lib/
│   ├── exercises/                    # giữ nguyên (types.ts, check.ts)
│   ├── content/                      # MỚI, hàm thuần
│   │   ├── schema.ts                 # Zod cho course/unit/lesson YAML
│   │   ├── parse.ts                  # chuỗi YAML → cây nội dung + vị trí dòng
│   │   ├── words.ts                  # trích chữ tiếng Anh, tokenize, biến thể từ
│   │   ├── validate.ts               # các quy tắc → ContentIssue[]
│   │   ├── sync.ts                   # planSync(cây, ảnh chụp DB) → SyncPlan
│   │   ├── audio.ts                  # audioText(câu), audioHash(giọng, text)
│   │   ├── report.ts                 # in lỗi ra terminal
│   │   └── *.test.ts
│   ├── content.ts                    # truy vấn học viên: lọc archived_at
│   └── ai.ts                         # + generateLessonDraft, − generateExercises
├── app/
│   ├── admin/
│   │   ├── page.tsx                  # cây, số liệu, báo cáo kiểm tra
│   │   ├── actions.ts                # chỉ còn togglePublished
│   │   ├── forms.tsx                 # chỉ còn PublishToggle
│   │   └── lessons/[id]/{page.tsx, preview/page.tsx}
│   └── actions/lesson.ts             # bỏ qua câu đã gỡ khi chấm
└── components/lesson/lesson-player.tsx  # thêm mode "preview"

scripts/
├── content-check.ts
├── content-import.ts
├── content-draft.ts
├── content-audio.ts
├── lib/{load-files.ts, db-snapshot.ts, apply-sync.ts, azure-tts.ts, storage.ts, prompt.ts}
└── seed.ts                           # chỉ còn tạo huy hiệu

tests/fixtures/content/<tình-huống>/  # mỗi loại lỗi một bộ, cộng bộ "clean"
drizzle/                              # migration sinh tự động + custom migration RLS
vitest.config.ts
```

**Structure Decision**: giữ một project Next.js. Logic thuần đặt trong `src/lib/content/` (dùng lại được cho app mobile, test bằng Vitest). Phần I/O (đọc file, DB, Azure, Storage) đặt trong `scripts/lib/` để `src/lib/content/` không phụ thuộc hạ tầng.

## Thứ tự triển khai gợi ý (cho /speckit-tasks)

1. **Nền**: Vitest, `yaml`, schema DB và migration, constitution v1.1.0.
2. **US2 + US1 (P1)**: schema file, parse, validate kèm test; chuyển seed thành file; `content:check`; `planSync` kèm test; `content:import`; lọc `archived_at` trong truy vấn học viên.
3. **US3**: từ vựng và liên kết câu ↔ từ (chung bước import).
4. **US5**: `content:audio`.
5. **US4**: `content:draft`.
6. **US6**: dọn `/admin`, preview, khung báo cáo.
7. **Hoàn thiện**: README, DECISIONS, `.env.example`, cổng chất lượng, quickstart.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Nguyên tắc IV ghi "soạn qua `/admin`" nhưng tính năng chuyển việc soạn sang file YAML | Soạn khoảng 32 bài cần review bằng diff, lịch sử git và kiểm tra tự động trước khi ghi; CMS sửa trực tiếp DB không có những thứ đó | Giữ CMS và thêm kiểm tra trong form: không có lịch sử hay diff, AI vẫn ghi thẳng DB, và một người phải tự viết lại công cụ review mà git đã có. Xử lý: sửa constitution v1.1.0 trong cùng nhánh |
| Bỏ unique index thứ tự của `units` và `lessons` | Đổi thứ tự trong một transaction và giữ mục đã gỡ sẽ va chạm unique | Dùng constraint `DEFERRABLE`: drizzle-kit không sinh được, phải sửa tay migration (constitution cấm). Thứ tự đã được bảo đảm ở tầng file |
