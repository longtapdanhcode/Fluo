"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { exercises, lessonCompletions, lessons, profiles } from "@/db/schema";
import { aiConfigured, explainMistake } from "@/lib/ai";
import { requireProfile } from "@/lib/auth";
import { isLessonUnlocked } from "@/lib/content";
import { checkAnswer, correctAnswerText, responseText } from "@/lib/exercises/check";
import type { ExerciseResponse } from "@/lib/exercises/types";
import { GAME, lessonXp, nextStreak, todayISO } from "@/lib/game";

export type LessonResult = {
  finished: boolean;
  correct: number;
  mistakes: number;
  xpEarned: number;
  streak: number;
  hearts: number;
};

/**
 * Nộp bài. `answers` là lần trả lời ĐẦU TIÊN của mỗi câu.
 * Server chấm lại, trừ tim, cộng XP và cập nhật streak.
 */
export async function submitLesson(
  lessonId: string,
  answers: { exerciseId: string; response: ExerciseResponse }[],
  finished: boolean,
): Promise<LessonResult> {
  const profile = await requireProfile();
  // Ba truy vấn độc lập chạy song song (mỗi lượt gọi DB ~200 ms).
  const [unlocked, lesson, items] = await Promise.all([
    isLessonUnlocked(lessonId, profile.id),
    db.query.lessons.findFirst({ where: eq(lessons.id, lessonId) }),
    // Chỉ chấm câu học viên thấy: bỏ câu đã gỡ khỏi file nội dung.
    db
      .select()
      .from(exercises)
      .where(and(eq(exercises.lessonId, lessonId), isNull(exercises.archivedAt))),
  ]);
  if (!unlocked) throw new Error("Bài học chưa mở khóa");
  if (!lesson) throw new Error("Không tìm thấy bài học");
  const byId = new Map(items.map((e) => [e.id, e]));

  let correct = 0;
  let mistakes = 0;
  const seen = new Set<string>();
  for (const a of answers) {
    const ex = byId.get(a.exerciseId);
    if (!ex || seen.has(a.exerciseId)) continue;
    seen.add(a.exerciseId);
    if (checkAnswer(ex.data, a.response)) correct++;
    else mistakes++;
  }
  // Chỉ coi là hoàn thành khi đã trả lời đủ mọi câu.
  const completed = finished && seen.size === items.length;

  const hearts = Math.max(0, profile.hearts - mistakes);
  const xpEarned = completed ? lessonXp(lesson.xpReward, mistakes) : 0;
  const today = todayISO();
  const streak = completed
    ? nextStreak(profile.streakCurrent, profile.lastActiveDate, today)
    : profile.streakCurrent;

  await db.transaction(async (tx) => {
    // Gửi hai lệnh cùng lúc trên một kết nối (postgres.js pipeline) thay vì chờ lần lượt.
    const update = tx
      .update(profiles)
      .set({
        hearts,
        // Mốc hồi tim chỉ bắt đầu khi tim không còn đầy.
        heartsUpdatedAt: profile.hearts >= GAME.maxHearts && hearts < GAME.maxHearts ? new Date() : profile.heartsUpdatedAt,
        ...(completed && {
          xpTotal: profile.xpTotal + xpEarned,
          streakCurrent: streak,
          streakLongest: Math.max(profile.streakLongest, streak),
          lastActiveDate: today,
        }),
      })
      .where(eq(profiles.id, profile.id));
    const insert = completed
      ? tx.insert(lessonCompletions).values({ profileId: profile.id, lessonId, correct, mistakes, xpEarned })
      : null;
    await Promise.all([update, insert]);
  });

  revalidatePath("/learn");
  return { finished: completed, correct, mistakes, xpEarned, streak, hearts };
}

/** AI giải thích vì sao sai. Không có API key thì dùng lời giải soạn sẵn. */
export async function explainAnswer(
  exerciseId: string,
  response: ExerciseResponse,
): Promise<string | null> {
  await requireProfile();
  const ex = await db.query.exercises.findFirst({ where: and(eq(exercises.id, exerciseId)) });
  if (!ex) return null;
  if (!aiConfigured) return ex.explanation;

  const data = ex.data;
  const question =
    data.type === "fill_blank"
      ? data.sentence
      : data.type === "listen_select" || data.type === "listen_type"
        ? data.audioText
        : data.type === "word_bank"
          ? "(xếp từ thành câu)"
          : "";
  try {
    return (
      (await explainMistake({
        prompt: ex.prompt,
        question,
        correct: correctAnswerText(data),
        given: responseText(data, response),
      })) ?? ex.explanation
    );
  } catch (err) {
    console.error("explainAnswer failed", err);
    return ex.explanation;
  }
}
