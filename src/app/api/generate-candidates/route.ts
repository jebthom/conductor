import { NextResponse } from "next/server";
import { buildCandidatePrompt } from "@/lib/conductor/scene";
import { AnthropicProvider } from "@/lib/providers/llm";
import type { SceneConfig } from "@/lib/conductor/types";

export async function POST(req: Request) {
  try {
    const { scene, history, turnNumber, endingTurnsLeft } = (await req.json()) as {
      scene: SceneConfig;
      history: string[];
      turnNumber: number;
      endingTurnsLeft?: number | null;
    };

    // Fan out both character calls in parallel within a single request
    // (two separate browser requests get serialized by Next.js single-threaded worker)
    const llm = new AnthropicProvider();
    const [candidatesA, candidatesB] = await Promise.all([
      llm.generateCandidates(
        buildCandidatePrompt({ scene, history, character: "A", turnNumber, endingTurnsLeft })
      ),
      llm.generateCandidates(
        buildCandidatePrompt({ scene, history, character: "B", turnNumber, endingTurnsLeft })
      ),
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
