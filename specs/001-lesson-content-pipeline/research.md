# Research: Quy trình nội dung bài học (001)

Mỗi mục: **Quyết định** · **Lý do** · **Phương án đã cân nhắc**.

## R1. Thư viện đọc YAML

- **Quyết định**: dùng gói `yaml` (eemeli/yaml, v2.x), không phụ thuộc gói nào khác.
- **Lý do**: `parseDocument` + `LineCounter` cho vị trí (dòng, cột) của từng node, nên lỗi Zod (đường dẫn như `exercises[3].data.answerIndex`) đổi được ra số dòng trong file (FR-008). `stringify` giữ được thứ tự khóa và chuỗi nhiều dòng (`|`), cần cho file nháp AI dễ đọc trong diff.
- **Đã cân nhắc**: `js-yaml` (đã có trong `node_modules` nhưng chỉ là phụ thuộc gián tiếp, không cho vị trí node khi file hợp lệ, chỉ báo dòng khi lỗi cú pháp); tự viết parser (không đáng).

## R2. Chạy script dùng lại code server (`server-only`)

- **Vấn đề**: `src/db/index.ts`, `src/lib/ai.ts` import `server-only`; ngoài môi trường React Server gói này ném lỗi, nên script `tsx` không import thẳng được.
- **Quyết định**: chạy mọi script nội dung bằng `tsx --conditions=react-server`. Với điều kiện này `server-only` trỏ tới file rỗng, script dùng chung `db` và `ai` với app, không phải nhân đôi cấu hình kết nối hay prompt.
- **Lý do**: không phải tách module, không đổi hành vi app. Script không import React nên điều kiện `react-server` không ảnh hưởng gì khác.
- **Đã cân nhắc**: tách `ai.ts` thành phần lõi không `server-only` cộng một lớp bọc (thêm file, dễ lệch); tự tạo kết nối Drizzle riêng như `scripts/seed.ts` hiện nay (nhân đôi cấu hình pooler).

## R3. Nhà cung cấp TTS: Azure Speech

- **Quyết định**: Azure AI Speech, gọi REST `POST https://<region>.tts.speech.microsoft.com/cognitiveservices/v1` với SSML, định dạng `audio-24khz-48kbitrate-mono-mp3`. Không cài SDK, dùng `fetch` có sẵn của Node.
- **Lý do** (đã chốt ở clarify):
  - Gói miễn phí F0 có giọng neural, khoảng 0,5 triệu ký tự mỗi tháng. Khóa A1 ước tính dưới 50.000 ký tự, tính năng 002 cũng dưới 100.000.
  - Xác thực chỉ cần một key và region (`AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`). Không cần project cloud, billing hay file service account như Google.
  - Có nhiều giọng en-US và en-GB tự nhiên; giọng mặc định khai báo trong `course.yaml` (ví dụ `en-US-AvaMultilingualNeural`).
- **Giới hạn cần lưu ý**: gói F0 giới hạn số yêu cầu mỗi phút (khoảng 20 yêu cầu/60 giây, xác minh lại khi tạo resource). Vì vậy script chạy tuần tự có giãn cách, gặp HTTP 429 thì chờ theo `Retry-After` rồi thử lại. Với khoảng 500 mục, lần đầu mất chừng 25 phút; các lần sau chỉ sinh phần đổi. Nếu cần nhanh hơn, nâng lên S0 (trả theo dùng, dưới 1 USD cho cả khóa) mà không phải sửa code.
- **Đã cân nhắc**: Google Cloud TTS (gói miễn phí lớn hơn nhưng cấu hình rườm rà); OpenAI/ElevenLabs (không có gói miễn phí phù hợp, thêm dịch vụ trả phí); giọng trình duyệt (chất lượng không đều giữa máy, giữ làm đường lùi).

## R4. Lưu âm thanh: Supabase Storage

- **Quyết định**: bucket công khai `lesson-audio`. Đường dẫn theo nội dung: `<course-slug>/<sha256>.mp3`, trong đó `sha256 = hash(giọng + "\n" + văn bản đọc)`. Script upload bằng `@supabase/supabase-js` (đã có) với `SUPABASE_SECRET_KEY` (chỉ dùng trong script, không có tiền tố `NEXT_PUBLIC_`). Script tự tạo bucket nếu chưa có.
- **Lý do**: đặt tên theo hash nên chạy lại không sinh trùng. Cùng một câu (ví dụ từ vựng "hello" và câu nghe "Hello") chỉ sinh một file. Lỗi giữa chừng không để lại đường dẫn hỏng, vì DB chỉ được cập nhật sau khi upload xong (FR-027). Nội dung bài học công khai nên bucket công khai không vi phạm quyền riêng tư.
- **Đã cân nhắc**: lưu file trong `public/` của repo (làm repo nặng, phải deploy lại mỗi lần đổi); bucket riêng tư kèm signed URL (thừa với nội dung công khai).

## R5. Nhận diện ổn định và đồng bộ

- **Quyết định**:
  - Khóa nhận diện bằng `slug` (đã có).
  - Unit nhận diện bằng `key`, duy nhất trong khóa.
  - Bài nhận diện bằng `content_key = "<course-slug>/<lesson-id>"`, duy nhất toàn hệ thống. Nhờ vậy chuyển bài sang unit khác không đổi khóa.
  - Câu hỏi nhận diện bằng `key`, duy nhất trong bài.
  - Import tính kế hoạch thay đổi bằng hàm thuần `planSync(nội dung đã kiểm, ảnh chụp DB)`, rồi áp dụng trong một transaction Drizzle.
- **Lý do**: tách phần quyết định (thuần, test được) khỏi phần ghi (I/O). Một transaction bảo đảm import "tất cả hoặc không" (FR-012). Chế độ chạy thử chỉ in kế hoạch.
- **Hệ quả cho schema**: bỏ hai unique index `(course_id, sort_order)` và `(unit_id, sort_order)`. Đổi thứ tự trong cùng transaction sẽ va chạm tạm thời, và các mục đã gỡ vẫn giữ số thứ tự cũ. Thứ tự vẫn được kiểm ở tầng file: số thứ tự lấy theo vị trí trong danh sách, nên không thể trùng.
- **Gỡ thay vì xóa**: unit, bài, câu, từ không còn trong file được đặt `archived_at`; thêm lại cùng khóa thì xóa `archived_at` (khôi phục). `lesson_completions` không bị đụng tới (FR-013, FR-014).
- **Đã cân nhắc**: xóa hết rồi tạo lại như seed cũ (mất tiến độ, vi phạm FR-013); nhận diện theo đường dẫn file (đổi tên file thành bài mới); UUID viết trong file (khó đọc, khó soạn tay).

## R6. Chuyển dữ liệu seed cũ

- **Quyết định**: khóa `a1-starter` trong DB hiện có các unit và bài chưa có `key`. Gặp trường hợp này, import dừng và gợi ý cờ `--replace-legacy`. Cờ này xóa khóa cũ (cascade, mất lượt hoàn thành bài của dữ liệu thử) rồi tạo lại từ file.
- **Lý do**: chưa có học viên thật (Assumptions trong spec). Một lệnh rõ ràng, chạy một lần, tốt hơn viết logic ghép bài cũ với bài mới theo tên.
- **Đã cân nhắc**: tự ghép theo tiêu đề bài (dễ sai, chỉ dùng một lần).

## R7. Trích chữ tiếng Anh và quy tắc "từ chưa học"

- **Quyết định**: nguồn chữ tiếng Anh của một câu được xác định theo dạng bài:

  | Dạng | Trường tiếng Anh |
  |---|---|
  | multiple_choice | các đoạn trong ngoặc kép “…” của `prompt`; `choices[].text` nếu ngôn ngữ lựa chọn là `en` |
  | listen_select | `audioText`; `choices` nếu ngôn ngữ lựa chọn là `en` |
  | listen_type | `audioText`, `answer`, `acceptable` |
  | word_bank | `answer`, `distractors` |
  | match_pairs | `pairs[].left` |
  | fill_blank | `sentence`, `answer`, `choices` |

  Ngôn ngữ lựa chọn (`choicesLang`) khai báo được trong file; mặc định tự nhận: chuỗi có chữ cái tiếng Việt có dấu thì coi là tiếng Việt. Từ tiếng Việt không dấu như "anh", "em" thì phải khai báo `choicesLang: vi`.
- **Chuẩn hóa token**: dùng lại `normalize()` của `src/lib/exercises/check.ts` (bỏ hoa thường, dấu câu, nháy cong), tách theo khoảng trắng và gạch nối.
  - Bỏ qua số viết bằng chữ số.
  - Bỏ qua tên riêng khai báo trong `course.yaml > names`.
  - Bỏ qua từ chung trong `course.yaml > commonWords` (mạo từ, đại từ, giới từ, trợ động từ cơ bản).
- **So khớp biến thể** (hàm thuần `candidates(token)`):
  - Dạng rút gọn: `i'm`→`i am`, `n't`→`not`, `'re`→`are`, `'s` (sở hữu/is), `'ll`, `'ve`, `'d`.
  - Hậu tố: `-s/-es/-ies→y`, `-ing` (kèm `+e` và bỏ phụ âm đôi), `-ed/-ied→y`.
  - Dạng bất quy tắc khai báo trong từ vựng: `forms: [went, gone]`.

  Token hợp lệ khi một trong các ứng viên nằm trong tập từ đã học, gồm từ của unit hiện tại, các unit trước, cụm từ và `forms` của chúng.
- **Cụm từ** trong danh sách từ vựng (ví dụ "good morning") được so theo chuỗi con sau khi chuẩn hóa. Các từ thành phần của cụm được tính là đã học.
- **Lý do**: không cần thư viện NLP. Lỗi sót (biến thể lạ) được xử lý bằng `forms` hoặc ngoại lệ có lý do (FR-008a), và hiện rõ trong diff.
- **Đã cân nhắc**: thư viện lemmatizer như `wink-lemmatizer` (thêm phụ thuộc lớn cho lợi ích nhỏ ở trình độ A1); coi mọi từ viết hoa giữa câu là tên riêng (giấu lỗi).

## R8. Phát hiện "nhiều hơn một đáp án đúng" và câu trùng

- **Nhiều đáp án** (FR-007d), so sau khi `normalize`:
  - multiple_choice / listen_select: hai lựa chọn trùng nhau.
  - word_bank: từ gây nhiễu trùng một từ trong đáp án.
  - fill_blank: `choices` chứa đáp án hơn một lần, hoặc không chứa đáp án.
  - match_pairs: vế trái hoặc vế phải trùng nhau.
  - listen_type: phần tử `acceptable` trùng `answer` chỉ là cảnh báo.
- **Câu trùng** (FR-007c): khóa so sánh là `type + normalize(prompt) + JSON chuẩn hóa của data`, so trong toàn khóa.
- **Đã cân nhắc**: dùng AI để chấm "câu mơ hồ" (tốn chi phí, kết quả không ổn định; để sau).

## R9. AI soạn nháp

- **Quyết định**:
  - Thêm hàm `generateLessonDraft()` trong `src/lib/ai.ts`, dùng lại model `AI_MODEL` (mặc định `claude-opus-5-5`) và kiểu structured output Zod "lỏng" như `generateExercises`.
  - Prompt nhận thêm từ vựng được phép (unit đích, các unit trước, `commonWords`) và yêu cầu mỗi câu có `explanation`.
  - Kết quả được dựng thành YAML bằng `yaml.stringify`, mọi câu có `aiGenerated: true`, bài có `published: false`, rồi chạy bộ kiểm tra trên file vừa ghi.
  - Bỏ `generateExercises` cùng nút AI trong `/admin` (FR-034).
- **Lý do**: dùng chung một schema chặt (constitution, Nguyên tắc III). Nháp AI đi qua đúng bộ kiểm tra của nội dung soạn tay (FR-025).
- **Đã cân nhắc**: AI ghi thẳng vào DB như hiện nay (không review được bằng diff).

## R10. Test runner

- **Quyết định**: Vitest (dev dependency), lệnh `npm test` = `vitest run`, alias `@` → `src`. Test đặt cạnh mã trong `src/lib/content/*.test.ts`. Fixture YAML đặt trong `tests/fixtures/content/<tình-huống>/`.
- **Lý do**: constitution yêu cầu unit test cho logic thuần và ghi sẵn Vitest. Vitest chạy TypeScript và ESM không cần cấu hình thêm.
- **Hệ quả**: gỡ `TODO(TEST_RUNNER)` trong constitution qua `/speckit-constitution` (bản PATCH), cùng lần sửa nêu ở R11.

## R11. Constitution, Nguyên tắc IV ("soạn qua /admin")

- **Vấn đề**: Nguyên tắc IV viết "Nội dung bài học nằm trong database và được soạn qua `/admin`". Tính năng này chuyển việc soạn sang file trong repo.
- **Quyết định**: sửa constitution lên **v1.1.0** (MINOR, định nghĩa lại cách soạn nhưng giữ tinh thần) trong cùng nhánh. Câu mới: nội dung bài học có bản gốc là file trong `content/`, được kiểm tra tự động và import vào database; `/admin` dùng để xem trước và xuất bản. Đồng thời gỡ `TODO(TEST_RUNNER)`.
- **Lý do**: Governance yêu cầu tài liệu không được mâu thuẫn với constitution. Sửa trong cùng thay đổi là đúng quy trình.

## R12. Next.js 16 cho phần quản trị

- Route xem trước `src/app/admin/lessons/[id]/preview/page.tsx`: `params` là Promise; dữ liệu theo request đặt sau `await connection()` hoặc trong `<Suspense>` (Cache Components bật), giống `/try` hiện tại.
- Bật/tắt xuất bản giữ Server Action `togglePublished` cùng `revalidatePath` (hướng dẫn trong `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md`, không có cảnh báo ngừng hỗ trợ).
- Khi implement **bắt buộc** đọc lại các mục liên quan trong `node_modules/next/dist/docs/` trước khi viết route mới (constitution).
