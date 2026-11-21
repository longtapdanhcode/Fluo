/**
 * Thêm khóa A1 mẫu (2 unit, 4 bài) để chạy thử. Chạy: npm run db:seed
 * Chạy lại sẽ xóa và tạo lại khóa có slug "a1-starter".
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import { exerciseData, type ExerciseData } from "../src/lib/exercises/types";

type Ex = { prompt: string; data: ExerciseData; explanation?: string };

const course = {
  slug: "a1-starter",
  title: "Tiếng Anh A1: Khởi đầu",
  description: "Những câu giao tiếp đầu tiên cho người mới bắt đầu",
};

const content: { title: string; description: string; lessons: { title: string; exercises: Ex[] }[] }[] = [
  {
    title: "Chào hỏi",
    description: "Chào, giới thiệu bản thân",
    lessons: [
      {
        title: "Xin chào!",
        exercises: [
          {
            prompt: "Chọn nghĩa đúng của “Hello”",
            data: { type: "multiple_choice", choices: [{ text: "Xin chào" }, { text: "Tạm biệt" }, { text: "Cảm ơn" }], answerIndex: 0 },
            explanation: "“Hello” là lời chào phổ biến nhất, dùng được mọi lúc.",
          },
          {
            prompt: "Nghe và chọn nghĩa đúng",
            data: { type: "listen_select", audioText: "Good morning", choices: ["Chúc ngủ ngon", "Chào buổi sáng", "Chào buổi tối"], answerIndex: 1 },
            explanation: "“Good morning” dùng để chào vào buổi sáng.",
          },
          {
            prompt: "Ghép từ với nghĩa",
            data: {
              type: "match_pairs",
              pairs: [
                { left: "Hello", right: "Xin chào" },
                { left: "Goodbye", right: "Tạm biệt" },
                { left: "Thank you", right: "Cảm ơn" },
                { left: "Sorry", right: "Xin lỗi" },
              ],
            },
          },
          {
            prompt: "Xếp thành câu: “Rất vui được gặp bạn”",
            data: { type: "word_bank", answer: ["Nice", "to", "meet", "you"], distractors: ["me", "good"] },
            explanation: "Câu cố định: “Nice to meet you”.",
          },
          {
            prompt: "Điền từ còn thiếu",
            data: { type: "fill_blank", sentence: "Good ___, see you tomorrow!", answer: "night", choices: ["night", "morning", "hello"] },
            explanation: "“Good night” là lời chào khi đi ngủ hoặc chia tay buổi tối.",
          },
          {
            prompt: "Nghe và gõ lại",
            data: { type: "listen_type", audioText: "How are you?", answer: "How are you", acceptable: [] },
            explanation: "“How are you?” nghĩa là “Bạn khỏe không?”.",
          },
        ],
      },
      {
        title: "Giới thiệu bản thân",
        exercises: [
          {
            prompt: "Chọn câu đúng để nói “Tôi tên là Lan”",
            data: { type: "multiple_choice", choices: [{ text: "My name is Lan" }, { text: "Me name Lan" }, { text: "I name is Lan" }], answerIndex: 0 },
            explanation: "Dùng “My name is …” để giới thiệu tên.",
          },
          {
            prompt: "Điền từ còn thiếu",
            data: { type: "fill_blank", sentence: "I ___ from Vietnam.", answer: "am", choices: ["am", "is", "are"] },
            explanation: "Chủ ngữ “I” đi với “am”.",
          },
          {
            prompt: "Xếp thành câu: “Tôi là học sinh”",
            data: { type: "word_bank", answer: ["I", "am", "a", "student"], distractors: ["is", "an"] },
            explanation: "“student” bắt đầu bằng phụ âm nên dùng “a”.",
          },
          {
            prompt: "Nghe và chọn câu bạn nghe được",
            data: { type: "listen_select", audioText: "Where are you from?", choices: ["Where are you from?", "Who are you?", "How old are you?"], answerIndex: 0 },
          },
          {
            prompt: "Nghe và gõ lại",
            data: { type: "listen_type", audioText: "I am twenty years old", answer: "I am twenty years old", acceptable: ["I'm twenty years old", "I am 20 years old", "I'm 20 years old"] },
          },
        ],
      },
    ],
  },
  {
    title: "Gia đình",
    description: "Nói về người thân",
    lessons: [
      {
        title: "Thành viên gia đình",
        exercises: [
          {
            prompt: "Ghép từ với nghĩa",
            data: {
              type: "match_pairs",
              pairs: [
                { left: "mother", right: "mẹ" },
                { left: "father", right: "bố" },
                { left: "sister", right: "chị/em gái" },
                { left: "brother", right: "anh/em trai" },
              ],
            },
          },
          {
            prompt: "Chọn nghĩa đúng của “grandmother”",
            data: { type: "multiple_choice", choices: [{ text: "bà" }, { text: "ông" }, { text: "cô" }, { text: "mẹ" }], answerIndex: 0 },
          },
          {
            prompt: "Điền từ còn thiếu",
            data: { type: "fill_blank", sentence: "She ___ my sister.", answer: "is", choices: ["is", "am", "are"] },
            explanation: "Chủ ngữ “She” đi với “is”.",
          },
          {
            prompt: "Xếp thành câu: “Đây là bố tôi”",
            data: { type: "word_bank", answer: ["This", "is", "my", "father"], distractors: ["I", "are"] },
          },
        ],
      },
      {
        title: "Có bao nhiêu người?",
        exercises: [
          {
            prompt: "Nghe và chọn nghĩa đúng",
            data: { type: "listen_select", audioText: "I have two brothers", choices: ["Tôi có hai anh trai", "Tôi có hai chị gái", "Tôi có một em trai"], answerIndex: 0 },
          },
          {
            prompt: "Điền vào chỗ trống (gõ)",
            data: { type: "fill_blank", sentence: "There are four people in my ___.", answer: "family" },
            explanation: "“family” nghĩa là gia đình.",
          },
          {
            prompt: "Nghe và gõ lại",
            data: { type: "listen_type", audioText: "I love my family", answer: "I love my family", acceptable: [] },
          },
        ],
      },
    ],
  },
];

const badges = [
  { code: "first_lesson", title: "Bước đầu tiên", description: "Hoàn thành bài học đầu tiên", icon: "🌱" },
  { code: "perfect_lesson", title: "Hoàn hảo", description: "Hoàn thành một bài không sai câu nào", icon: "💯" },
  { code: "streak_7", title: "Một tuần chăm chỉ", description: "Giữ chuỗi 7 ngày", icon: "🔥" },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Thiếu DATABASE_URL trong .env.local");
  const pg = postgres(url, { prepare: false, max: 1 });
  const db = drizzle(pg, { schema, casing: "snake_case" });

  // Kiểm tra dữ liệu mẫu bằng chính schema của app.
  for (const u of content) for (const l of u.lessons) for (const e of l.exercises) exerciseData.parse(e.data);

  await db.transaction(async (tx) => {
    await tx.delete(schema.courses).where(eq(schema.courses.slug, course.slug));
    const [c] = await tx
      .insert(schema.courses)
      .values({ ...course, audience: "adult", level: "a1", published: true })
      .returning();

    for (const [ui, u] of content.entries()) {
      const [unit] = await tx
        .insert(schema.units)
        .values({ courseId: c.id, sortOrder: ui + 1, title: u.title, description: u.description })
        .returning();
      for (const [li, l] of u.lessons.entries()) {
        const [lesson] = await tx
          .insert(schema.lessons)
          .values({ unitId: unit.id, sortOrder: li + 1, title: l.title, published: true })
          .returning();
        await tx.insert(schema.exercises).values(
          l.exercises.map((e, ei) => ({
            lessonId: lesson.id,
            sortOrder: ei + 1,
            type: e.data.type,
            prompt: e.prompt,
            data: e.data,
            explanation: e.explanation ?? null,
          })),
        );
      }
    }
    await tx.insert(schema.badges).values(badges).onConflictDoNothing();
  });

  const total = content.flatMap((u) => u.lessons).length;
  console.log(`✓ Đã tạo khóa "${course.title}" với ${content.length} unit, ${total} bài.`);
  await pg.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
