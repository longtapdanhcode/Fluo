/** Xáo trộn có seed: server và client ra cùng thứ tự, tránh lỗi hydration. */
export function seededShuffle<T>(items: T[], seed: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const rand = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Phát âm: dùng file audio nếu đã sinh sẵn (TTS lưu trên Storage),
 * nếu chưa có thì dùng giọng đọc có sẵn của trình duyệt (miễn phí, chất lượng tùy máy).
 */
export function speak(text: string, audioUrl?: string | null, slow = false) {
  if (typeof window === "undefined") return;
  if (audioUrl) {
    const audio = new Audio(audioUrl);
    audio.playbackRate = slow ? 0.7 : 1;
    void audio.play();
    return;
  }
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = slow ? 0.6 : 0.95;
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith("en"));
  if (voice) u.voice = voice;
  window.speechSynthesis.speak(u);
}
