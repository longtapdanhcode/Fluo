---
description: "Danh sách task cho tính năng 001 · Quy trình nội dung bài học"
---

# Tasks: Quy trình nội dung bài học

**Input**: Tài liệu thiết kế trong `specs/001-lesson-content-pipeline/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Có. Constitution (phần Test) bắt buộc unit test cho logic thuần trong `src/lib/content/`, và plan thêm Vitest. Viết test trước, để test thất bại, rồi mới cài đặt. UI admin kiểm thủ công theo quickstart.

**Organization**: Task nhóm theo user story để làm và kiểm chứng từng phần độc lập.

## Format: `[ID] [P?] [Story] Mô tả`

- **[P]**: chạy song song được (khác file, không phụ thuộc task chưa xong)
- **[Story]**: user story mà task thuộc về (US1…US6)

## Ghi chú chung cho mọi task

- `src/lib/content/` là hàm thuần: **KHÔNG** import `next`, `react`, `@supabase/*`, `@/db` (constitution, Nguyên tắc III). Chỉ dùng `zod`, `yaml`, `src/lib/exercises/*`.
- Script trong `scripts/` chạy bằng `tsx --conditions=react-server` (research R2), được import `@/db` và `@/lib/ai`.
- Thông báo cho người dùng viết bằng tiếng Việt.
- Trước khi viết route hoặc API của Next, đọc mục liên quan trong `node_modules/next/dist/docs/`.

---

## Phase 1: Setup (hạ tầng chung)

**Purpose**: Cài phụ thuộc, test runner, lệnh npm

- [x] T001 Cài `yaml` (dependency) và `vitest` 4.1 (devDependency; Vitest 5 đòi @types/node ≥ 22), cập nhật `package.json` và `package-lock.json` bằng `npm install yaml && npm install -D vitest`
- [x] T002 [P] Tạo `vitest.config.mts` ở gốc repo (đuôi .mts vì package không phải ESM): alias `@` → `src`, `include: ["src/**/*.test.ts"]`, môi trường `node`
- [x] T003 Thêm script vào `package.json`:
  - `"test": "vitest run"`
  - `"content:check": "tsx --conditions=react-server scripts/content-check.ts"`
  - `"content:import"`, `"content:draft"`, `"content:audio"` tương tự, trỏ tới `scripts/content-import.ts`, `scripts/content-draft.ts`, `scripts/content-audio.ts`
- [x] T004 [P] Thêm `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`, `SUPABASE_SECRET_KEY` (kèm ghi chú "chỉ dùng trong script, không bao giờ NEXT_PUBLIC_") vào `.env.example`, theo bảng "Biến môi trường mới" trong `contracts/cli.md`

---

## Phase 2: Foundational (điều kiện tiên quyết)

**Purpose**: Schema DB, schema file, đọc file và parse YAML: mọi story đều cần

**⚠️ CRITICAL**: Chưa xong phase này thì chưa làm user story nào

### Constitution (phải xong trước mọi thay đổi code)

- [x] T058 Sửa `.specify/memory/constitution.md` qua `/speckit-constitution` lên **v1.1.0** (research R11):
  - Nguyên tắc IV: nội dung có bản gốc là file trong `content/`, kiểm tự động, import vào DB; `/admin` để xem trước và xuất bản.
  - Gỡ `TODO(TEST_RUNNER)`, ghi Vitest và `npm test` vào cổng chất lượng.
  - Kèm Sync Impact Report.

### Database (một migration cho cả tính năng)

- [x] T005 Sửa `src/db/schema.ts` theo `data-model.md`:
  - **Cột mới:**
    - `courses.ttsVoice` (data-model.md `courses.tts_voice`)
    - `units.key`, `units.archivedAt` (data-model.md `units.key`, `units.archived_at`)
    - `lessons.contentKey` unique, `lessons.sourcePath`, `lessons.archivedAt` (data-model.md `lessons.content_key`, `lessons.source_path`, `lessons.archived_at`)
    - `exercises.key`, `exercises.audioHash`, `exercises.archivedAt` (data-model.md `exercises.key`, `exercises.audio_hash`, `exercises.archived_at`)
  - **Index:**
    - Bỏ unique `units_course_order_idx`, thay bằng unique `(course_id, key)`.
    - Đổi `lessons_unit_order_idx` thành index thường.
    - Thêm unique `(lesson_id, key)` cho exercises.
  - **Bảng mới:**
    - `vocabulary`: đủ cột của data-model.md `vocabulary.*`, unique `(course_id, word_key)`, `forms` kiểu `text[]` mặc định rỗng.
    - `exerciseVocabulary`: data-model.md `exercise_vocabulary.*`, pk ghép, index trên `vocabulary_id`.
    - `contentReports`: data-model.md `content_reports.*`, `outcome` là text với 5 giá trị đã liệt kê.
  - **Kiểu xuất:** `Vocabulary`, `ContentReport`.
- [x] T006 Chạy `npm run db:generate` để sinh migration trong `drizzle/`. **Không sửa tay** file sinh ra.
- [x] T007 Tạo custom migration bằng `npx drizzle-kit generate --custom --name=content_pipeline_rls`. Trong đó `ALTER TABLE … ENABLE ROW LEVEL SECURITY` cho `vocabulary`, `exercise_vocabulary`, `content_reports` (constitution, Nguyên tắc II; tham khảo `drizzle/0001_rls.sql`).
- [x] T008 Chạy `npm run db:migrate` vào DB của dự án. Sau đó `npm run db:check` báo kết nối được và app vẫn chạy (`/learn` vẫn hiện khóa cũ).

### Schema file và parse (thuần)

- [x] T009 [P] Tạo `src/lib/content/types.ts`: kiểu `ContentIssue` (đủ các `code` trong data-model.md "Kiểu thuần"), `SourceFile { path: string; text: string }`, `ContentTree`, `CourseContent`, `UnitContent`, `LessonContent`, `ExerciseContent` (mỗi node kèm `file` và `line`)
- [x] T010 [P] Tạo `src/lib/content/schema.ts`: Zod cho `course.yaml`, `unit.yaml` và file bài theo `contracts/content-format.md`.
  - Field `data` của câu dùng lại `exerciseData` từ `src/lib/exercises/types.ts`.
  - `id` của khóa, unit, bài, câu khớp `^[a-z0-9]+(-[a-z0-9]+)*$`.
  - `explanation` là chuỗi tùy chọn (thiếu sẽ do validate báo `missing_explanation`, không phải lỗi schema).
  - `exceptions[].reason` là chuỗi tùy chọn (validate báo `exception_without_reason`).
  - `choicesLang` nhận `en | vi`; `published` và `aiGenerated` mặc định `false`; `xp` mặc định 10.
- [x] T011 [P] Viết test `src/lib/content/parse.test.ts` cho `parseContent(files: SourceFile[])`:
  - File YAML sai cú pháp → `yaml_syntax` có dòng.
  - Lỗi Zod ở `exercises[2].data.answerIndex` → `schema`, kèm dòng của node đó, `exerciseIndex: 3` và `exerciseKey`.
  - Thiếu `course.yaml` hoặc `unit.yaml`, hoặc file bài không được liệt kê trong `unit.yaml > lessons` → `missing_manifest`.
  - Bộ file hợp lệ → `ContentTree` đúng thứ tự unit, bài, câu.
- [x] T012 Cài `src/lib/content/parse.ts`:
  - `parseContent(files)` dùng `parseDocument` và `LineCounter` của `yaml` (research R1), đổi đường dẫn lỗi Zod ra số dòng.
  - Nhóm file theo thư mục khóa và unit, sắp thứ tự theo `course.units` và `unit.lessons`.
  - Trả về `{ tree, issues }` và không dừng ở lỗi đầu tiên (FR-008).
  - Làm cho T011 qua.
- [x] T013 [P] Tạo `scripts/lib/load-files.ts`: đọc đệ quy mọi `*.yaml` trong thư mục nội dung (mặc định `content/`) thành `SourceFile[]`, đường dẫn tương đối từ gốc repo
- [x] T014 [P] Tạo `src/lib/content/report.ts`: `formatIssues(issues)` in theo nhóm file, mỗi dòng dạng `file:dòng  [mã]  câu #n (id)  mô tả`; `formatSummary(tree, issues)` in dòng cuối theo `contracts/cli.md` (`✓ Không có lỗi · …` hoặc `✗ N lỗi, N cảnh báo`)

**Checkpoint**: DB đã có cột và bảng mới; parse được file YAML ra cây kèm vị trí.

---

## Phase 3: User Story 1 · Soạn bài bằng file và import an toàn (Priority: P1) 🎯 MVP

**Goal**: 4 bài A1 mẫu nằm trong `content/`. `content:import` đồng bộ vào DB, chạy lại không trùng và giữ tiến độ học viên.

**Independent Test**: quickstart bước 3–4. Import thay seed cũ; chạy lại báo "Không có thay đổi"; sửa câu, đổi tên file, đảo thứ tự bài rồi import → `/learn` vẫn đánh dấu bài đã học.

### Tests cho US1

- [x] T015 [P] [US1] Viết test `src/lib/content/sync.test.ts` cho `planSync(tree, snapshot)`:
  - DB trống → toàn bộ là thêm mới; `published` lấy từ file khi tạo lần đầu (FR-015).
  - Chạy lại với snapshot khớp file → kế hoạch rỗng.
  - Sửa câu → 1 cập nhật.
  - Đổi thứ tự hoặc chuyển bài sang unit khác → chỉ đổi `sortOrder`/`unitId`, cùng `content_key`.
  - Xóa bài khỏi file → gỡ (đặt `archived_at`).
  - Thêm lại bài đã gỡ → khôi phục, giữ trạng thái xuất bản.
  - Bài đã xuất bản trên `/admin` nhưng file ghi `published: false` → không đổi `published`.
  - Khóa trong DB không có trong file → cảnh báo `orphan_course`.
  - Unit hoặc bài thiếu `key` → lỗi `legacy_course`.

### Implementation cho US1

- [x] T016 [P] [US1] Tạo `content/a1-starter/course.yaml` và `content/a1-starter/01-greetings/`, `content/a1-starter/02-family/` (mỗi unit một `unit.yaml` và 2 file bài).
  - Chuyển nguyên nội dung 4 bài từ `scripts/seed.ts` sang định dạng `contracts/content-format.md`.
  - Đặt `id` ổn định cho mọi bài và câu; mỗi câu có `explanation`.
  - Đặt `ttsVoice: en-US-AvaMultilingualNeural`, `published: true`.
  - Ghi `vocabulary` đủ cho từng unit, cùng `commonWords` và `names` ở `course.yaml`, để nội dung qua được quy tắc từ chưa học của US2.
- [x] T017 [US1] Cài `src/lib/content/sync.ts`:
  - Kiểu `DbSnapshot` (khóa, unit, bài, câu hiện có, kèm `key`/`content_key`/`archived_at`/`published`/`audio_hash`) và `SyncPlan` (thêm / sửa / gỡ / khôi phục theo loại, tóm tắt số lượng).
  - Hàm `planSync(tree, snapshot)` nhận diện theo data-model.md `courses.slug`, `units.key`, `lessons.content_key`, `exercises.key`; `sort_order` lấy theo vị trí (bắt đầu từ 1).
  - Điều kiện "đã đổi" theo từng loại:
    - Khóa: `title`, `description`, `level`, `audience`, `ttsVoice`.
    - Unit: `title`, `description`, `sortOrder`.
    - Bài: `title`, `xp`, `sortOrder`, `unitId`, `sourcePath`. Đổi tên file thì cập nhật `source_path`.
    - Câu: `type`, `prompt`, `data`, `explanation`, `image`, `aiGenerated` (data-model.md `exercises.ai_generated`), `sortOrder`.
  - `published` chỉ đặt khi tạo mới, không bao giờ cập nhật theo file (data-model.md `courses.published`; với bài, theo FR-015).
  - Làm cho T015 qua.
- [x] T018 [P] [US1] Tạo `scripts/lib/db-snapshot.ts`: `loadSnapshot(db, courseSlugs)` đọc khóa, unit, bài, câu (kể cả mục đã gỡ) thành `DbSnapshot`
- [x] T019 [US1] Tạo `scripts/lib/apply-sync.ts`:
  - `applySync(db, plan)` chạy mọi thay đổi trong một `db.transaction` (FR-012).
  - Gỡ bằng `archived_at = now()`, khôi phục bằng `archived_at = null`. **Không** xóa dòng nào và không đụng `lesson_completions` (FR-013, FR-014).
  - Ghi `lessons.source_path` và `courses.tts_voice` theo data-model.md.
  - `replaceLegacyCourse(db, slug)` xóa khóa cũ theo cascade.
- [x] T020 [US1] Tạo `scripts/content-import.ts` theo các bước 1–6 của `contracts/cli.md`:
  - Có cờ `--dry-run`, `--yes`, `--replace-legacy`.
  - In `Đích: <host>` lấy từ `DATABASE_URL` (không in mật khẩu), tóm tắt và danh sách bài bị gỡ.
  - Hỏi `y/N` bằng `node:readline/promises`. `--replace-legacy` luôn hỏi riêng.
  - Thoát mã 1 khi có lỗi kiểm tra hoặc lỗi ghi.
- [x] T021 [US1] Sửa `src/lib/content.ts`: `getCoursePath`, `isLessonUnlocked`, `getTrialLessonId` chỉ lấy unit và bài có `archivedAt IS NULL`; `getLessonWithExercises` chỉ lấy câu có `archivedAt IS NULL` (data-model.md, mục "Quy tắc trạng thái")
- [x] T022 [US1] Sửa `src/app/actions/lesson.ts`: khi chấm lại bài ở server, bỏ qua câu có `archivedAt` khác null, để số câu khớp những gì học viên thấy
- [x] T023 [US1] Thu gọn `scripts/seed.ts` chỉ còn tạo huy hiệu (bỏ toàn bộ nội dung bài và đoạn xóa khóa `a1-starter`), sửa chú thích đầu file. Sửa luôn hai thông báo đang bảo chạy `npm run db:seed` để có bài thành `npm run content:import`: `src/app/try/page.tsx` (dòng 20) và `src/app/learn/page.tsx` (dòng 84)
- [X] T024 [US1] Kiểm chứng theo quickstart bước 3–4:
  - Chạy `npm run content:import -- --replace-legacy`, rồi chạy lại để thấy "Không có thay đổi".
  - Học xong một bài, sửa, đổi tên, đảo thứ tự rồi import → tiến độ còn.

**Checkpoint**: Nội dung mẫu nằm trong file, import idempotent, học viên học bình thường.

---

## Phase 4: User Story 2 · Kiểm tra chất lượng nội dung tự động (Priority: P1)

**Goal**: Một lần chạy `content:check` hoặc `content:import` báo đủ 8 loại lỗi ở FR-007 kèm file, dòng, id câu; có lỗi thì import bị chặn.

**Independent Test**: `npm test` qua với các fixture lỗi; quickstart bước 2 và 5.

### Tests cho US2

- [x] T025 [P] [US2] Tạo fixture trong `tests/fixtures/content/`. Mỗi thư mục là một khóa nhỏ hoàn chỉnh chứa đúng một loại lỗi:
  - `clean`, `unknown-word`, `exception-no-reason`, `duplicate-exercise`
  - `ambiguous-mc`, `ambiguous-word-bank`, `ambiguous-fill-blank`, `ambiguous-match-pairs`
  - `missing-explanation`, `duplicate-id`, `duplicate-vocabulary`
  - `acceptable-warning` (chỉ có cảnh báo)
- [x] T026 [P] [US2] Viết test `src/lib/content/words.test.ts`:
  - `englishTexts(exercise)` lấy đúng trường theo bảng R7 trong research.md, kể cả đoạn trong “…” của `prompt` và `choicesLang` tự nhận hoặc khai báo.
  - `tokenize` bỏ dấu câu và số.
  - `candidates()` xử lý được `i'm`, `don't`, `'s`, `-s/-es/-ies`, `-ing` (`making`, `running`), `-ed` (`studied`, `stopped`).
  - Cụm từ "good morning" khớp chuỗi con; `forms` khớp dạng bất quy tắc.
- [x] T027 [P] [US2] Viết test `src/lib/content/validate.test.ts`: đọc từng fixture của T025 qua `parseContent` + `validateContent`, kiểm đúng `code`, `severity`, `file`, `line`, `exerciseKey`. Fixture `clean` không có issue nào. Fixture nhiều lỗi liệt kê đủ trong một lần chạy.

### Implementation cho US2

- [x] T028 [US2] Cài `src/lib/content/words.ts`:
  - `englishTexts(exercise)` và `tokenize(text)` (dùng lại `normalize` của `src/lib/exercises/check.ts`).
  - `candidates(token)`.
  - `buildKnownWords(course, uptoUnitIndex)` trả tập từ đã học, gồm từ của unit đó và các unit trước, từ thành phần của cụm, `forms`, `commonWords`, `names`.
  - `findUnknownWords(exercise, known)` trừ các từ ngoại lệ của câu.
  - Theo research R7. Làm cho T026 qua.
- [x] T029 [US2] Cài `src/lib/content/validate.ts`: `validateContent(tree)` trả `ContentIssue[]` cho:
  - `unknown_word`
  - `exception_without_reason`
  - `duplicate_exercise` (theo khóa so sánh R8, báo cả hai vị trí)
  - `ambiguous_answer` (các quy tắc R8)
  - `missing_explanation`
  - `duplicate_id` (bài trong khóa, câu trong bài, unit trong khóa)
  - `duplicate_vocabulary` (cùng `normalize(word)` ở hai unit)
  - cảnh báo `acceptable_duplicates_answer`

  Thêm hàm `countExceptions(tree)` (FR-008a). Làm cho T027 qua.
- [x] T030 [US2] Tạo `scripts/content-check.ts`: đọc file (T013) → `parseContent` → `validateContent` → in bằng `report.ts`, kèm số từ ngoại lệ. Có cờ `--dir`. Thoát mã 1 nếu có lỗi. **Không** import `@/db`.
- [x] T031 [US2] Sửa `scripts/content-import.ts`: chạy `validateContent` trước `planSync`, có lỗi thì in và dừng (sau khi lưu báo cáo, xem T050)
- [x] T050 [US2] Ghi báo cáo kiểm tra:
  - Thêm `saveReport(db, { outcome, errors, warnings, summary, gitCommit })` vào `scripts/lib/apply-sync.ts`. Hàm này ghi data-model.md `content_reports.*` (giá trị của data-model.md `content_reports.outcome` như đã liệt kê) **ngoài** transaction nội dung và xóa bản cũ, chỉ giữ 20 bản (FR-010).
  - Gọi hàm ở mọi nhánh kết thúc của `scripts/content-import.ts`: `blocked`, `no_changes`, `dry_run`, `cancelled`, `imported`.
  - `gitCommit` lấy từ `git rev-parse --short HEAD`, thêm `-dirty` nếu `git status --porcelain` có thay đổi.
- [x] T032 [US2] Kiểm chứng: chạy `npm test` và `npm run content:check` (nội dung mẫu sạch, dưới 10 giây, SC-007), rồi làm quickstart bước 5

**Checkpoint**: P1 hoàn tất. Nội dung chỉ vào DB khi sạch lỗi.

---

## Phase 5: User Story 3 · Từ vựng theo unit, nối với câu hỏi (Priority: P2)

**Goal**: Import ghi từ vựng vào bảng `vocabulary` và nối câu với từ trong `exercise_vocabulary`.

**Independent Test**: sau import, mỗi từ của khóa A1 mẫu xuất hiện đúng một lần; truy vấn hai chiều câu ↔ từ đúng (quickstart bước 3, kiểm bằng `npm run db:studio`).

### Tests cho US3

- [x] T033 [P] [US3] Bổ sung `src/lib/content/sync.test.ts`:
  - Từ vựng mới → thêm; sửa `meaning` → cập nhật cùng dòng; xóa khỏi file → gỡ.
  - `linkWords(exercise, vocabIndex)` trả đúng các từ của câu "Nice to meet you." (`nice`, `meet`, …); từ ngoại lệ không được nối.
  - Thêm từ "nice" vào `unit.yaml` mà không sửa câu nào → câu cũ chứa "nice" vẫn được nối với từ mới.

### Implementation cho US3

- [x] T034 [US3] Mở rộng `src/lib/content/sync.ts`:
  - `planSync` tính thay đổi cho từ vựng, nhận diện theo data-model.md `vocabulary.word_key` trong phạm vi data-model.md `vocabulary.course_id`, ghi `vocabulary.meaning_vi`, `vocabulary.example`, `vocabulary.forms`, `vocabulary.sort_order`, `vocabulary.unit_id`.
  - Từ không còn trong file thì đặt data-model.md `vocabulary.archived_at`; thêm lại thì xóa giá trị đó.
  - Thêm `linkWords` dùng `words.ts`. Mỗi lần import có thay đổi, tính lại liên kết cho **mọi câu chưa gỡ của khóa**, không chỉ câu đã sửa, để từ mới thêm được nối với câu cũ. So với liên kết hiện có; khác thì đưa vào kế hoạch.
  - Làm cho T033 qua.
- [x] T035 [US3] Mở rộng `scripts/lib/db-snapshot.ts` (đọc `vocabulary` và `exercise_vocabulary`) và `scripts/lib/apply-sync.ts`: ghi từ vựng; mỗi câu có liên kết khác so với DB thì xóa rồi chèn lại liên kết trong `exercise_vocabulary` (data-model.md `exercise_vocabulary.*`), trong cùng transaction
- [x] T036 [P] [US3] Thêm `getExerciseVocabulary(exerciseId)` và `getVocabularyExercises(vocabularyId)` vào `src/lib/content.ts` (FR-020), dùng index của data-model.md `exercise_vocabulary.vocabulary_id`
- [x] T037 [US3] Kiểm chứng: import lại khóa mẫu; tóm tắt có dòng từ vựng; `db:studio` cho thấy liên kết đúng; chạy lại import → không có thay đổi

**Checkpoint**: Có dữ liệu từ vựng làm nền cho ôn tập ngắt quãng.

---

## Phase 6: User Story 5 · Sinh âm thanh một lần (Priority: P2)

**Goal**: `content:audio` sinh mp3 bằng Kokoro (chạy trên máy, từ 2026-11-23; ban đầu là Azure) cho câu nghe và từ vựng, upload lên Storage, điền `audio_url`; chạy lại không sinh trùng.

**Independent Test**: quickstart bước 7.

> Làm trước US4 vì độc lập với AI và hoàn thiện được vòng nội dung soạn tay. US4 và US5 cùng P2.

### Tests cho US5

- [x] T038 [P] [US5] Viết test `src/lib/content/audio.test.ts`:
  - `audioText(exercise)` trả `data.audioText` cho `listen_select`/`listen_type`, null cho dạng khác.
  - `audioHash(voice, text)` ổn định, đổi khi giọng hoặc văn bản đổi.
  - `planSync` đặt `audio_url = null` khi văn bản đọc hoặc giọng thay đổi, giữ nguyên khi không đổi (FR-017).

### Implementation cho US5

- [x] T039 [US5] Cài `src/lib/content/audio.ts` (`audioText`, `audioHash` bằng `node:crypto` sha256 theo research R4; có thể dùng `crypto.subtle` nếu muốn giữ thuần cho mobile). Sửa `sync.ts` để vô hiệu âm thanh cũ theo data-model.md `exercises.audio_hash`, `vocabulary.audio_hash`. Làm cho T038 qua.
- [x] T040 [P] [US5] *(Đã thay bằng T065.)* Tạo `scripts/lib/azure-tts.ts`:
  - `synthesize({ text, voice })` gọi REST theo research R3 bằng `fetch`, với SSML `xml:lang="en-US"` và header `X-Microsoft-OutputFormat: audio-24khz-48kbitrate-mono-mp3`.
  - Escape ký tự XML trong text.
  - Gặp 429 thì chờ `Retry-After` rồi thử lại tối đa 3 lần; lỗi khác ném `Error` có thông điệp tiếng Việt.
- [x] T041 [P] [US5] Tạo `scripts/lib/storage.ts`: tạo client `@supabase/supabase-js` bằng `NEXT_PUBLIC_SUPABASE_URL` và `SUPABASE_SECRET_KEY`; `ensureBucket("lesson-audio", { public: true })`; `uploadMp3(path, bytes)` (upsert) trả public URL
- [x] T042 [US5] Tạo `scripts/content-audio.ts` theo `contracts/cli.md`:
  - Kiểm biến môi trường.
  - Gom câu nghe và từ vựng chưa gỡ cần âm thanh theo data-model.md `exercises.audio_url`/`exercises.audio_hash`/`vocabulary.audio_url`/`vocabulary.audio_hash`, giọng lấy từ `courses.tts_voice`.
  - Gộp theo hash, sinh tuần tự giãn cách khoảng 3 giây.
  - Upload `"<course>/<hash>.mp3"`, rồi cập nhật mọi dòng cùng hash **sau khi** upload thành công.
  - Có cờ `--course`, `--dry-run`, `--limit`. In tổng kết `đã sinh / bỏ qua / lỗi`.
- [x] T043 [US5] Kiểm tra `src/components/lesson/utils.ts` và `lesson-player.tsx`: player phát `audioUrl` khi có, quay về giọng trình duyệt khi null (đã có sẵn; chỉ sửa nếu chưa đúng FR-029). Đảm bảo `/try` và `/lesson/[id]` truyền `audioUrl`.
- [x] T044 [US5] Kiểm chứng quickstart bước 7: chạy `content:audio` (cần `SUPABASE_SECRET_KEY`), nghe trong bài có câu nghe, chạy lại thì in `0 đã sinh`

**Checkpoint**: Câu nghe dùng giọng Kokoro; chạy lại không sinh lại.

---

## Phase 7: User Story 4 · AI soạn nháp một bài thành file (Priority: P2)

**Goal**: skill `/soan-bai` (từ 2026-11-23; ban đầu là lệnh `content:draft`) tạo file bài YAML nháp đúng định dạng, đánh dấu AI, chưa xuất bản, kèm kết quả kiểm tra.

**Independent Test**: quickstart bước 6.

### Tests cho US4

- [x] T045 [P] [US4] *(Đã gỡ ở T067.)* Viết test `src/lib/content/draft.test.ts`:
  - `draftToYaml(draft)` cho ra YAML mà `parseContent` đọc lại được.
  - Mọi câu có `aiGenerated: true`, bài có `published: false`.
  - `explanation` nhiều dòng dùng block `|`.
  - `addLessonToUnitYaml(unitYamlText, lessonId)` thêm id vào cuối `lessons`, giữ nguyên ghi chú và phần còn lại của file.

### Implementation cho US4

- [x] T046 [US4] *(Đã gỡ ở T067.)* Cài `src/lib/content/draft.ts` (`draftToYaml`, `addLessonToUnitYaml`, dùng `yaml` Document API để giữ ghi chú). Làm cho T045 qua.
- [x] T047 [US4] *(`generateLessonDraft` đã gỡ ở T067; việc xóa `generateExercises` giữ nguyên.)* Sửa `src/lib/ai.ts`:
  - Thêm `generateLessonDraft({ level, courseTitle, unitTitle, topic, words, allowedWords, count, types })` theo research R9: schema "lỏng" có `id` cho câu và `explanation` bắt buộc; prompt yêu cầu chỉ dùng `allowedWords`, mỗi câu một đáp án, sắp từ dễ đến khó.
  - Kiểm lại từng câu bằng `exerciseData`.
  - Xóa `generateExercises` cùng các kiểu chỉ nó dùng.
- [x] T048 [US4] *(Đã thay bằng T066.)* Tạo `scripts/content-draft.ts` theo `contracts/cli.md`:
  - Đọc tham số; thiếu `ANTHROPIC_API_KEY` thì dừng (FR-024).
  - Tìm thư mục khóa và unit theo `id`; gợi ý các từ chưa có trong `unit.yaml`.
  - Gọi `generateLessonDraft`, rồi ghi file mới (không ghi đè nếu không có `--force`, FR-022) và thêm id vào `unit.yaml`.
  - Chạy `parseContent` + `validateContent` trên cả khóa, in lỗi của file mới. Không kết nối DB.
- [X] T049 [US4] Kiểm chứng quickstart bước 6: `/soan-bai` → `git diff` → sửa → `content:check` → `content:import` → bài mới chưa xuất bản, câu mang cờ AI

**Checkpoint**: Có thể soạn nội dung tính năng 002 nhanh bằng AI, vẫn qua review bằng diff.

---

## Phase 8: User Story 6 · Trang quản trị để xem trước và xuất bản (Priority: P3)

**Goal**: `/admin` chỉ còn xem cây bài, xem trước, bật/tắt xuất bản và xem báo cáo kiểm tra; bỏ hết chức năng sửa nội dung.

**Independent Test**: quickstart bước 8 (desktop và 375px).

### Implementation cho US6

- [x] T051 [P] [US6] Sửa `src/components/lesson/lesson-player.tsx`: thêm `mode: "preview"` hoạt động như `trial` (không gọi server, không ghi XP, tim hay tiến độ), nút thoát và màn kết quả dẫn về `exitHref` truyền vào
- [x] T052 [US6] Dọn `src/app/admin/actions.ts`: chỉ giữ `togglePublished` (có `requireAdmin`, `revalidatePath` cho `/admin` và `/learn`). Xóa `createCourse`, `createUnit`, `createLesson`, `saveExercise`, action AI và các import thừa (FR-034).
- [x] T053 [US6] Dọn `src/app/admin/forms.tsx`: chỉ giữ `PublishToggle`, xóa `QuickAddForm`, form câu hỏi và form AI
- [x] T054 [US6] Viết lại `src/app/admin/page.tsx` theo bảng "Trang quản trị (UI)" trong `contracts/cli.md`:
  - Cây khóa → unit → bài, bỏ mục có `archivedAt`, kèm số mục đã gỡ.
  - Mỗi bài có: số câu, số câu `aiGenerated`, số câu có `audioUrl`, `sourcePath`, `PublishToggle`, link xem trước.
  - Khóa có `PublishToggle`.
  - Khung "Kiểm tra gần nhất" đọc bản `content_reports` mới nhất: thời điểm, outcome, commit, danh sách lỗi và cảnh báo.
  - Dữ liệu theo request đặt sau `await connection()` hoặc trong `<Suspense>`. Dùng được ở 375px.
- [x] T055 [US6] Viết lại `src/app/admin/lessons/[id]/page.tsx`, gọi `await requireAdmin()` ngay trong page (không chỉ dựa vào layout; constitution, Nguyên tắc II): danh sách câu chỉ đọc (dạng theo `exerciseTypeLabels`, đề, đáp án qua `correctAnswerText`, giải thích, cờ AI, có âm thanh hay không), đường dẫn file nguồn, nút "Xem trước", ghi chú "Sửa nội dung trong file rồi chạy npm run content:import". Không có ô sửa.
- [x] T056 [US6] Tạo `src/app/admin/lessons/[id]/preview/page.tsx` (đọc trước docs của Next về dynamic route và `connection`):
  - `params` là Promise; gọi `await requireAdmin()` ngay trong page, không chỉ dựa vào layout (constitution, Nguyên tắc II).
  - Lấy bài bằng `getLessonWithExercises`, kể cả bài chưa xuất bản.
  - Render `LessonPlayer` với `mode="preview"`, `exitHref` là trang bài.
- [X] T057 [US6] Kiểm chứng trên trình duyệt (desktop và 375px):
  - `/admin` hiện đúng số liệu và báo cáo.
  - Xem trước bài chưa xuất bản không cộng XP.
  - Bật xuất bản → bài hiện ở `/learn`; tắt → bài biến mất.
  - Tài khoản không phải admin bị chặn.

**Checkpoint**: Mọi user story hoạt động; nội dung chỉ sửa qua file.

---

## Phase 9: Polish & việc chung

- [x] T059 [P] Cập nhật `README.md`:
  - Mục "Chạy lần đầu": migrate, `content:import` thay cho `db:seed`, biến môi trường mới, tạo resource Azure F0.
  - Bảng lệnh: `test`, `content:*`.
  - Cấu trúc: thêm `content/`, `src/lib/content/`.
  - Mục mới "Soạn nội dung": vòng soạn → check → import → audio → xuất bản.
  - Bỏ "AI tạo bản nháp trong CMS".
- [x] T060 [P] Cập nhật `DECISIONS.md`:
  - Audio: Azure Speech gói F0, sinh bằng lệnh, lưu bucket `lesson-audio`.
  - Thêm dòng "Nội dung: file YAML trong repo là bản gốc, /admin chỉ xem trước và xuất bản".
  - Sửa mục AI: soạn nháp bằng lệnh ra file.
- [x] T061 [P] Sửa `docs/speckit-plan.md`: đánh dấu 001 xong và ghi lệnh mới cho tính năng 002
- [x] T062 Chạy cổng chất lượng: `npm test`, `npm run typecheck`, `npm run lint`, `npx next build`; sửa mọi lỗi
- [X] T063 Chạy lại toàn bộ `quickstart.md` từ bước 1 tới bước 8, ghi kết quả. Tiêu chí SC-001…SC-008 đạt.

---

## Phase 10: Đổi sang công cụ miễn phí (2026-11-23)

**Lý do**: không đăng ký được Azure, và Anthropic API tính tiền theo lượt (spec, Clarifications phiên 2026-11-23; research R3 và R9).

- [x] T064 Cài `kokoro-js` 1.2.1 và `@breezystack/lamejs` 1.2.7 (devDependency). Thêm `/tmp-audio/` vào `.gitignore`.
- [x] T065 [US5] Tạo `scripts/lib/kokoro-tts.ts` và xóa `scripts/lib/azure-tts.ts`:
  - `synthesize({ text, voice })` sinh bằng Kokoro-82M (`fp32`, `cpu`) rồi mã hóa sang mp3 24 kHz mono 48 kbps.
  - `disposeKokoro()`.
  - `content-audio.ts` bỏ giãn cách và biến Azure, thêm `--sample/--voice`. Thoát bằng `process.exitCode` để tránh crash của onnxruntime.
  - `course.yaml` dùng `ttsVoice: af_heart`; `schema.ts` kiểm tên giọng Kokoro (có test).
- [x] T066 [US4] Tạo skill `.claude/skills/soan-bai/SKILL.md` theo `contracts/cli.md`.
- [x] T067 [US4] Gỡ `scripts/content-draft.ts`, lệnh npm `content:draft`, `generateLessonDraft` trong `src/lib/ai.ts`, và `src/lib/content/draft.ts` kèm test.
- [x] T068 Cập nhật spec, research, plan, contracts, quickstart, data-model, README, DECISIONS, `.env.example`, `docs/speckit-plan.md`. Sửa constitution lên v1.1.1 (PATCH: ghi rõ cách soạn nháp).

---

## Dependencies & Execution Order

### Phụ thuộc giữa phase

```text
Phase 1 Setup ─► Phase 2 Foundational ─► US1 (P1) ─► US2 (P1) ─┬─► US3 (P2)
                                                               ├─► US5 (P2)
                                                               ├─► US4 (P2)
                                                               └─► US6 (P3)  ─► Phase 9 Polish
```

- **US1** cần Phase 2 (schema DB, parse).
- **US2** cần parse (Phase 2). Ghép vào import (T031) cần US1. Phần thuần (T025–T029) làm song song được với US1.
- **US3** cần sync và import của US1, cộng `words.ts` của US2.
- **US5** cần import (US1) để có `tts_voice` và câu trong DB. Không phụ thuộc US3 về logic, nhưng âm thanh từ vựng chỉ có sau US3.
- **US4** cần `parseContent` + `validateContent` (US2). Không cần DB.
- **US6** cần import (US1) và báo cáo kiểm tra (T050 ở US2). Phần player preview (T051) làm sớm được.
- **T058 (constitution)** đã làm trong Phase 2, trước mọi thay đổi code, nên không commit nào trái constitution.

### Trong mỗi story

Test viết trước và thất bại → hàm thuần → script I/O → ghép → kiểm chứng.

### Cơ hội song song

- Phase 1: T002, T004 song song sau T001.
- Phase 2: T009, T010, T011, T013, T014 song song; T012 sau T009–T011; T006 → T007 → T008 tuần tự sau T005.
- US1: T015, T016, T018 song song; T017 sau T015.
- US2: T025, T026, T027 song song; có thể làm cùng lúc với US1 vì khác file.
- US5: T040, T041 song song với T038–T039.
- US6: T051 song song với T052; T052 → T053 → T054 tuần tự (cùng nhóm file admin).
- Phase 9: T059, T060, T061 song song.

### Ví dụ chạy song song

```text
# Phase 2, sau T005–T008:
T009 types.ts  |  T010 schema.ts  |  T011 parse.test.ts  |  T013 load-files.ts  |  T014 report.ts

# US1 + phần thuần của US2 cùng lúc:
T015 sync.test.ts  |  T016 content/a1-starter/*  |  T025 fixtures  |  T026 words.test.ts
```

---

## Implementation Strategy

### MVP (P1: US1 + US2)

1. Phase 1 → Phase 2.
2. US1: nội dung mẫu thành file, import idempotent. **Dừng và kiểm chứng** quickstart bước 3–4.
3. US2: bộ kiểm tra đầy đủ và báo cáo kiểm tra. **Dừng và kiểm chứng** quickstart bước 2, 5.
4. Commit và gộp được ở đây nếu cần (constitution v1.1.0 đã có từ Phase 2).

### Tăng dần

5. US3 từ vựng → US5 âm thanh → US4 AI nháp → US6 admin. Mỗi bước có checkpoint kiểm chứng riêng, commit sau mỗi story.
6. Phase 9: tài liệu, cổng chất lượng, chạy lại quickstart, rồi gộp vào `main`.

### Ghi chú

- Commit sau mỗi task hoặc nhóm task hợp lý, trên nhánh `feat/001-content-pipeline`.
- Không sửa tay migration đã sinh (T006).
- Cần `SUPABASE_SECRET_KEY` trước T044. T049 chạy trong Claude Code, không cần khóa API.
