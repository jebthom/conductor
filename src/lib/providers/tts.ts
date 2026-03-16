export interface TTSProvider {
  speak(text: string, voice?: string): Promise<Buffer>;
}

/** Calls the Python Kokoro TTS sidecar (GPU-accelerated) */
export class KokoroSidecarProvider implements TTSProvider {
  private baseUrl: string;

  constructor(baseUrl = "http://127.0.0.1:5100") {
    this.baseUrl = baseUrl;
  }

  async speak(text: string, voice = "af_heart"): Promise<Buffer> {
    const res = await fetch(`${this.baseUrl}/speak`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice, speed: 0.8 }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`TTS sidecar error: ${err}`);
    }

    const arrayBuf = await res.arrayBuffer();
    return Buffer.from(arrayBuf);
  }
}
