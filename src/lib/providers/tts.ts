export interface TTSProvider {
  speak(text: string): Promise<Buffer>;
}

export class KokoroTTSProvider implements TTSProvider {
  private model: import("kokoro-js").KokoroTTS | null = null;

  private async getModel() {
    if (!this.model) {
      const { KokoroTTS } = await import("kokoro-js");
      this.model = await KokoroTTS.from_pretrained(
        "onnx-community/Kokoro-82M-v1.0-ONNX",
        { dtype: "q8" }
      );
    }
    return this.model;
  }

  async speak(text: string): Promise<Buffer> {
    const model = await this.getModel();
    const audio = await model.generate(text, { voice: "af_heart" });
    const wav = audio.toWav();
    return Buffer.from(wav);
  }
}
