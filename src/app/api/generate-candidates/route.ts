import { NextResponse } from "next/server";
import { getLLM } from "@/lib/providers";
import { buildCandidatePrompt } from "@/lib/conductor/scene";
import type { SceneConfig } from "@/lib/conductor/types";

export async function POST(req: Request) {
  try {
    const { scene, history, turnNumber } = (await req.json()) as {
      scene: SceneConfig;
      history: string[];
      turnNumber: number;
    };

    const llm = getLLM();
    const [candidatesA, candidatesB] = await Promise.all([
      llm.generateCandidates(buildCandidatePrompt({ scene, history, character: "A", turnNumber })),
      llm.generateCandidates(buildCandidatePrompt({ scene, history, character: "B", turnNumber })),
    ]);

    return NextResponse.json({ candidatesA, candidatesB });
  } catch (error) {
    console.error("Candidate generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate candidates" },
      { status: 500 }
    );
  }
}
