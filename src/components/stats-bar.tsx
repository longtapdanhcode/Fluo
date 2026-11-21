import { Flame, Heart, Zap } from "lucide-react";

export function StatsBar({ streak, xp, hearts }: { streak: number; xp: number; hearts: number }) {
  return (
    <div className="flex items-center gap-4 text-sm font-bold">
      <span className="flex items-center gap-1 text-orange-500" title="Chuỗi ngày học">
        <Flame className="size-5" /> {streak}
      </span>
      <span className="flex items-center gap-1 text-gold" title="Tổng XP">
        <Zap className="size-5" /> {xp}
      </span>
      <span className="flex items-center gap-1 text-rose-500" title="Tim">
        <Heart className="size-5 fill-current" /> {hearts}
      </span>
    </div>
  );
}
