/**
 * Sinh âm thanh (Kokoro chạy trên máy, miễn phí) cho câu nghe và từ vựng chưa có hoặc đã đổi nội
 * dung, lưu lên Supabase Storage và điền audio_url. Chạy lại chỉ sinh phần còn thiếu.
 *   npm run content:audio [-- --course a1-starter] [--dry-run] [--limit 20]
 *   npm run content:audio -- --sample "How are you?" [--voice af_bella]   nghe thử, ghi vào tmp-audio/
 * Hợp đồng: specs/001-lesson-content-pipeline/contracts/cli.md
 */
import "./lib/env";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { db } from "@/db";
import { courses, exercises, lessons, units, vocabulary } from "@/db/schema";
import { audioHash, audioText } from "@/lib/content/audio";
import { closeDb } from "./lib/apply-sync";
import { disposeKokoro, synthesize } from "./lib/kokoro-tts";
import { REPO_ROOT } from "./lib/load-files";
import { ensureBucket, storageClient, uploadMp3 } from "./lib/storage";

type Item = { table: "exercises" | "vocabulary"; id: string; label: string };
type Group = { hash: string; text: string; voice: string; course: string; items: Item[] };

async function collect(courseSlug?: string): Promise<{ groups: Group[]; skipped: number; noVoice: string[] }> {
  const courseRows = await db
    .select({ id: courses.id, slug: courses.slug, voice: courses.ttsVoice })
    .from(courses)
    .where(courseSlug ? eq(courses.slug, courseSlug) : undefined);
  const groups = new Map<string, Group>();
  let skipped = 0;
  const noVoice: string[] = [];

  for (const c of courseRows) {
    if (!c.voice) {
      noVoice.push(c.slug);
      continue;
    }
    const exRows = await db
      .select({ id: exercises.id, key: exercises.key, data: exercises.data, url: exercises.audioUrl, hash: exercises.audioHash })
      .from(exercises)
      .innerJoin(lessons, eq(lessons.id, exercises.lessonId))
      .innerJoin(units, eq(units.id, lessons.unitId))
      .where(
        and(
          eq(units.courseId, c.id),
          isNull(exercises.archivedAt),
          isNull(lessons.archivedAt),
          inArray(exercises.type, ["listen_select", "listen_type"]),
        ),
      );
    const vocabRows = await db
      .select({ id: vocabulary.id, word: vocabulary.word, url: vocabulary.audioUrl, hash: vocabulary.audioHash })
      .from(vocabulary)
      .where(and(eq(vocabulary.courseId, c.id), isNull(vocabulary.archivedAt)));

    const wanted: { item: Item; text: string; url: string | null; hash: string | null }[] = [
      ...exRows.flatMap((e) => {
        const text = audioText(e.data);
        return text
          ? [{ item: { table: "exercises" as const, id: e.id, label: `câu ${e.key}` }, text, url: e.url, hash: e.hash }]
          : [];
      }),
      ...vocabRows.map((v) => ({
        item: { table: "vocabulary" as const, id: v.id, label: `từ "${v.word}"` },
        text: v.word,
        url: v.url,
        hash: v.hash,
      })),
    ];

    for (const w of wanted) {
      const hash = await audioHash(c.voice, w.text);
      if (w.url && w.hash === hash) {
        skipped++;
        continue;
      }
      const key = `${c.slug}/${hash}`;
      const g = groups.get(key) ?? { hash, text: w.text, voice: c.voice, course: c.slug, items: [] };
      g.items.push(w.item);
      groups.set(key, g);
    }
  }
  return { groups: [...groups.values()], skipped, noVoice };
}

async function main(): Promise<number> {
  const { values: args } = parseArgs({
    options: {
      course: { type: "string" },
      "dry-run": { type: "boolean", default: false },
      limit: { type: "string" },
      sample: { type: "string" },
      voice: { type: "string", default: "af_heart" },
    },
  });

  // Nghe thử một giọng trước khi chọn ttsVoice cho khóa; không đụng database hay Storage
  if (args.sample) {
    const file = path.join(REPO_ROOT, "tmp-audio", `${args.voice}-${Date.now()}.mp3`);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, await synthesize({ text: args.sample, voice: args.voice }));
    console.log(`✓ Đã ghi ${path.relative(REPO_ROOT, file)}`);
    return 0;
  }

  const { groups, skipped, noVoice } = await collect(args.course);
  for (const slug of noVoice) console.log(`! Khóa "${slug}" chưa khai báo ttsVoice trong course.yaml, bỏ qua.`);
  const limit = args.limit ? Number(args.limit) : Infinity;
  const todo = groups.slice(0, limit);
  console.log(`Cần sinh: ${groups.length} file âm thanh (cho ${groups.reduce((n, g) => n + g.items.length, 0)} mục) · đã có: ${skipped}`);

  if (args["dry-run"]) {
    for (const g of todo) console.log(`  - [${g.course}] "${g.text}" → ${g.items.map((i) => i.label).join(", ")}`);
    console.log("Chạy thử: không sinh âm thanh, không ghi gì.");
    return 0;
  }
  if (todo.length === 0) {
    console.log("✓ 0 đã sinh · không có gì cần làm.");
    return 0;
  }

  const storage = storageClient();
  if (!storage) {
    console.error("✗ Thiếu SUPABASE_SECRET_KEY trong .env.local (xem .env.example); cần để tải file lên Storage.");
    return 1;
  }
  await ensureBucket(storage);
  console.log("Đang nạp mô hình Kokoro (lần đầu tải khoảng 300 MB, các lần sau dùng cache)…");

  let done = 0;
  let failed = 0;
  for (const [i, g] of todo.entries()) {
    try {
      const mp3 = await synthesize({ text: g.text, voice: g.voice });
      const url = await uploadMp3(storage, `${g.course}/${g.hash}.mp3`, mp3);
      // Chỉ điền đường dẫn sau khi upload xong, nên dừng giữa chừng không để lại đường dẫn hỏng
      const exIds = g.items.filter((it) => it.table === "exercises").map((it) => it.id);
      const vocabIds = g.items.filter((it) => it.table === "vocabulary").map((it) => it.id);
      if (exIds.length)
        await db.update(exercises).set({ audioUrl: url, audioHash: g.hash }).where(inArray(exercises.id, exIds));
      if (vocabIds.length)
        await db.update(vocabulary).set({ audioUrl: url, audioHash: g.hash }).where(inArray(vocabulary.id, vocabIds));
      done++;
      console.log(`  ✓ [${i + 1}/${todo.length}] "${g.text}"`);
    } catch (e) {
      failed++;
      console.log(`  ✗ [${i + 1}/${todo.length}] "${g.text}": ${e instanceof Error ? e.message : e}`);
    }
  }

  console.log(`\n${failed ? "✗" : "✓"} ${done} đã sinh · ${skipped} bỏ qua (đã có) · ${failed} lỗi`);
  if (failed) console.log("Chạy lại lệnh để tiếp tục phần còn thiếu.");
  return failed ? 1 : 0;
}

// Đặt exitCode rồi để tiến trình tự kết thúc: process.exit() làm onnxruntime-node (Kokoro) crash
// lúc thoát trên macOS ("mutex lock failed").
main()
  .then(async (code) => {
    await disposeKokoro();
    await closeDb();
    process.exitCode = code;
  })
  .catch(async (e) => {
    console.error(`✗ ${e instanceof Error ? e.message : e}`);
    await disposeKokoro().catch(() => {});
    await closeDb().catch(() => {});
    process.exitCode = 1;
  });
