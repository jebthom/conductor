import { NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";
import { getTTS } from "@/lib/providers";

export async function POST(req: Request) {
  try {
    const { text, voice, emotion, affect, sessionId, sequence } = await req.json();
    if (!text) {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }

    const tts = getTTS();
    const wavBuffer = await tts.speak(text, voice, emotion, affect);

    // Save WAV to session folder if session is active
    if (sessionId && sequence != null) {
      const filename = String(sequence).padStart(3, "0") + ".wav";
      const filePath = path.join(process.cwd(), "Sessions", sessionId, filename);
      writeFile(filePath, wavBuffer).catch((err) =>
        console.error("Failed to save session audio:", err)
      );
    }

    // Detect content type from buffer header (mp3 starts with FF FB or ID3)
    const isMP3 = (wavBuffer[0] === 0xFF && (wavBuffer[1] & 0xE0) === 0xE0) ||
                  (wavBuffer[0] === 0x49 && wavBuffer[1] === 0x44 && wavBuffer[2] === 0x33);
    const contentType = isMP3 ? "audio/mpeg" : "audio/wav";

    return new NextResponse(new Uint8Array(wavBuffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Length": wavBuffer.length.toString(),
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("TTS error:", msg, error);
    return NextResponse.json(
      { error: `Failed to synthesize speech: ${msg}` },
      { status: 500 }
    );
  }
}
