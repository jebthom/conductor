import { NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";
import { getTTS } from "@/lib/providers";

export async function POST(req: Request) {
  try {
    const { text, voice, sessionId, sequence } = await req.json();
    if (!text) {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }

    const tts = getTTS();
    const wavBuffer = await tts.speak(text, voice);

    // Save WAV to session folder if session is active
    if (sessionId && sequence != null) {
      const filename = String(sequence).padStart(3, "0") + ".wav";
      const filePath = path.join(process.cwd(), "Sessions", sessionId, filename);
      writeFile(filePath, wavBuffer).catch((err) =>
        console.error("Failed to save session audio:", err)
      );
    }

    return new NextResponse(new Uint8Array(wavBuffer), {
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": wavBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("TTS error:", error);
    return NextResponse.json(
      { error: "Failed to synthesize speech" },
      { status: 500 }
    );
  }
}
