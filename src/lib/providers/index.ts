import { AnthropicProvider, type LLMProvider } from "./llm";
import { KokoroTTSProvider, type TTSProvider } from "./tts";

export type { LLMProvider, TTSProvider };

// Singleton instances — swap providers here
let llm: LLMProvider | null = null;
let tts: TTSProvider | null = null;

export function getLLM(): LLMProvider {
  if (!llm) llm = new AnthropicProvider();
  return llm;
}

export function getTTS(): TTSProvider {
  if (!tts) tts = new KokoroTTSProvider();
  return tts;
}
