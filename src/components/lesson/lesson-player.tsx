"use client";

import { Heart, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { explainAnswer, submitLesson, type LessonResult } from "@/app/actions/lesson";
import { Button, buttonVariants } from "@/components/ui/button";
import { checkAnswer, correctAnswerText } from "@/lib/exercises/check";
import type { ExerciseResponse } from "@/lib/exercises/types";
import { cn } from "@/lib/utils";
import { ExerciseView, type PlayerExercise } from "./exercises";

type Feedback = { correct: boolean; answer: string; explanation: string | null; loadingExplain: boolean };

type Mode = "learn" | "trial" | "preview";

/**
 * Màn chơi một bài học.
 * - mode "learn": đã đăng nhập, nộp kết quả lên server (XP, streak, tim).
 * - mode "trial": khách thử, không lưu gì.
 * - mode "preview": quản trị viên xem trước bài (kể cả chưa xuất bản), không lưu gì,
 *   hiện lời giải soạn sẵn khi trả lời sai.
 * Câu sai được hỏi lại ở cuối bài cho tới khi đúng.
 */
export function LessonPlayer({
  lessonId,
  exercises,
  initialHearts,
  mode,
  exitHref: exitHrefProp,
}: {
  lessonId: string;
  exercises: PlayerExercise[];
  initialHearts: number;
  mode: Mode;
  exitHref?: string;
}) {
  const [queue, setQueue] = useState(() => exercises.map((_, i) => i));
  const [pos, setPos] = useState(0);
  const [turn, setTurn] = useState(0); // tăng mỗi lượt để reset state của dạng bài
  const [value, setValue] = useState<ExerciseResponse | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [firstAnswers, setFirstAnswers] = useState<Record<string, ExerciseResponse>>({});
  const [hearts, setHearts] = useState(initialHearts);
  const [result, setResult] = useState<LessonResult | "out" | null>(null);
  const [pending, startTransition] = useTransition();

  const current = exercises[queue[pos]];
  const progress = Math.round(((pos + (feedback?.correct ? 1 : 0)) / queue.length) * 100);

  const finish = useCallback(
    (answers: Record<string, ExerciseResponse>, finished: boolean, heartsLeft: number) => {
      if (mode !== "learn") {
        const mistakes = Object.entries(answers).filter(
          ([id, r]) => !checkAnswer(exercises.find((e) => e.id === id)!.data, r),
        ).length;
        setResult(
          finished
            ? { finished, correct: exercises.length - mistakes, mistakes, xpEarned: 0, streak: 0, hearts: heartsLeft }
            : "out",
        );
        return;
      }
      startTransition(async () => {
        const payload = Object.entries(answers).map(([exerciseId, response]) => ({ exerciseId, response }));
        const res = await submitLesson(lessonId, payload, finished);
        setResult(finished ? res : "out");
      });
    },
    [exercises, lessonId, mode],
  );

  const check = useCallback(() => {
    if (!value || feedback || !current) return;
    const correct = checkAnswer(current.data, value);
    const isFirst = !(current.id in firstAnswers);
    if (isFirst) setFirstAnswers((a) => ({ ...a, [current.id]: value }));

    setFeedback({
      correct,
      answer: correctAnswerText(current.data),
      explanation: mode === "preview" && !correct ? (current.explanation ?? null) : null,
      loadingExplain: false,
    });
    if (!correct) {
      setHearts((h) => h - 1);
      setQueue((q) => [...q, queue[pos]]); // hỏi lại ở cuối
    }
  }, [value, feedback, current, firstAnswers, queue, pos, mode]);

  const next = useCallback(() => {
    if (!feedback) return;
    const answers = firstAnswers;
    if (hearts <= 0) return finish(answers, false, 0);
    if (pos + 1 >= queue.length) return finish(answers, true, hearts);
    setPos((p) => p + 1);
    setTurn((t) => t + 1);
    setValue(null);
    setFeedback(null);
  }, [feedback, firstAnswers, hearts, pos, queue.length, finish]);

  const explain = useCallback(async () => {
    if (!feedback || !value || !current) return;
    if (mode !== "learn") return;
    setFeedback({ ...feedback, loadingExplain: true });
    const text = await explainAnswer(current.id, value);
    setFeedback((f) => f && { ...f, loadingExplain: false, explanation: text ?? "Chưa có giải thích cho câu này." });
  }, [feedback, value, current, mode]);

  // Enter = Kiểm tra / Tiếp tục
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.shiftKey) return;
      e.preventDefault();
      if (feedback) next();
      else check();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [feedback, next, check]);

  const exitHref = exitHrefProp ?? (mode === "learn" ? "/learn" : "/");

  if (result) return <ResultScreen result={result} mode={mode} exitHref={exitHref} />;
  if (!current) return null;

  return (
    <div className="flex min-h-dvh flex-col">
      {mode === "preview" && (
        <p className="bg-muted px-4 py-2 text-center text-xs font-bold uppercase text-muted-foreground">
          Xem trước · không lưu tiến độ, XP hay tim
        </p>
      )}
      <header className="mx-auto flex w-full max-w-2xl items-center gap-4 px-4 py-5">
        <Link href={exitHref} aria-label="Thoát bài học" className="text-muted-foreground hover:text-foreground">
          <X className="size-6" />
        </Link>
        <div className="h-4 flex-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-success transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        <span className="flex items-center gap-1 font-bold text-rose-500">
          <Heart className="size-5 fill-current" /> {hearts}
        </span>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 pt-4 pb-8">
        {pos >= exercises.length && (
          <p className="text-sm font-bold uppercase text-orange-500">Ôn lại câu sai</p>
        )}
        <h1 className="text-2xl font-extrabold">{current.prompt}</h1>
        {current.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current.imageUrl} alt="" className="mx-auto max-h-48 rounded-2xl" />
        )}
        <ExerciseView key={turn} exercise={current} value={value} onChange={setValue} locked={!!feedback} />
      </main>

      <footer
        className={cn(
          "border-t-2 transition-colors",
          feedback?.correct && "border-transparent bg-success-soft",
          feedback && !feedback.correct && "border-transparent bg-danger-soft",
        )}
      >
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          {feedback ? (
            <div className="flex-1">
              <p className={cn("text-xl font-extrabold", feedback.correct ? "text-success" : "text-destructive")}>
                {feedback.correct ? "Chính xác! 🎉" : "Chưa đúng rồi"}
              </p>
              {!feedback.correct && (
                <>
                  <p className="text-sm">
                    Đáp án đúng: <span className="font-bold">{feedback.answer}</span>
                  </p>
                  {feedback.explanation ? (
                    <p className="mt-2 text-sm text-muted-foreground">{feedback.explanation}</p>
                  ) : (
                    mode === "learn" && (
                      <button
                        type="button"
                        onClick={explain}
                        disabled={feedback.loadingExplain}
                        className="mt-1 text-sm font-bold text-destructive underline"
                      >
                        {feedback.loadingExplain ? "AI đang giải thích…" : "Vì sao sai? 🤖"}
                      </button>
                    )
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="hidden flex-1 sm:block" />
          )}
          <Button
            size="lg"
            className={cn(
              "h-12 min-w-40 text-base font-extrabold uppercase",
              feedback && !feedback.correct && "bg-destructive hover:bg-destructive/90",
              feedback?.correct && "bg-success hover:bg-success/90",
            )}
            disabled={(!feedback && !value) || pending}
            onClick={feedback ? next : check}
          >
            {pending ? "Đang lưu…" : feedback ? "Tiếp tục" : "Kiểm tra"}
          </Button>
        </div>
      </footer>
    </div>
  );
}

function ResultScreen({
  result,
  mode,
  exitHref,
}: {
  result: LessonResult | "out";
  mode: Mode;
  exitHref: string;
}) {
  if (result === "out") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="text-6xl" aria-hidden>
          💔
        </div>
        <h1 className="text-2xl font-extrabold">Hết tim rồi!</h1>
        <p className="text-muted-foreground">Tim sẽ tự hồi theo thời gian. Nghỉ chút rồi quay lại nhé.</p>
        <Link href={exitHref} className={cn(buttonVariants({ size: "lg" }), "h-12 px-8 font-bold")}>
          {mode === "preview" ? "Quay lại bài" : "Về trang học"}
        </Link>
      </main>
    );
  }
  const total = result.correct + result.mistakes;
  const accuracy = total ? Math.round((result.correct / total) * 100) : 0;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="text-7xl" aria-hidden>
        {result.mistakes === 0 ? "🏆" : "🎉"}
      </div>
      <h1 className="text-3xl font-extrabold">{result.mistakes === 0 ? "Hoàn hảo!" : "Hoàn thành bài học!"}</h1>
      <div className="grid w-full grid-cols-2 gap-3">
        {mode === "learn" && (
          <Stat label="XP nhận được" value={`+${result.xpEarned}`} className="border-gold text-gold" />
        )}
        <Stat
          label="Độ chính xác"
          value={`${accuracy}%`}
          className={cn("border-success text-success", mode !== "learn" && "col-span-2")}
        />
        {mode === "learn" && (
          <Stat label="Chuỗi ngày" value={`🔥 ${result.streak}`} className="col-span-2 border-orange-400 text-orange-500" />
        )}
      </div>
      {mode === "trial" ? (
        <div className="flex w-full flex-col gap-3">
          <p className="text-muted-foreground">Tạo tài khoản miễn phí để lưu tiến độ, nhận XP và giữ streak.</p>
          <Link href="/login" className={cn(buttonVariants({ size: "lg" }), "h-12 font-bold")}>
            Tạo tài khoản
          </Link>
        </div>
      ) : (
        <Link href={exitHref} className={cn(buttonVariants({ size: "lg" }), "h-12 w-full font-bold")}>
          {mode === "preview" ? "Quay lại bài" : "Tiếp tục"}
        </Link>
      )}
    </main>
  );
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn("rounded-2xl border-2 p-3", className)}>
      <p className="text-xs font-bold uppercase">{label}</p>
      <p className="text-2xl font-extrabold">{value}</p>
    </div>
  );
}
