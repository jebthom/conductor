import { AnthropicProvider, type LLMProvider } from "./llm";
import { KokoroSidecarProvider, ResembleProvider, ElevenLabsProvider, type TTSProvider } from "./tts";

export type { LLMProvider, TTSProvider };

// ── Voice + TTS config — swap provider and voices together ──────────────────

const TTS_CONFIGS = {
  kokoro: {
    create: () => new KokoroSidecarProvider(),
    voices: { female: "af_heart", male: "am_michael" },
  },
  resemble: {
    create: () => new ResembleProvider(),
    voices: { female: "fb2d2858", male: "38a0b764" },
  },
  // alternative female: kXsOSDWolD7e9l1Z0sbH, DODLEQrClDo8wCz460ld
  // alternative male: DwwuoY7Uz8AP8zrY5TAo
  elevenlabs: {
    create: () => new ElevenLabsProvider(),
    voices: { female: "kXsOSDWolD7e9l1Z0sbH", male: "DwwuoY7Uz8AP8zrY5TAo" },
  },
} as const;

// ▸ Change this to switch TTS provider:
// const ACTIVE_TTS: keyof typeof TTS_CONFIGS = "kokoro";
// const ACTIVE_TTS: keyof typeof TTS_CONFIGS = "resemble";
const ACTIVE_TTS: keyof typeof TTS_CONFIGS = "elevenlabs";

const ttsConfig = TTS_CONFIGS[ACTIVE_TTS];

export function getVoices() {
  return ttsConfig.voices;
}

// ── Singleton instances ─────────────────────────────────────────────────────

let llm: LLMProvider | null = null;
let tts: TTSProvider | null = null;

export function getLLM(): LLMProvider {
  if (!llm) llm = new AnthropicProvider();
  return llm;
}

export function getTTS(): TTSProvider {
  if (!tts) tts = ttsConfig.create();
  return tts;
}
