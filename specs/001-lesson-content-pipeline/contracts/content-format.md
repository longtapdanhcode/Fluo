# Contract: Định dạng file nội dung (YAML)

Schema chuẩn là Zod trong `src/lib/content/schema.ts`. Phần `data` của câu hỏi dùng lại `exerciseData` từ `src/lib/exercises/types.ts`, không định nghĩa lại.

## Cấu trúc thư mục

```text
content/
└── <course-dir>/                 # tên thư mục tùy ý, nên trùng id khóa
    ├── course.yaml
    └── <unit-dir>/               # tiền tố số để dễ nhìn, ví dụ 01-greetings
        ├── unit.yaml
        ├── 01-hello.yaml         # mỗi bài một file; thứ tự bài lấy từ unit.yaml
        └── 02-introduce.yaml
```

Thứ tự unit lấy từ `course.yaml > units`, thứ tự bài lấy từ `unit.yaml > lessons`. Tên thư mục và tên file không quyết định danh tính hay thứ tự. File bài nằm trong thư mục unit mà không được liệt kê sẽ bị báo lỗi `missing_manifest`.

## `course.yaml`

```yaml
id: a1-starter                  # = courses.slug, chữ thường, số, gạch nối
title: "Tiếng Anh A1: Khởi đầu"
description: Những câu giao tiếp đầu tiên cho người mới bắt đầu
level: a1                       # pre_a1 | a1 | a2 | b1 | b2 | c1
audience: adult                 # adult | kid
published: true                 # chỉ áp dụng khi tạo khóa lần đầu
ttsVoice: en-US-AvaMultilingualNeural
units: [greetings, family]      # id unit theo thứ tự
commonWords: [a, an, the, i, you, he, she, it, we, they, is, am, are, to, and, of, in, on, my, your]
names: [Anna, Minh, Lan]        # tên riêng được phép
```

## `unit.yaml`

```yaml
id: greetings
title: Chào hỏi
description: Chào, giới thiệu bản thân
lessons: [hello, introduce]     # id bài theo thứ tự
vocabulary:
  - word: hello
    meaning: xin chào
    example: Hello, Anna!
  - word: good morning
    meaning: chào buổi sáng
  - word: meet
    meaning: gặp
    forms: [met]
```

## File bài

```yaml
id: hello                       # duy nhất trong khóa
title: Xin chào!
xp: 10                          # mặc định 10
published: true                 # chỉ áp dụng khi tạo bài lần đầu; nháp AI luôn false
exercises:
  - id: hello-meaning           # duy nhất trong bài
    prompt: Chọn nghĩa đúng của “Hello”
    explanation: “Hello” là lời chào phổ biến nhất, dùng được mọi lúc.
    choicesLang: vi             # tùy chọn: en | vi; mặc định tự nhận theo dấu tiếng Việt
    data:
      type: multiple_choice
      choices: [{ text: Xin chào }, { text: Tạm biệt }, { text: Cảm ơn }]
      answerIndex: 0

  - id: pho-order
    prompt: Xếp thành câu đúng
    explanation: |
      “I would like …” là cách gọi món lịch sự.
      “pho” giữ nguyên tên món.
    exceptions:                 # từ ngoại lệ, mỗi từ bắt buộc có lý do
      - word: pho
        reason: tên món ăn Việt
    aiGenerated: false          # mặc định false
    image: https://…            # tùy chọn → exercises.image_url
    data:
      type: word_bank
      answer: [I, would, like, pho]
      distractors: [you]
```

## Quy tắc ánh xạ sang DB

| File | DB |
|---|---|
| `course.id` | `courses.slug` |
| `unit.id` | `units.key` |
| `"<course.id>/<lesson.id>"` | `lessons.content_key` |
| vị trí trong `course.units` / `unit.lessons` / `exercises` (bắt đầu từ 1) | `sort_order` |
| `exercise.data.type` | `exercises.type` |
| `exercise.image` | `exercises.image_url` |
| `vocabulary[].meaning` | `vocabulary.meaning_vi` |
| `exceptions` | không lưu DB; chỉ dùng khi kiểm tra và khi nối từ vựng |
