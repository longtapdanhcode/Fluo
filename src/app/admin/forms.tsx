"use client";

import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { exerciseTypeLabels, type ExerciseData, type ExerciseType } from "@/lib/exercises/types";
import { cn } from "@/lib/utils";
import {
  createCourse,
  createLesson,
  createUnit,
  deleteExercise,
  generateDraft,
  saveExercise,
  togglePublished,
  type ActionState,
} from "./actions";

function Status({ state }: { state: ActionState }) {
  if (!state) return null;
  return (
    <p className={cn("text-sm", state.error ? "text-destructive" : "text-success")}>{state.error ?? state.ok}</p>
  );
}

/** Form một dòng: tên + nút thêm. Dùng cho khóa học / unit / bài. */
export function QuickAddForm({
  kind,
  parentId,
  placeholder,
}: {
  kind: "course" | "unit" | "lesson";
  parentId?: string;
  placeholder: string;
}) {
  const action = kind === "course" ? createCourse : kind === "unit" ? createUnit : createLesson;
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="flex flex-col gap-1">
      <div className="flex gap-2">
        {parentId && <input type="hidden" name={kind === "unit" ? "courseId" : "unitId"} value={parentId} />}
        <Input name="title" placeholder={placeholder} className="h-8" />
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          Thêm
        </Button>
      </div>
      <Status state={state} />
    </form>
  );
}

export function PublishToggle({ kind, id, published }: { kind: "course" | "lesson"; id: string; published: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => togglePublished(kind, id, !published))}
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-bold",
        published ? "bg-success-soft text-success" : "bg-muted text-muted-foreground",
      )}
      title="Bấm để đổi trạng thái"
    >
      {pending ? "…" : published ? "Đã xuất bản" : "Nháp"}
    </button>
  );
}

export const exerciseTemplates: Record<ExerciseType, ExerciseData> = {
  multiple_choice: { type: "multiple_choice", choices: [{ text: "apple" }, { text: "banana" }, { text: "orange" }], answerIndex: 0 },
  listen_select: { type: "listen_select", audioText: "Good morning", choices: ["Chào buổi sáng", "Chúc ngủ ngon", "Tạm biệt"], answerIndex: 0 },
  listen_type: { type: "listen_type", audioText: "I am a student", answer: "I am a student", acceptable: ["I'm a student"] },
  word_bank: { type: "word_bank", answer: ["She", "is", "my", "sister"], distractors: ["are", "he"] },
  match_pairs: { type: "match_pairs", pairs: [{ left: "cat", right: "con mèo" }, { left: "dog", right: "con chó" }, { left: "bird", right: "con chim" }] },
  fill_blank: { type: "fill_blank", sentence: "They ___ teachers.", answer: "are", choices: ["are", "is", "am"] },
};

type EditableExercise = {
  id?: string;
  prompt: string;
  explanation: string | null;
  audioUrl: string | null;
  imageUrl: string | null;
  data: ExerciseData;
  aiGenerated?: boolean;
};

export function ExerciseEditor({
  lessonId,
  exercise,
  index,
}: {
  lessonId: string;
  exercise: EditableExercise;
  index?: number;
}) {
  const [state, formAction, pending] = useActionState(saveExercise, null);
  const [deleting, startDelete] = useTransition();
  const [open, setOpen] = useState(!exercise.id);

  return (
    <div className="rounded-xl border p-4">
      <button type="button" className="flex w-full items-center gap-3 text-left" onClick={() => setOpen((o) => !o)}>
        {index !== undefined && <span className="text-sm font-bold text-muted-foreground">#{index + 1}</span>}
        <span className="rounded bg-muted px-2 py-0.5 text-xs font-bold">{exerciseTypeLabels[exercise.data.type]}</span>
        {exercise.aiGenerated && <span className="text-xs">🤖 AI</span>}
        <span className="flex-1 truncate font-semibold">{exercise.prompt}</span>
        <span className="text-muted-foreground">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <form action={formAction} className="mt-4 grid gap-3">
          <input type="hidden" name="lessonId" value={lessonId} />
          {exercise.id && <input type="hidden" name="id" value={exercise.id} />}
          <label className="grid gap-1 text-sm font-semibold">
            Đề bài
            <Input name="prompt" defaultValue={exercise.prompt} />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Dữ liệu (JSON)
            <Textarea
              name="data"
              defaultValue={JSON.stringify(exercise.data, null, 2)}
              rows={8}
              className="font-mono text-xs"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Giải thích (hiện khi học viên sai, nếu chưa bật AI)
            <Input name="explanation" defaultValue={exercise.explanation ?? ""} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-semibold">
              Audio URL (tùy chọn)
              <Input name="audioUrl" defaultValue={exercise.audioUrl ?? ""} />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Ảnh URL (tùy chọn)
              <Input name="imageUrl" defaultValue={exercise.imageUrl ?? ""} />
            </label>
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Đang lưu…" : exercise.id ? "Lưu" : "Thêm câu"}
            </Button>
            {exercise.id && (
              <Button
                type="button"
                variant="destructive"
                disabled={deleting}
                onClick={() => {
                  if (confirm("Xóa câu này?")) startDelete(() => deleteExercise(lessonId, exercise.id!));
                }}
              >
                Xóa
              </Button>
            )}
            <Status state={state} />
          </div>
        </form>
      )}
    </div>
  );
}

export function NewExercise({ lessonId }: { lessonId: string }) {
  const [type, setType] = useState<ExerciseType | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(exerciseTemplates) as ExerciseType[]).map((t) => (
          <Button key={t} size="sm" variant={type === t ? "default" : "outline"} onClick={() => setType(t)}>
            + {exerciseTypeLabels[t]}
          </Button>
        ))}
      </div>
      {type && (
        <ExerciseEditor
          key={type}
          lessonId={lessonId}
          exercise={{ prompt: "", explanation: null, audioUrl: null, imageUrl: null, data: exerciseTemplates[type] }}
        />
      )}
    </div>
  );
}

const MVP_TYPES: ExerciseType[] = ["multiple_choice", "listen_select", "listen_type", "word_bank", "match_pairs", "fill_blank"];

export function GenerateForm({ lessonId, defaultTopic, aiReady }: { lessonId: string; defaultTopic: string; aiReady: boolean }) {
  const [state, formAction, pending] = useActionState(generateDraft, null);
  return (
    <form action={formAction} className="grid gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <input type="hidden" name="lessonId" value={lessonId} />
      <p className="font-bold">🤖 AI soạn nháp</p>
      {!aiReady && (
        <p className="text-sm text-muted-foreground">
          Thêm <code>ANTHROPIC_API_KEY</code> vào <code>.env.local</code> để dùng.
        </p>
      )}
      <label className="grid gap-1 text-sm font-semibold">
        Chủ đề / trọng tâm
        <Input name="topic" defaultValue={defaultTopic} placeholder="Ví dụ: chào hỏi, động từ to be" />
      </label>
      <label className="grid w-32 gap-1 text-sm font-semibold">
        Số câu
        <Input name="count" type="number" min={1} max={15} defaultValue={8} />
      </label>
      <fieldset className="flex flex-wrap gap-3 text-sm">
        {MVP_TYPES.map((t) => (
          <label key={t} className="flex items-center gap-1">
            <input type="checkbox" name="types" value={t} defaultChecked /> {exerciseTypeLabels[t]}
          </label>
        ))}
      </fieldset>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || !aiReady}>
          {pending ? "AI đang soạn… (có thể mất ~1 phút)" : "Tạo nháp"}
        </Button>
        <Status state={state} />
      </div>
    </form>
  );
}
