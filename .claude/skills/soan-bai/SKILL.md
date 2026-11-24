---
name: "soan-bai"
description: "Soạn nháp một bài học EngGo thành file YAML trong content/ (thay cho lệnh content:draft cũ, không gọi Anthropic API). Dùng khi người dùng gõ /soan-bai hoặc nhờ soạn, viết, thêm bài học mới cho một unit."
argument-hint: "<khóa> <unit> \"<chủ đề>\" <từ 1, từ 2, …> [số câu] [dạng bài]"
user-invocable: true
disable-model-invocation: false
---

# Soạn nháp bài học

Viết **một** file bài YAML nháp để người dùng duyệt bằng `git diff` rồi tự chạy `npm run content:import`.
Nguyên tắc IV của constitution: AI chỉ soạn nháp. Không bao giờ chạy `content:import` hay ghi database
trong skill này.

## Đầu vào

Đọc từ lời người dùng (hỏi lại nếu thiếu khóa, unit hoặc chủ đề):

- **khóa**: `id` trong `content/<…>/course.yaml`, ví dụ `a1-starter`
- **unit**: `id` trong `unit.yaml`, ví dụ `greetings`
- **chủ đề**: ví dụ "Chào buổi sáng ở văn phòng"; tên bài mặc định là chủ đề
- **từ trọng tâm**: danh sách từ hoặc cụm từ bài phải dạy
- tùy chọn: **số câu** (mặc định 8, tối đa 20), **dạng bài** (mặc định trộn cả 6 dạng), **id bài**

## Các bước

1. **Đọc ngữ cảnh**
   - `specs/001-lesson-content-pipeline/contracts/content-format.md`: định dạng file.
   - `course.yaml` của khóa: `level`, `commonWords`, `names`.
   - `unit.yaml` của unit này và mọi unit đứng trước nó trong `course.units`. Từ vựng của các
     unit này cộng với `commonWords` và `names` là **từ đã học**.
   - Một hai file bài có sẵn trong unit, để giữ cùng giọng văn.

2. **Kiểm từ trọng tâm.** Từ trọng tâm nào chưa có trong từ đã học thì thêm vào `vocabulary` của
   `unit.yaml` này, kèm `meaning` tiếng Việt và `example` nếu hợp. Thêm `forms` cho dạng bất quy tắc,
   ví dụ `forms: [went, gone]`. Báo cho người dùng những từ đã thêm.

3. **Chọn id và tên file**
   - id bài: chữ thường không dấu, số, gạch nối, duy nhất trong cả khóa.
   - Tên file: `<NN>-<id>.yaml` trong thư mục unit. `NN` là số thứ tự tiếp theo, 2 chữ số.
   - Không ghi đè file có sẵn trừ khi người dùng bảo.

4. **Viết file bài** theo các quy tắc ở mục sau. Đầu file có hai dòng ghi chú:
   ```yaml
   # Nháp do AI (Claude Code, /soan-bai) soạn: <chủ đề>
   # Duyệt bằng git diff, sửa nếu cần, rồi chạy npm run content:check và npm run content:import.
   ```
   Trong file đặt `published: false`, và mỗi câu đều có `aiGenerated: true`.

5. **Thêm id bài vào cuối `lessons:` của `unit.yaml`.** Sửa đúng dòng đó, giữ nguyên ghi chú và
   định dạng còn lại.

6. **Chạy `npm run content:check` và sửa cho đến khi sạch.**
   - Lỗi `unknown_word`: thay từ khác, hoặc thêm từ vào vocabulary nếu đúng là từ bài cần dạy.
   - Chỉ dùng `exceptions` (kèm `reason`) cho tên món ăn, địa danh và những trường hợp tương tự.
   - Không tắt hay lách quy tắc kiểm tra.

7. **Báo kết quả**
   - Đường dẫn file mới, số câu theo từng dạng, những từ đã thêm vào vocabulary.
   - Nhắc người dùng: xem `git diff`, chạy `npm run content:import`, rồi `npm run content:audio` nếu
     bài có câu nghe.
   - Nhắc thêm: bật xuất bản bài ở `/admin` sau khi đã xem trước.

## Quy tắc soạn câu

- **Trình độ:** đúng CEFR của khóa. Câu ngắn, tự nhiên, đúng ngữ pháp, gần với tình huống của
  người Việt đi học, đi làm.
- **Ngôn ngữ:** `prompt` và `explanation` viết bằng tiếng Việt; phần cần học viết bằng tiếng Anh.
  Mỗi câu **bắt buộc** có `explanation` ngắn, nói vì sao đáp án đúng.
- **Từ được dùng:** chữ tiếng Anh chỉ dùng từ đã học cộng từ trọng tâm. Được dùng dạng số nhiều,
  -ing, -ed và dạng rút gọn của chúng. Tên riêng chỉ lấy trong `names`.
- **Đề bài:** khi nhắc tới từ tiếng Anh, đặt nó trong ngoặc kép “…”.
- **Đáp án duy nhất:** mỗi câu chỉ có **đúng một** đáp án hợp lý. Đáp án sai phải sai rõ ràng,
  không được là đáp án cũng chấp nhận được.
- **Không trùng:** không lặp lại cùng một câu. `id` câu viết dạng gạch nối, nói lên nội dung câu, ví dụ
  `good-morning-listen`.
- **Thứ tự:** chia đều các dạng bài, sắp từ dễ đến khó. Câu đầu tiên giới thiệu từ trọng tâm.

### Từng dạng bài

Schema chuẩn nằm ở `src/lib/exercises/types.ts`.

- **`multiple_choice`:** 3–4 lựa chọn dạng `{ text: … }`; `answerIndex` đếm từ 0.
- **`listen_select`:**
  - `audioText` là câu hoặc từ tiếng Anh sẽ được đọc lên.
  - `choices` có 3 lựa chọn: hoặc toàn nghĩa tiếng Việt, hoặc toàn câu tiếng Anh.
- **`listen_type`:**
  - `audioText` và `answer` giống nhau, đều là tiếng Anh.
  - `acceptable` là các cách viết khác vẫn đúng, ví dụ dạng rút gọn. Không lặp lại `answer`.
- **`word_bank`:**
  - `answer` là các từ của câu đúng, theo thứ tự.
  - `distractors` gồm 1–3 từ không trùng từ nào trong `answer`, và không ghép được thành câu đúng khác.
- **`match_pairs`:** 4–5 cặp từ tiếng Anh ↔ nghĩa tiếng Việt, không vế nào trùng nhau.
- **`fill_blank`:**
  - `sentence` có đúng một `___`.
  - `choices` chứa đáp án đúng đúng một lần, cộng 2–3 đáp án sai.

Mẫu tham khảo: `content/a1-starter/01-greetings/01-hello.yaml`.
