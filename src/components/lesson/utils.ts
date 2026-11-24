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

const VIETNAMESE = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

/** Có dấu tiếng Việt thì là chữ tiếng Việt: không đọc, vì giọng đọc là giọng tiếng Anh. */
export function isVietnamese(text: string): boolean {
  return VIETNAMESE.test(text);
}

/** Âm thanh đang phát (mỗi lúc chỉ một). */
let current: { key: string; stop: () => void; playing: () => boolean } | null = null;

/**
 * Phát âm: dùng file audio nếu đã sinh sẵn (TTS lưu trên Storage),
 * nếu chưa có thì dùng giọng đọc có sẵn của trình duyệt (miễn phí, chất lượng tùy máy).
 * Bấm lại đúng chỗ đang phát thì bỏ qua; bấm chỗ khác thì dừng câu cũ rồi đọc câu mới.
 */
export function speak(text: string, audioUrl?: string | null, slow = false) {
  if (typeof window === "undefined" || isVietnamese(text)) return;
  const key = `${audioUrl ?? text}|${slow}`;
  if (current?.playing()) {
    if (current.key === key) return;
    current.stop();
  }
  if (audioUrl) {
    const audio = new Audio(audioUrl);
    audio.playbackRate = slow ? 0.7 : 1;
    let failed = false;
    current = {
      key,
      stop: () => audio.pause(),
      playing: () => !failed && !audio.paused && !audio.ended,
    };
    // File lỗi hoặc không tải được thì quay về giọng của trình duyệt
    audio.play().catch(() => {
      failed = true;
      speakWithBrowser(text, slow, key);
    });
    return;
  }
  speakWithBrowser(text, slow, key);
}

function speakWithBrowser(text: string, slow: boolean, key: string) {
  if (!("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = slow ? 0.6 : 0.95;
  const voice = synth.getVoices().find((v) => v.lang.startsWith("en"));
  if (voice) u.voice = voice;
  let done = false;
  u.onend = u.onerror = () => {
    done = true;
  };
  current = { key, stop: () => synth.cancel(), playing: () => !done };
  synth.speak(u);
}
