import { NextResponse } from "next/server";
import { appendFile } from "fs/promises";
import path from "path";

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

export async function POST(req: Request) {
  try {
    const { sessionId, sequence, character, approach, affect, text, durationSec, llmMs, ttsMs } = await req.json();

    if (!sessionId || sequence == null) {
      return NextResponse.json({ error: "Missing sessionId or sequence" }, { status: 400 });
    }

    const seqStr = String(sequence);
    const audioFile = String(sequence).padStart(3, "0") + ".wav";
    const dur = durationSec != null ? Number(durationSec).toFixed(2) : "";
    const llm = llmMs != null ? String(Math.round(llmMs)) : "";
    const tts = ttsMs != null ? String(Math.round(ttsMs)) : "";

    const row = [
      seqStr,
      character ?? "",
      approach ?? "",
      affect ?? "",
      audioFile,
      dur,
      llm,
      tts,
      csvEscape(text ?? ""),
    ].join(",") + "\n";

    const csvPath = path.join(process.cwd(), "Sessions", sessionId, "session.csv");
    await appendFile(csvPath, row, "utf-8");

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Session line error:", error);
    return NextResponse.json({ error: "Failed to log line" }, { status: 500 });
  }
}
