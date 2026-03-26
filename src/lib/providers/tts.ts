export interface TTSProvider {
  speak(text: string, voice?: string, emotion?: string, affect?: string): Promise<Buffer>;
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

/** Resemble AI Chatterbox Turbo — synchronous synthesis */
export class ResembleProvider implements TTSProvider {
  private apiKey: string;
  private baseUrl: string;

  constructor(
    apiKey = process.env.RESEMBLE_API_KEY!,
    baseUrl = "https://f.cluster.resemble.ai"
  ) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async speak(text: string, voice?: string, emotion?: string): Promise<Buffer> {
    const voiceUuid = voice ?? process.env.RESEMBLE_VOICE_UUID!;

    // Wrap in SSML with emotion prompt if provided
    let data = text;
    if (emotion) {
      data = `<speak prompt="${emotion}">${text}</speak>`;
    }

    const res = await fetch(`${this.baseUrl}/synthesize`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        voice_uuid: voiceUuid,
        data,
        model: "chatterbox-turbo",
        output_format: "wav",
        sample_rate: 44100,
        precision: "PCM_16",
        use_hd: false,
      }),
    });

    if (!res.ok) {
      throw new Error(`Resemble sync error: ${res.status} ${await res.text()}`);
    }

    const json = await res.json();
    if (!json.success) {
      throw new Error(`Resemble synthesis failed: ${json.issues?.join(", ")}`);
    }

    return Buffer.from(json.audio_content, "base64");
  }
}

/** ElevenLabs Turbo v2.5 — per-affect voice settings */
export class ElevenLabsProvider implements TTSProvider {
  private client: import("@elevenlabs/elevenlabs-js").ElevenLabsClient | null = null;

  private async getClient() {
    if (!this.client) {
      const { ElevenLabsClient } = await import("@elevenlabs/elevenlabs-js");
      this.client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY! });
    }
    return this.client;
  }

  // Affect → { stability, style } mapping
  // Lower stability = more expressive; higher style = more character
  private static VOICE_SETTINGS: Record<string, { stability: number; style: number }> = {
    happy:      { stability: 0.3, style: 0.6 },
    sad:        { stability: 0.4, style: 0.4 },
    angry:      { stability: 0.3, style: 0.8 },
    very_happy: { stability: 0.1, style: 0.6 },
    very_sad:   { stability: 0.2, style: 0.4 },
    very_angry: { stability: 0.1, style: 0.8 },
  };

  private static DEFAULT_SETTINGS = { stability: 0.5, style: 0.0 };

  async speak(text: string, voice?: string, _emotion?: string, affect?: string): Promise<Buffer> {
    const client = await this.getClient();
    const voiceId = voice ?? process.env.ELEVENLABS_VOICE_ID!;
    const settings = affect
      ? (ElevenLabsProvider.VOICE_SETTINGS[affect] ?? ElevenLabsProvider.DEFAULT_SETTINGS)
      : ElevenLabsProvider.DEFAULT_SETTINGS;

    const audio = await client.textToSpeech.convert(voiceId, {
      text,
      modelId: "eleven_turbo_v2_5",
      outputFormat: "mp3_44100_128",
      voiceSettings: {
        stability: settings.stability,
        similarityBoost: 0.75,
        style: settings.style,
        useSpeakerBoost: true,
      },
    });

    // audio may be a ReadableStream or AsyncIterable depending on environment
    const chunks: Uint8Array[] = [];
    if (audio instanceof ReadableStream) {
      const reader = audio.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }
    } else {
      for await (const chunk of audio as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
      }
    }
    return Buffer.concat(chunks);
  }
}
