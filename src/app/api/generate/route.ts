import { NextResponse } from "next/server";
import { getLLM } from "@/lib/providers";

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    const llm = getLLM();
    const text = await llm.generate(prompt || "Say two interesting sentences about music and movement.");
    return NextResponse.json({ text });
  } catch (error) {
    console.error("LLM error:", error);
    return NextResponse.json(
      { error: "Failed to generate text" },
      { status: 500 }
    );
  }
}
