import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

export async function POST(req: Request) {
  try {
    const { sceneDescription } = await req.json();

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const sessionId = [
      now.getFullYear(),
      pad(now.getMonth() + 1),
      pad(now.getDate()),
    ].join("-") + "_" + [
      pad(now.getHours()),
      pad(now.getMinutes()),
      pad(now.getSeconds()),
    ].join("-");

    const sessionDir = path.join(process.cwd(), "Sessions", sessionId);
    await mkdir(sessionDir, { recursive: true });

    const header =
      `# ${sessionId} | ${sceneDescription ?? ""}\n` +
      `sequence,character,approach,affect,audio_file,duration_sec,llm_ms,tts_ms,text\n`;
    await writeFile(path.join(sessionDir, "session.csv"), header, "utf-8");

    return NextResponse.json({ sessionId });
  } catch (error) {
    console.error("Session start error:", error);
    return NextResponse.json({ error: "Failed to start session" }, { status: 500 });
  }
}
