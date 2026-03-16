import { NextResponse } from "next/server";
import { getTTS } from "@/lib/providers";

export async function POST(req: Request) {
  try {
    const { text, voice } = await req.json();
    if (!text) {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }

    const tts = getTTS();
    const wavBuffer = await tts.speak(text, voice);

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
