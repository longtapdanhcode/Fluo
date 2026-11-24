/**
 * Sinh giọng đọc bằng Kokoro-82M chạy trên máy (research R3): miễn phí, không cần tài khoản hay khóa,
 * giấy phép Apache-2.0. Lần chạy đầu tải mô hình từ Hugging Face rồi lưu cache, các lần sau chạy offline.
 * Kokoro trả về PCM 24 kHz; mã hóa sang mp3 mono 48 kbps để file nhỏ và phát được trên mọi trình duyệt.
 */
import type { KokoroTTS } from "kokoro-js";

export const KOKORO_MODEL = "onnx-community/Kokoro-82M-v1.0-ONNX";
/** fp32 cho chất lượng tốt nhất; mô hình nhỏ (82M) nên vẫn nhanh trên CPU. */
const DTYPE = "fp32";
const BITRATE_KBPS = 48;

let model: Promise<KokoroTTS> | null = null;

function loadModel(): Promise<KokoroTTS> {
  model ??= import("kokoro-js").then(({ KokoroTTS }) =>
    KokoroTTS.from_pretrained(KOKORO_MODEL, { dtype: DTYPE, device: "cpu" }),
  );
  return model;
}

/**
 * Giải phóng mô hình trước khi thoát. Không gọi thì onnxruntime-node có thể crash lúc process.exit
 * ("mutex lock failed") vì luồng của nó còn chạy.
 */
export async function disposeKokoro() {
  if (!model) return;
  const tts = await model.catch(() => null);
  model = null;
  await tts?.model.dispose();
}

/** Danh sách giọng hợp lệ (ví dụ af_heart, af_bella, bm_george). */
export async function kokoroVoices(): Promise<string[]> {
  return Object.keys((await loadModel()).voices);
}

async function encodeMp3(samples: Float32Array, sampleRate: number): Promise<Uint8Array> {
  const { Mp3Encoder } = await import("@breezystack/lamejs");
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const encoder = new Mp3Encoder(1, sampleRate, BITRATE_KBPS);
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < pcm.length; i += 1152) {
    const out = encoder.encodeBuffer(pcm.subarray(i, i + 1152));
    if (out.length) chunks.push(new Uint8Array(out));
  }
  const tail = encoder.flush();
  if (tail.length) chunks.push(new Uint8Array(tail));
  const mp3 = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let offset = 0;
  for (const c of chunks) {
    mp3.set(c, offset);
    offset += c.length;
  }
  return mp3;
}

/** Sinh mp3 cho một câu. Giọng sai tên thì báo lỗi kèm danh sách giọng hợp lệ. */
export async function synthesize(input: { text: string; voice: string }): Promise<Uint8Array> {
  const tts = await loadModel();
  if (!Object.hasOwn(tts.voices, input.voice)) {
    throw new Error(`Giọng "${input.voice}" không có trong Kokoro. Chọn một trong: ${Object.keys(tts.voices).join(", ")}`);
  }
  const audio = await tts.generate(input.text, { voice: input.voice as keyof typeof tts.voices });
  return encodeMp3(audio.audio, audio.sampling_rate);
}
