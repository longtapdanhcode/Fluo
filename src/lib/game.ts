/** Luật gamification. Hàm thuần, không đụng DB, để dễ test và dùng lại. */

export const GAME = {
  maxHearts: 5,
  /** Hồi 1 tim sau mỗi khoảng thời gian này. */
  heartRefillMs: 30 * 60 * 1000,
  /** Thưởng thêm khi làm bài không sai câu nào. */
  perfectBonusXp: 5,
  timeZone: "Asia/Ho_Chi_Minh",
} as const;

/** Ngày hôm nay theo giờ Việt Nam, dạng YYYY-MM-DD. */
export function todayISO(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: GAME.timeZone }).format(now);
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

/** Tim hiện tại sau khi tính phần hồi theo thời gian. */
export function currentHearts(
  hearts: number,
  updatedAt: Date,
  now = new Date(),
): { hearts: number; updatedAt: Date } {
  if (hearts >= GAME.maxHearts) return { hearts, updatedAt: now };
  const gained = Math.floor((now.getTime() - updatedAt.getTime()) / GAME.heartRefillMs);
  if (gained <= 0) return { hearts, updatedAt };
  const next = Math.min(GAME.maxHearts, hearts + gained);
  return {
    hearts: next,
    updatedAt:
      next >= GAME.maxHearts ? now : new Date(updatedAt.getTime() + gained * GAME.heartRefillMs),
  };
}

export function minutesUntilNextHeart(updatedAt: Date, now = new Date()): number {
  return Math.max(1, Math.ceil((updatedAt.getTime() + GAME.heartRefillMs - now.getTime()) / 60000));
}

/** Streak mới sau khi học xong một bài hôm nay. */
export function nextStreak(
  current: number,
  lastActive: string | null,
  today = todayISO(),
): number {
  if (!lastActive) return 1;
  const gap = daysBetween(lastActive, today);
  if (gap <= 0) return Math.max(current, 1);
  if (gap === 1) return current + 1;
  return 1;
}

/** Streak hiển thị: nếu đã bỏ lỡ hơn 1 ngày thì về 0. */
export function displayStreak(current: number, lastActive: string | null, today = todayISO()) {
  if (!lastActive) return 0;
  return daysBetween(lastActive, today) > 1 ? 0 : current;
}

export function lessonXp(baseXp: number, mistakes: number): number {
  return baseXp + (mistakes === 0 ? GAME.perfectBonusXp : 0);
}
