# Feature Specification: Quy trình nội dung bài học

**Feature Branch**: `feat/001-content-pipeline`

**Created**: 2026-11-22

**Status**: Draft

**Chế độ áp dụng**: Người lớn (chế độ Bé dùng lại cùng quy trình ở giai đoạn sau, không làm trong tính năng này)

**Input**: User description: "Quy trình nội dung bài học cho EngGo (người lớn trước, chế độ Bé dùng lại sau). Nội dung khóa học được lưu thành file trong repo (mỗi bài một file trong content/<khóa>/<unit>/), là bản gốc duy nhất; một lệnh import đồng bộ file vào database, chạy lại nhiều lần không tạo trùng. Mỗi unit có danh sách từ vựng; thêm bảng từ vựng (từ, nghĩa tiếng Việt, ví dụ, âm thanh) và nối câu hỏi với các từ nó dùng, làm nền cho ôn tập ngắt quãng sau này. Lệnh import chặn và báo rõ lỗi khi: câu sai định dạng theo schema hiện có của 6 dạng bài, câu dùng từ chưa học, câu trùng, câu có nhiều hơn một đáp án đúng, thiếu lời giải thích. Có lệnh dùng AI soạn nháp một bài từ chủ đề và danh sách từ, ghi ra file để người duyệt bằng diff trước khi import. Có lệnh sinh âm thanh TTS một lần cho mọi câu cần nghe, lưu lên kho lưu trữ và điền audio_url. Trang /admin chuyển sang vai trò xem trước, bật/tắt xuất bản và hiện lỗi kiểm tra; sửa nội dung làm trên file. Ngoài phạm vi: soạn nội dung thật của cả khóa A1 (tính năng 002), chế độ Bé."

## Bối cảnh

Hiện nội dung khóa A1 mẫu (2 unit, 4 bài) được viết cứng trong script seed, và chạy lại seed sẽ xóa rồi tạo lại cả khóa (mất tiến độ học viên gắn với bài cũ). CMS `/admin` cho sửa trực tiếp trong database nên không có lịch sử, không review được, và không có kiểm tra chất lượng. Tính năng 002 cần soạn khoảng 32 bài, 400 từ; nếu không có quy trình kiểm tra tự động thì chất lượng nội dung (rủi ro lớn nhất của dự án theo constitution, Nguyên tắc IV) không giữ được.

Người dùng chính của tính năng là **người soạn nội dung** (hiện là chính người phát triển, sau này có thể thêm giáo viên). Học viên được lợi gián tiếp: câu hỏi đúng, nhất quán, có âm thanh thật.

## Clarifications

### Session 2026-11-22

- Q: File bài học trong content/ nên viết bằng định dạng nào? → A: YAML (cho phép ghi chú, giải thích nhiều dòng; lỗi cú pháp YAML được bộ kiểm tra báo như lỗi định dạng)
- Q: Dùng dịch vụ TTS nào để sinh âm thanh cho câu nghe và từ vựng? → A: Azure Speech (gói miễn phí, giọng neural tiếng Anh). *Đã thay ở phiên 2026-11-23.*
- Q: Khi một câu dùng từ chưa học, bộ kiểm tra nên xử lý thế nào? → A: Là lỗi chặn import; mỗi câu được khai báo danh sách từ ngoại lệ kèm lý do bắt buộc
- Q: Lệnh import chạy vào database nào, và chạy khi nào? → A: Một database duy nhất; import chạy tay từ máy người soạn, in host đích và tóm tắt thay đổi rồi hỏi xác nhận trước khi ghi; có chế độ chạy thử không ghi

### Session 2026-11-23

- Q: Không đăng ký được Azure, và Anthropic API tính tiền theo lượt. Thay bằng gì mà vẫn miễn phí và giữ chất lượng? → A: Âm thanh dùng Kokoro-82M chạy trên máy (mã nguồn mở, Apache-2.0, không cần tài khoản). AI soạn nháp do Claude Code (gói đăng ký của người soạn) thực hiện qua skill `/soan-bai`, ghi thẳng file YAML, không gọi API. Hai câu trả lời này thay câu trả lời "Azure Speech" ở phiên 2026-11-22.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Soạn bài bằng file và import an toàn (Priority: P1)

Người soạn viết hoặc sửa file bài học trong thư mục nội dung của repo, chạy lệnh import, và database được cập nhật đúng theo file. Chạy lại lệnh bao nhiêu lần cũng không tạo bản trùng, và tiến độ học viên đã có không bị mất.

**Why this priority**: Đây là nền của mọi thứ khác: kiểm tra, AI nháp, TTS, xem trước đều dựa trên việc file là bản gốc và import đồng bộ được.

**Independent Test**: Chuyển 4 bài A1 mẫu thành file, chạy import vào database trống → học viên học được đủ 4 bài như trước. Sửa một câu trong file, chạy lại import → câu đó thay đổi, số bài và số câu không tăng, lượt hoàn thành bài cũ của học viên vẫn còn.

**Acceptance Scenarios**:

1. **Given** thư mục nội dung có khóa A1 với 2 unit và 4 bài hợp lệ, database chưa có khóa này, **When** chạy import và xác nhận sau khi xem host đích cùng tóm tắt, **Then** database có đúng 1 khóa, 2 unit, 4 bài với đủ câu hỏi theo thứ tự trong file, và lệnh in tóm tắt số mục đã thêm.
2. **Given** đã import một lần và không sửa file, **When** chạy import lần nữa, **Then** không có gì thay đổi trong database và lệnh báo "không có thay đổi".
3. **Given** học viên đã hoàn thành bài "Xin chào!", **When** người soạn sửa nội dung một câu của bài đó và import lại, **Then** bài vẫn là cùng một bài (lượt hoàn thành của học viên vẫn gắn với nó) và câu được cập nhật.
4. **Given** người soạn đổi thứ tự hai bài trong một unit, **When** import, **Then** thứ tự bài trong lộ trình đổi theo, không bài nào bị tạo mới.
5. **Given** người soạn xóa file một bài đã có học viên học, **When** import, **Then** bài đó bị gỡ khỏi lộ trình học viên thấy nhưng lịch sử học không bị xóa, và lệnh báo rõ bài nào đã bị gỡ.
5a. **Given** file có thay đổi, **When** chạy import ở chế độ chạy thử hoặc từ chối ở bước xác nhận, **Then** lệnh in tóm tắt thay đổi và database không đổi.
6. **Given** một file bị lỗi kiểm tra (xem Story 2), **When** chạy import, **Then** không có thay đổi nào được ghi vào database (kể cả các bài hợp lệ khác) và lệnh thoát với mã lỗi.

---

### User Story 2 - Kiểm tra chất lượng nội dung tự động (Priority: P1)

Trước khi ghi bất cứ gì, lệnh import (và một lệnh kiểm tra riêng không ghi database) đọc toàn bộ nội dung và báo từng lỗi kèm vị trí rõ ràng (file, câu số mấy, lỗi gì, gợi ý sửa) để người soạn sửa ngay trên file.

**Why this priority**: Không có kiểm tra thì soạn 32 bài ở tính năng 002 sẽ để lọt câu sai tới học viên. Kiểm tra là điều kiện để tin nội dung do AI soạn.

**Independent Test**: Chuẩn bị bộ file mẫu, mỗi file cố ý chứa đúng một loại lỗi; chạy lệnh kiểm tra → mỗi file được báo đúng loại lỗi, đúng vị trí; bộ file sạch thì báo không lỗi.

**Acceptance Scenarios**:

1. **Given** một câu dạng "chọn đáp án" có chỉ số đáp án vượt quá số lựa chọn, **When** chạy kiểm tra, **Then** báo lỗi định dạng kèm tên file, số thứ tự câu và trường bị sai.
2. **Given** bài ở unit 1 có câu chứa từ "grandmother" mà từ này chỉ có trong danh sách từ của unit 2, **When** chạy kiểm tra, **Then** báo lỗi "từ chưa học: grandmother" kèm vị trí câu.
2a. **Given** câu chứa "pho" và câu đó khai báo "pho" là từ ngoại lệ với lý do "tên món ăn", **When** chạy kiểm tra, **Then** không báo lỗi cho từ này; nếu khai báo ngoại lệ mà thiếu lý do thì báo lỗi.
3. **Given** hai câu trong cùng khóa có nội dung giống hệt nhau (cùng dạng, cùng đề, cùng đáp án), **When** chạy kiểm tra, **Then** báo lỗi trùng và chỉ ra cả hai vị trí.
4. **Given** câu "chọn đáp án" có hai lựa chọn giống nhau và một trong hai là đáp án đúng, hoặc câu "xếp từ" có từ gây nhiễu trùng với một từ trong đáp án, **When** chạy kiểm tra, **Then** báo lỗi "có thể có nhiều hơn một đáp án đúng".
5. **Given** một câu không có lời giải thích tiếng Việt, **When** chạy kiểm tra, **Then** báo lỗi thiếu giải thích.
6. **Given** nội dung có nhiều lỗi ở nhiều file, **When** chạy kiểm tra, **Then** liệt kê tất cả lỗi trong một lần chạy (không dừng ở lỗi đầu tiên), kèm tổng số lỗi.

---

### User Story 3 - Từ vựng theo unit, nối với câu hỏi (Priority: P2)

Mỗi unit khai báo danh sách từ vựng (từ, nghĩa tiếng Việt, câu ví dụ, âm thanh). Khi import, từ vựng được lưu vào database và mỗi câu hỏi được nối với các từ vựng nó sử dụng.

**Why this priority**: Là nguồn cho quy tắc "từ chưa học" của Story 2 và là nền dữ liệu cho ôn tập ngắt quãng sau này; học viên chưa thấy trực tiếp trong tính năng này.

**Independent Test**: Import khóa A1 mẫu có danh sách từ vựng → mỗi từ có trong database đúng một lần; truy vấn một câu bất kỳ trả về đúng các từ nó dùng; truy vấn một từ trả về các câu dùng nó.

**Acceptance Scenarios**:

1. **Given** unit "Chào hỏi" khai báo 15 từ, **When** import, **Then** database có 15 từ vựng gắn với unit đó, mỗi từ có nghĩa tiếng Việt.
2. **Given** câu "Nice to meet you." trong unit 1, **When** import, **Then** câu được nối với các từ vựng "nice", "meet", "you" (và các từ khác của câu có trong danh sách).
3. **Given** cùng một từ được khai báo ở hai unit khác nhau trong một khóa, **When** chạy kiểm tra, **Then** báo lỗi từ khai báo trùng và chỉ ra hai unit.
4. **Given** người soạn sửa nghĩa của một từ trong file, **When** import lại, **Then** từ đó được cập nhật, không tạo từ mới, các liên kết câu ↔ từ vẫn giữ.

---

### User Story 4 - AI soạn nháp một bài thành file (Priority: P2)

Người soạn gọi skill `/soan-bai` trong Claude Code với chủ đề, unit đích và danh sách từ; AI tạo một file bài học nháp đúng định dạng trong thư mục nội dung. Người soạn xem nháp bằng diff trong git, sửa nếu cần, rồi mới import. Câu do AI tạo được đánh dấu là do AI tạo.

**Why this priority**: Tăng tốc soạn nội dung cho tính năng 002, nhưng quy trình vẫn chạy được (soạn tay) nếu chưa có.

**Independent Test**: Gọi `/soan-bai` với chủ đề "Chào buổi sáng", unit 1, 8 từ → có một file mới, chưa có gì trong database; file đó qua được lệnh kiểm tra hoặc báo rõ lỗi cần sửa; sau khi import, các câu mang dấu "do AI tạo" và bài chưa xuất bản.

**Acceptance Scenarios**:

1. **Given** Claude Code đang mở trong repo, **When** gọi `/soan-bai` với chủ đề, unit và danh sách từ, **Then** một file bài mới được ghi vào thư mục của unit đó, database không thay đổi, và AI báo đường dẫn file cùng kết quả `content:check`.
2. **Given** đã có file cùng tên ở vị trí đích, **When** soạn nháp, **Then** AI không ghi đè mà tạo tên khác hoặc dừng và báo, trừ khi người soạn yêu cầu ghi đè rõ ràng.
3. **Given** bản nháp đầu có câu sai định dạng hoặc dùng từ ngoài phạm vi, **When** AI chạy `content:check`, **Then** AI sửa file cho đến khi sạch; lỗi nào không tự sửa được thì báo rõ cho người soạn.
4. **Given** không có Claude Code, **When** cần bài mới, **Then** người soạn vẫn soạn tay được theo cùng định dạng; quy trình không phụ thuộc dịch vụ AI trả phí theo lượt.
5. **Given** bài nháp do AI tạo được import, **When** xem trong database, **Then** các câu được đánh dấu do AI tạo và bài ở trạng thái chưa xuất bản.

---

### User Story 5 - Sinh âm thanh một lần cho các câu cần nghe (Priority: P2)

Người soạn chạy một lệnh sinh âm thanh đọc (TTS) cho mọi câu dạng nghe và mọi từ vựng chưa có âm thanh hoặc có nội dung đọc đã đổi; file âm thanh được lưu lên kho lưu trữ và câu/từ được điền đường dẫn âm thanh. Học viên nghe giọng đọc thật thay vì giọng của trình duyệt.

**Why this priority**: Cải thiện rõ chất lượng phần nghe, nhưng app vẫn chạy nhờ giọng trình duyệt khi chưa có âm thanh.

**Independent Test**: Sau khi import khóa A1 mẫu, chạy lệnh sinh âm thanh → mọi câu dạng nghe và mọi từ vựng có đường dẫn âm thanh phát được; chạy lại lệnh → không sinh lại gì.

**Acceptance Scenarios**:

1. **Given** có 6 câu dạng nghe chưa có âm thanh, **When** chạy lệnh, **Then** 6 file âm thanh được tạo và lưu, 6 câu có đường dẫn âm thanh, lệnh in số lượng đã sinh.
2. **Given** tất cả câu đã có âm thanh và nội dung đọc không đổi, **When** chạy lệnh lần nữa, **Then** không gọi dịch vụ TTS lần nào.
3. **Given** người soạn sửa câu cần đọc của một câu dạng nghe rồi import, **When** chạy lệnh, **Then** chỉ câu đó được sinh lại âm thanh.
4. **Given** dịch vụ TTS lỗi giữa chừng, **When** lệnh dừng, **Then** những câu đã sinh xong vẫn giữ âm thanh, câu chưa sinh không bị điền đường dẫn hỏng, chạy lại lệnh sẽ tiếp tục phần còn thiếu.
5. **Given** câu đã có âm thanh, **When** học viên làm câu đó, **Then** player phát file âm thanh; nếu câu chưa có âm thanh thì vẫn dùng giọng trình duyệt như hiện nay.

---

### User Story 6 - Trang quản trị để xem trước và xuất bản (Priority: P3)

Quản trị viên vào `/admin` để xem cây khóa → unit → bài như học viên sẽ thấy, mở xem trước từng bài, bật/tắt xuất bản bài và khóa, và xem lỗi kiểm tra gần nhất. Trang quản trị không còn cho sửa nội dung câu hỏi; mọi sửa nội dung làm trên file.

**Why this priority**: Tiện cho việc duyệt, nhưng lệnh import và kiểm tra đã đủ để làm việc; có thể làm sau cùng.

**Independent Test**: Import khóa A1 mẫu với một bài chưa xuất bản → học viên không thấy bài đó; quản trị viên xem trước được bài, bấm xuất bản → học viên thấy bài.

**Acceptance Scenarios**:

1. **Given** quản trị viên đã đăng nhập, **When** mở `/admin`, **Then** thấy danh sách khóa, unit, bài, trạng thái xuất bản, số câu, số câu do AI tạo và số câu có âm thanh của từng bài.
2. **Given** một bài chưa xuất bản, **When** quản trị viên mở xem trước, **Then** chơi được bài đó y như học viên nhưng không ghi tiến độ, XP hay tim.
3. **Given** một bài chưa xuất bản, **When** quản trị viên bật xuất bản, **Then** học viên thấy bài trong lộ trình; tắt xuất bản thì bài biến mất khỏi lộ trình học viên.
4. **Given** quản trị viên đã xuất bản một bài, **When** chạy import lại (file không đổi trạng thái xuất bản), **Then** bài vẫn ở trạng thái đã xuất bản.
5. **Given** lần kiểm tra gần nhất có lỗi, **When** mở `/admin`, **Then** thấy danh sách lỗi kèm file và vị trí câu, cùng thời điểm kiểm tra.
6. **Given** người dùng không phải quản trị viên, **When** truy cập `/admin` hoặc trang xem trước, **Then** bị chặn như hiện nay.
7. **Given** quản trị viên ở trang bài học, **When** tìm chỗ sửa câu hỏi, **Then** không có ô sửa nội dung; thay vào đó có ghi chú đường dẫn file nguồn của bài.

---

### Edge Cases

- **Đổi tên file hoặc chuyển bài sang unit khác**: bài được nhận diện bằng mã định danh khai báo trong file (không bằng tên file hay vị trí), nên đổi tên hoặc di chuyển không tạo bài mới và không mất tiến độ học viên.
- **Hai file khai báo cùng mã định danh bài**: lỗi kiểm tra, chỉ ra cả hai file.
- **Thư mục nội dung rỗng hoặc thiếu file khai báo khóa/unit**: lỗi kiểm tra rõ ràng, không xóa gì trong database.
- **Khóa có trong database nhưng không có trong thư mục nội dung** (ví dụ khóa tạo trước khi có quy trình này): import không động tới, chỉ báo cảnh báo.
- **Từ chưa học với biến thể từ**: so khớp không phân biệt hoa thường, bỏ dấu câu; các biến thể ngữ pháp thường gặp (số nhiều, -ing, -ed, sở hữu 's, dạng rút gọn như "I'm", "don't") được tính là cùng từ gốc nếu từ gốc đã học; số viết bằng chữ số, tên riêng khai báo ở cấp khóa và một danh sách từ chức năng chung cấp khóa được bỏ qua. Tên riêng chưa khai báo vẫn bị báo là từ chưa học, để tránh che lỗi.
- **Câu dạng ghép cặp**: không áp dụng quy tắc "nhiều đáp án đúng" theo kiểu chọn đáp án, nhưng vế trái hoặc vế phải trùng nhau trong cùng câu là lỗi.
- **Câu điền chỗ trống có nhiều chỗ trống hoặc không có chỗ trống**: lỗi định dạng.
- **Câu dạng gõ (nghe rồi gõ, điền chỗ trống không có lựa chọn)**: đáp án chấp nhận thêm được khai báo; trùng với đáp án chính không phải lỗi nhưng được cảnh báo.
- **Bài bị gỡ (file đã xóa) rồi thêm lại với cùng mã định danh**: bài được khôi phục, lịch sử học viên vẫn gắn.
- **Lượt học viên đang làm dở khi import chạy**: lượt đó được chấm theo nội dung lúc nộp; không cần cơ chế đặc biệt.
- **Âm thanh của câu đã bị xóa khỏi file**: file âm thanh cũ có thể còn trên kho lưu trữ; không bắt buộc dọn trong tính năng này.

## Requirements *(mandatory)*

### Functional Requirements

**Nội dung dạng file**

- **FR-001**: Nội dung khóa học MUST được lưu thành file YAML trong repo theo cấu trúc `content/<khóa>/<unit>/`, mỗi bài một file; file không đọc được (sai cú pháp YAML) là lỗi định dạng kèm số dòng; mỗi khóa và mỗi unit có một file khai báo thông tin (tên, mô tả, thứ tự, trình độ, đối tượng; với unit thêm danh sách từ vựng).
- **FR-002**: Mỗi khóa, unit, bài và câu hỏi MUST có mã định danh ổn định khai báo trong file, duy nhất trong phạm vi của nó; đây là khóa để đồng bộ với database.
- **FR-003**: Định dạng mỗi câu hỏi MUST dùng đúng cấu trúc dữ liệu hiện có của 6 dạng bài (chọn đáp án, nghe rồi chọn, nghe rồi gõ, xếp từ, ghép cặp, điền chỗ trống), cộng thêm đề bài, lời giải thích tiếng Việt và các trường tùy chọn (hình ảnh, đáp án chấp nhận thêm, cờ do AI tạo).
- **FR-004**: File nội dung là bản gốc duy nhất cho nội dung bài học: không còn đường nào khác (seed viết cứng, form sửa trong `/admin`) để thay đổi đề, đáp án, giải thích hay từ vựng trong database.
- **FR-005**: Khóa A1 mẫu hiện có (2 unit, 4 bài) MUST được chuyển sang dạng file, kèm danh sách từ vựng cho từng unit, và thay thế cách tạo dữ liệu mẫu hiện tại.

**Kiểm tra**

- **FR-006**: Hệ thống MUST có lệnh kiểm tra đọc toàn bộ thư mục nội dung và báo lỗi mà không ghi database; lệnh import MUST chạy cùng bộ kiểm tra này trước khi ghi.
- **FR-007**: Bộ kiểm tra MUST phát hiện: (a) câu sai định dạng theo dạng bài; (b) câu dùng từ chưa học, tức không thuộc danh sách từ của unit đó hoặc các unit đứng trước trong cùng khóa, theo quy tắc so khớp ở mục Edge Cases; (c) câu trùng trong cùng khóa; (d) câu có thể có nhiều hơn một đáp án đúng (lựa chọn trùng nhau, từ gây nhiễu trùng từ đáp án, lựa chọn của câu điền chỗ trống chứa đáp án hơn một lần, vế ghép cặp trùng); (e) thiếu lời giải thích; (f) mã định danh trùng; (g) từ vựng khai báo trùng giữa các unit của một khóa; (h) thiếu file khai báo khóa hoặc unit.
- **FR-008**: Mỗi lỗi MUST ghi rõ đường dẫn file, vị trí câu (mã định danh và số thứ tự), loại lỗi, và mô tả bằng tiếng Việt đủ để sửa mà không phải đọc code. Lệnh MUST liệt kê mọi lỗi trong một lần chạy và trả mã thoát khác 0 nếu có lỗi.
- **FR-008a**: Một câu MAY khai báo danh sách từ ngoại lệ, mỗi từ kèm lý do bắt buộc (ví dụ "tên món ăn"); từ ngoại lệ không bị tính là "từ chưa học" cho câu đó và không được nối vào bảng từ vựng. Ngoại lệ thiếu lý do là lỗi. Lệnh kiểm tra MUST in tổng số từ ngoại lệ đang dùng.
- **FR-009**: Bộ kiểm tra MUST phân biệt **lỗi** (chặn import) và **cảnh báo** (không chặn, ví dụ đáp án chấp nhận thêm trùng đáp án chính, khóa trong database không có trong thư mục).
- **FR-010**: Mỗi lần chạy import (kể cả khi bị chặn vì lỗi hoặc người soạn từ chối xác nhận), kết quả kiểm tra (thời điểm, danh sách lỗi và cảnh báo) MUST được lưu để trang quản trị hiển thị; việc lưu này tách khỏi phần ghi nội dung của FR-012. Lệnh kiểm tra riêng không ghi gì vào database.

**Import**

- **FR-011**: Lệnh import MUST đồng bộ database theo file: thêm mục mới, cập nhật mục đã đổi, giữ nguyên mục không đổi; chạy lại khi file không đổi MUST không tạo thay đổi nào.
- **FR-012**: Import MUST là tất cả hoặc không: nếu kiểm tra có lỗi hoặc ghi lỗi giữa chừng, database giữ nguyên như trước khi chạy.
- **FR-013**: Import MUST giữ nguyên tiến độ học viên (lượt hoàn thành bài, XP, chuỗi ngày) khi bài được sửa, đổi thứ tự, đổi tên file hoặc chuyển unit.
- **FR-014**: Bài, unit hoặc câu không còn trong file MUST được gỡ khỏi những gì học viên thấy mà không xóa lịch sử học của học viên; lệnh MUST liệt kê các mục bị gỡ.
- **FR-015**: Trạng thái xuất bản do trang quản trị quyết định; import MUST không tự đổi trạng thái xuất bản của bài hay khóa đã có. Bài và khóa mới import lần đầu mặc định chưa xuất bản, trừ khi file khai báo rõ là xuất bản.
- **FR-016**: Import MUST in tóm tắt: số khóa, unit, bài, câu, từ vựng sẽ thêm / sửa / gỡ.
- **FR-016a**: Trước khi ghi, import MUST in host database đích cùng tóm tắt FR-016 và chỉ ghi khi người soạn xác nhận; MUST có chế độ chạy thử chỉ in tóm tắt, không ghi; MUST có cờ bỏ qua bước hỏi cho trường hợp chạy không tương tác. Khi tóm tắt cho thấy không có thay đổi thì không hỏi.
- **FR-017**: Import MUST giữ đường dẫn âm thanh đã sinh cho câu và từ có nội dung đọc không đổi; khi nội dung đọc thay đổi, đường dẫn cũ MUST bị đánh dấu cần sinh lại.

**Từ vựng**

- **FR-018**: Hệ thống MUST lưu từ vựng gồm: từ, nghĩa tiếng Việt, câu ví dụ, đường dẫn âm thanh, unit mà từ được giới thiệu.
- **FR-019**: Khi import, mỗi câu hỏi MUST được nối với các từ vựng xuất hiện trong nội dung tiếng Anh của câu (đề tiếng Anh, đáp án, nội dung đọc, câu xếp từ, vế ghép cặp), theo cùng quy tắc so khớp của FR-007(b).
- **FR-020**: Có thể truy vấn được cả hai chiều: từ một câu ra các từ vựng của nó, và từ một từ vựng ra các câu dùng nó.

**AI soạn nháp**

- **FR-021**: Hệ thống MUST có skill Claude Code `/soan-bai` nhận chủ đề, khóa/unit đích, danh sách từ (và tùy chọn số câu, các dạng bài mong muốn) và tạo một file bài học nháp đúng định dạng FR-003 trong thư mục của unit đích, thêm id bài vào file unit. Soạn nháp MUST không phát sinh chi phí theo lượt (không gọi API AI trả phí).
- **FR-022**: Soạn nháp MUST không ghi gì vào database, MUST không ghi đè file có sẵn trừ khi được yêu cầu rõ, và MUST chạy bộ kiểm tra trên file vừa tạo rồi báo kết quả.
- **FR-023**: Câu do AI tạo MUST mang cờ "do AI tạo" trong file; cờ này MUST được giữ khi import. Bài nháp do AI tạo MUST ở trạng thái chưa xuất bản.
- **FR-024**: Quy trình MUST chạy được khi không có AI: người soạn viết file tay theo cùng định dạng và cùng bộ kiểm tra.
- **FR-025**: AI MUST chỉ được dùng từ trong danh sách từ đã cho cùng từ của các unit trước; kết quả MUST đi qua cùng bộ kiểm tra như nội dung soạn tay.

**Âm thanh**

- **FR-026**: Hệ thống MUST có lệnh sinh âm thanh đọc cho mọi câu dạng nghe (nghe rồi chọn, nghe rồi gõ) và mọi từ vựng chưa có âm thanh hoặc cần sinh lại; file âm thanh được lưu lên kho lưu trữ công khai đọc được và đường dẫn được điền vào câu/từ tương ứng.
- **FR-027**: Lệnh sinh âm thanh MUST không sinh lại nội dung đã có âm thanh còn hợp lệ, MUST tiếp tục được sau khi bị gián đoạn, và MUST in số lượng đã sinh / bỏ qua / lỗi.
- **FR-028**: Âm thanh MUST là giọng tiếng Anh tự nhiên do mô hình Kokoro chạy trên máy người soạn sinh (miễn phí, không cần tài khoản), cùng một giọng cho cả khóa (giọng khai báo ở file khóa, kiểm tra tên giọng khi `content:check`). Thiếu khóa Storage thì lệnh dừng với thông báo dễ hiểu, không điền đường dẫn nào; app vẫn dùng giọng trình duyệt (FR-029). Lệnh MUST có chế độ nghe thử một câu với một giọng mà không ghi gì lên Storage hay database.
- **FR-029**: Màn học MUST phát âm thanh đã sinh khi có, và vẫn dùng giọng của trình duyệt khi chưa có.

**Trang quản trị**

- **FR-030**: Trang `/admin` MUST hiển thị cây khóa → unit → bài với trạng thái xuất bản, số câu, số câu do AI tạo, số câu có âm thanh, và đường dẫn file nguồn của bài.
- **FR-031**: Quản trị viên MUST xem trước được mọi bài (kể cả chưa xuất bản) như học viên, không ghi tiến độ, XP, tim hay chuỗi ngày.
- **FR-032**: Quản trị viên MUST bật/tắt được xuất bản cho bài và cho khóa; thay đổi có hiệu lực ngay với học viên.
- **FR-033**: Trang quản trị MUST hiển thị kết quả kiểm tra gần nhất (FR-010).
- **FR-034**: Trang quản trị MUST không còn chức năng tạo, sửa, xóa câu hỏi, bài, unit hay khóa, và MUST không còn nút "AI tạo bản nháp" ghi thẳng vào database (thay bằng skill của FR-021).
- **FR-035**: Mọi chức năng của trang quản trị và xem trước MUST chỉ dành cho quản trị viên, như cơ chế hiện có.

### Key Entities

- **Khóa học (Course)**: một khóa như "Tiếng Anh A1: Khởi đầu"; mã định danh, tên, mô tả, trình độ, đối tượng (người lớn / bé), thứ tự, trạng thái xuất bản. Gồm nhiều unit.
- **Unit**: một chủ đề trong khóa; mã định danh, tên, mô tả, thứ tự, danh sách từ vựng được giới thiệu. Gồm nhiều bài.
- **Bài học (Lesson)**: mã định danh, tên, thứ tự trong unit, XP thưởng, trạng thái xuất bản, trạng thái gỡ (không còn trong file), đường dẫn file nguồn. Gồm nhiều câu hỏi.
- **Câu hỏi (Exercise)**: mã định danh, thứ tự, dạng bài, đề, dữ liệu theo dạng bài, lời giải thích, hình ảnh (tùy chọn), âm thanh (tùy chọn), cờ do AI tạo, trạng thái gỡ. Nối nhiều-nhiều với Từ vựng.
- **Từ vựng (Vocabulary item)**: từ (hoặc cụm từ ngắn), nghĩa tiếng Việt, câu ví dụ, âm thanh, unit giới thiệu từ. Là nền cho ôn tập ngắt quãng sau này.
- **Liên kết Câu hỏi – Từ vựng**: câu nào dùng từ nào.
- **Kết quả kiểm tra (Validation report)**: thời điểm chạy, danh sách lỗi và cảnh báo (file, vị trí, loại, mô tả).
- **Lượt hoàn thành bài (đã có)**: gắn với bài học; MUST không bị mất khi import.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 4 bài A1 mẫu được chuyển thành file, import vào database trống không có lỗi kiểm tra, và học viên học được cả 4 bài với kết quả như trước khi chuyển.
- **SC-002**: Chạy import 3 lần liên tiếp trên cùng bộ file cho ra số khóa, unit, bài, câu, từ vựng không đổi sau lần đầu, và lần 2, 3 báo không có thay đổi.
- **SC-003**: Sau khi sửa, đổi thứ tự hoặc đổi tên file bài đã có người học rồi import lại, 100% lượt hoàn thành bài của học viên vẫn còn và vẫn gắn đúng bài.
- **SC-004**: Với bộ file mẫu cố ý chứa mỗi loại lỗi ở FR-007, bộ kiểm tra phát hiện đúng 100% lỗi, báo đúng file và vị trí, và không báo lỗi nào trên bộ nội dung sạch.
- **SC-005**: Người soạn đi được trọn vòng một bài mới bằng AI (soạn nháp → xem diff → sửa → kiểm tra → import → xuất bản → nghe được âm thanh) trong dưới 15 phút, không cần mở database hay sửa code.
- **SC-006**: 100% câu dạng nghe và từ vựng của khóa A1 mẫu có âm thanh phát được sau một lần chạy lệnh sinh âm thanh; lần chạy thứ hai không sinh thêm file nào.
- **SC-007**: Kiểm tra toàn bộ một khóa cỡ tính năng 002 (32 bài, khoảng 300 câu, 400 từ) hoàn tất trong dưới 10 giây trên máy phát triển.
- **SC-008**: Không còn cách nào sửa nội dung câu hỏi qua trang quản trị; mọi thay đổi nội dung đều xuất hiện trong lịch sử git.

## Assumptions

- Người soạn nội dung là người phát triển (hoặc người được cấp quyền repo), quen dùng terminal và git; không cần giao diện soạn bài cho người không biết git trong tính năng này.
- Các lệnh (kiểm tra, import, sinh âm thanh) và skill soạn nháp chạy tay trên máy người soạn với biến môi trường của dự án, vào database duy nhất của dự án; chưa có database dev riêng và chưa chạy tự động trên CI hay khi deploy (có thể thêm sau).
- Soạn nháp chạy trong Claude Code bằng gói đăng ký sẵn có của người soạn; không có chi phí theo lượt.
- Âm thanh sinh trên máy người soạn bằng mô hình mở Kokoro-82M; lần đầu tải mô hình (khoảng 300 MB) rồi chạy offline, không phát sinh chi phí.
- Danh sách "từ chức năng chung" (mạo từ, đại từ, giới từ, trợ động từ cơ bản…) được khai báo ở cấp khóa trong file, không viết cứng trong code.
- Các bài đã có trong database tạo bằng seed cũ có thể bị thay thế khi chuyển sang quy trình mới, vì hiện chưa có học viên thật; từ sau lần import đầu, tiến độ học viên phải được giữ (FR-013).
- Hình ảnh cho câu "chọn hình" vẫn dùng đường dẫn có sẵn; sinh hoặc tải hình lên không thuộc phạm vi.
- Âm thanh lưu ở kho lưu trữ đọc công khai vì nội dung bài học không phải dữ liệu riêng tư; tính năng không thu thêm dữ liệu cá nhân nào của học viên.
- Phạm vi chỉ gồm chế độ Người lớn; cấu trúc file và database không được giả định gì riêng cho người lớn, để chế độ Bé dùng lại được (constitution, Nguyên tắc I).
- Ngoài phạm vi: soạn nội dung thật của khóa A1 (tính năng 002), chế độ Bé, ôn tập ngắt quãng, dọn file âm thanh mồ côi, giao diện quản trị mới theo Figma (tính năng 003).
