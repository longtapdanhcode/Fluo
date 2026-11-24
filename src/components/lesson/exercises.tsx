"use client";

import { Snail, Volume2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { ExerciseData, ExerciseResponse } from "@/lib/exercises/types";
import { cn } from "@/lib/utils";
import { seededShuffle, speak } from "./utils";

export type PlayerExercise = {
  id: string;
  prompt: string;
  data: ExerciseData;
  audioUrl: string | null;
  imageUrl: string | null;
  /** Lời giải soạn sẵn; chỉ truyền ở chế độ xem trước của quản trị. */
  explanation?: string | null;
};

type Props<T extends ExerciseData["type"]> = {
  exercise: PlayerExercise & { data: Extract<ExerciseData, { type: T }> };
  value: ExerciseResponse | null;
  onChange: (r: ExerciseResponse | null) => void;
  locked: boolean;
};

const choiceClass = (selected: boolean, locked: boolean) =>
  cn(
    "rounded-2xl border-2 border-b-4 p-4 text-left font-semibold transition",
    selected ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted",
    locked && "pointer-events-none",
  );

function SpeakButtons({ text, audioUrl }: { text: string; audioUrl: string | null }) {
  return (
    <div className="flex items-end gap-3">
      <button
        type="button"
        onClick={() => speak(text, audioUrl)}
        className="flex size-20 items-center justify-center rounded-2xl border-b-4 border-[oklch(0.45_0.2_262)] bg-primary text-white active:translate-y-0.5 active:border-b-2"
        aria-label="Nghe"
      >
        <Volume2 className="size-10" />
      </button>
      <button
        type="button"
        onClick={() => speak(text, audioUrl, true)}
        className="flex size-12 items-center justify-center rounded-xl border-b-4 border-[oklch(0.45_0.2_262)] bg-primary text-white active:translate-y-0.5 active:border-b-2"
        aria-label="Nghe chậm"
      >
        <Snail className="size-6" />
      </button>
    </div>
  );
}

function MultipleChoice({ exercise, value, onChange, locked }: Props<"multiple_choice">) {
  const selected = value?.type === "multiple_choice" ? value.index : -1;
  const hasImages = exercise.data.choices.some((c) => c.imageUrl);
  return (
    <div className={cn("grid gap-3", hasImages ? "grid-cols-2" : "grid-cols-1")}>
      {exercise.data.choices.map((c, i) => (
        <button
          key={i}
          type="button"
          className={choiceClass(selected === i, locked)}
          onClick={() => {
            onChange({ type: "multiple_choice", index: i });
            if (!hasImages) speak(c.text);
          }}
        >
          {c.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.imageUrl} alt="" className="mb-2 aspect-square w-full rounded-xl object-cover" />
          )}
          {c.text}
        </button>
      ))}
    </div>
  );
}

function ListenSelect({ exercise, value, onChange, locked }: Props<"listen_select">) {
  const selected = value?.type === "listen_select" ? value.index : -1;
  return (
    <div className="flex flex-col items-center gap-6">
      <SpeakButtons text={exercise.data.audioText} audioUrl={exercise.audioUrl} />
      <div className="grid w-full gap-3">
        {exercise.data.choices.map((c, i) => (
          <button
            key={i}
            type="button"
            className={choiceClass(selected === i, locked)}
            onClick={() => onChange({ type: "listen_select", index: i })}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}

function ListenType({ exercise, value, onChange, locked }: Props<"listen_type">) {
  const text = value?.type === "listen_type" ? value.text : "";
  return (
    <div className="flex flex-col items-center gap-6">
      <SpeakButtons text={exercise.data.audioText} audioUrl={exercise.audioUrl} />
      <textarea
        value={text}
        disabled={locked}
        autoFocus
        rows={3}
        placeholder="Gõ lại những gì bạn nghe được"
        onChange={(e) => onChange(e.target.value.trim() ? { type: "listen_type", text: e.target.value } : null)}
        className="w-full rounded-2xl border-2 bg-muted/40 p-4 text-lg outline-none focus:border-primary"
      />
    </div>
  );
}

function WordBank({ exercise, onChange, locked }: Props<"word_bank">) {
  const tokens = useMemo(
    () =>
      seededShuffle(
        [...exercise.data.answer, ...exercise.data.distractors].map((w, i) => ({ id: i, w })),
        exercise.id,
      ),
    [exercise],
  );
  const [picked, setPicked] = useState<number[]>([]);
  const update = (next: number[]) => {
    setPicked(next);
    onChange(next.length ? { type: "word_bank", words: next.map((id) => tokens.find((t) => t.id === id)!.w) } : null);
  };
  const chip =
    "rounded-xl border-2 border-b-4 bg-background px-3 py-2 font-semibold transition active:translate-y-0.5";

  return (
    <div className="flex flex-col gap-8">
      <div className="flex min-h-16 flex-wrap content-start gap-2 border-b-2 pb-3">
        {picked.map((id) => (
          <button key={id} type="button" disabled={locked} className={chip} onClick={() => update(picked.filter((p) => p !== id))}>
            {tokens.find((t) => t.id === id)!.w}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {tokens.map((t) => {
          const used = picked.includes(t.id);
          return (
            <button
              key={t.id}
              type="button"
              disabled={locked || used}
              className={cn(chip, used && "border-muted bg-muted text-transparent")}
              onClick={() => {
                speak(t.w);
                update([...picked, t.id]);
              }}
            >
              {t.w}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MatchPairs({ exercise, onChange, locked }: Props<"match_pairs">) {
  const pairs = exercise.data.pairs;
  const left = useMemo(() => seededShuffle(pairs.map((p, i) => ({ i, t: p.left })), exercise.id + "L"), [pairs, exercise.id]);
  const right = useMemo(() => seededShuffle(pairs.map((p, i) => ({ i, t: p.right })), exercise.id + "R"), [pairs, exercise.id]);
  const [sel, setSel] = useState<number | null>(null);
  const [matched, setMatched] = useState<number[]>([]);
  const [wrong, setWrong] = useState<number | null>(null);
  const [mistakes, setMistakes] = useState(0);

  function pickRight(i: number) {
    if (sel === null) return;
    if (sel === i) {
      const next = [...matched, i];
      setMatched(next);
      setSel(null);
      if (next.length === pairs.length) onChange({ type: "match_pairs", mistakes });
    } else {
      setMistakes((m) => m + 1);
      setWrong(i);
      setTimeout(() => setWrong(null), 500);
      setSel(null);
    }
  }

  const cell = (state: "idle" | "selected" | "matched" | "wrong") =>
    cn(
      "rounded-2xl border-2 border-b-4 p-3 font-semibold transition",
      state === "selected" && "border-primary bg-primary/10 text-primary",
      state === "matched" && "pointer-events-none border-success/40 bg-success-soft text-success opacity-60",
      state === "wrong" && "border-destructive bg-danger-soft text-destructive",
      locked && "pointer-events-none",
    );

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="flex flex-col gap-3">
        {left.map((l) => (
          <button
            key={l.i}
            type="button"
            className={cell(matched.includes(l.i) ? "matched" : sel === l.i ? "selected" : "idle")}
            onClick={() => {
              setSel(l.i);
              speak(l.t);
            }}
          >
            {l.t}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-3">
        {right.map((r) => (
          <button
            key={r.i}
            type="button"
            className={cell(matched.includes(r.i) ? "matched" : wrong === r.i ? "wrong" : "idle")}
            onClick={() => pickRight(r.i)}
          >
            {r.t}
          </button>
        ))}
      </div>
    </div>
  );
}

function FillBlank({ exercise, value, onChange, locked }: Props<"fill_blank">) {
  const text = value?.type === "fill_blank" ? value.text : "";
  const [before, after] = exercise.data.sentence.split("___");
  const choices = useMemo(
    () => (exercise.data.choices ? seededShuffle(exercise.data.choices, exercise.id) : null),
    [exercise],
  );
  return (
    <div className="flex flex-col gap-8">
      <p className="text-xl leading-relaxed">
        {before}
        {choices ? (
          <span className="mx-1 inline-block min-w-20 border-b-2 border-primary px-2 text-center font-bold text-primary">
            {text || " "}
          </span>
        ) : (
          <input
            value={text}
            disabled={locked}
            autoFocus
            onChange={(e) => onChange(e.target.value.trim() ? { type: "fill_blank", text: e.target.value } : null)}
            className="mx-1 w-32 border-b-2 border-primary bg-transparent px-1 text-center font-bold text-primary outline-none"
            aria-label="Điền từ"
          />
        )}
        {after}
      </p>
      {choices && (
        <div className="grid grid-cols-2 gap-3">
          {choices.map((c) => (
            <button
              key={c}
              type="button"
              className={choiceClass(text === c, locked)}
              onClick={() => onChange({ type: "fill_blank", text: c })}
            >
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Chọn component theo dạng bài. `key` theo lượt để reset state khi câu bị hỏi lại. */
export function ExerciseView(props: {
  exercise: PlayerExercise;
  value: ExerciseResponse | null;
  onChange: (r: ExerciseResponse | null) => void;
  locked: boolean;
}) {
  const { exercise } = props;
  switch (exercise.data.type) {
    case "multiple_choice":
      return <MultipleChoice {...(props as Props<"multiple_choice">)} />;
    case "listen_select":
      return <ListenSelect {...(props as Props<"listen_select">)} />;
    case "listen_type":
      return <ListenType {...(props as Props<"listen_type">)} />;
    case "word_bank":
      return <WordBank {...(props as Props<"word_bank">)} />;
    case "match_pairs":
      return <MatchPairs {...(props as Props<"match_pairs">)} />;
    case "fill_blank":
      return <FillBlank {...(props as Props<"fill_blank">)} />;
  }
}
