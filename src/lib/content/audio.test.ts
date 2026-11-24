import { describe, expect, it } from "vitest";
import { audioHash, audioText } from "./audio";
import { planSync } from "./sync";
import { DEMO, applyPlan, emptySnapshot, makeTree } from "./testing";

describe("audioText", () => {
  it("chỉ dạng nghe mới có văn bản đọc", () => {
    expect(audioText({ type: "listen_select", audioText: "Hi", choices: ["a", "b"], answerIndex: 0 })).toBe("Hi");
    expect(audioText({ type: "listen_type", audioText: "Hi", answer: "Hi", acceptable: [] })).toBe("Hi");
    expect(audioText({ type: "word_bank", answer: ["a", "b"], distractors: [] })).toBeNull();
  });
});

describe("audioHash", () => {
  it("ổn định, đổi khi giọng hoặc văn bản đổi", async () => {
    const a = await audioHash("af_heart", "Hello");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await audioHash("af_heart", "Hello")).toBe(a);
    expect(await audioHash("af_bella", "Hello")).not.toBe(a);
    expect(await audioHash("af_heart", "Hello!")).not.toBe(a);
  });
});

describe("planSync giữ / bỏ âm thanh (FR-017)", () => {
  const HELLO = "content/demo/01-greetings/01-hello.yaml";

  async function withAudio() {
    const snap = applyPlan(emptySnapshot(), await planSync(makeTree(), emptySnapshot()));
    const ex = snap.exercises.find((e) => e.data.type === "listen_select")!;
    ex.audioUrl = "https://cdn/x.mp3";
    ex.audioHash = await audioHash("af_heart", "Good morning");
    return { snap, ex };
  }

  it("văn bản đọc không đổi → giữ nguyên âm thanh", async () => {
    const { snap } = await withAudio();
    expect((await planSync(makeTree(), snap)).isEmpty).toBe(true);
  });

  it("văn bản đọc đổi → bỏ audio_url để sinh lại", async () => {
    const { snap, ex } = await withAudio();
    const tree = makeTree({ [HELLO]: DEMO[HELLO].replace("audioText: Good morning", "audioText: Good morning, Anna") });
    const plan = await planSync(tree, snap);
    expect(plan.exercises.update.find((u) => u.id === ex.id)?.values).toMatchObject({ audioUrl: null, audioHash: null });
  });

  it("đổi giọng của khóa → bỏ âm thanh cũ", async () => {
    const { snap, ex } = await withAudio();
    const COURSE = "content/demo/course.yaml";
    const plan = await planSync(makeTree({ [COURSE]: DEMO[COURSE].replace("af_heart", "bf_emma") }), snap);
    expect(plan.exercises.update.find((u) => u.id === ex.id)?.values).toMatchObject({ audioUrl: null });
  });
});
