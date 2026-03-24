import { NextResponse } from "next/server";
import { buildCandidatePrompt } from "@/lib/conductor/scene";
import { AnthropicProvider } from "@/lib/providers/llm";
import type { Character, SceneConfig } from "@/lib/conductor/types";

export async function POST(req: Request) {
  try {
    const { scene, history, turnNumber, character } = (await req.json()) as {
      scene: SceneConfig;
      history: string[];
      turnNumber: number;
      character: Character;
    };

    // Fresh provider per request to avoid shared-client serialization
    const llm = new AnthropicProvider();
    const candidates = await llm.generateCandidates(
      buildCandidatePrompt({ scene, history, character, turnNumber })
    );

    return NextResponse.json({ candidates });
  } catch (error) {
    console.error("Candidate generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate candidates" },
      { status: 500 }
    );
  }
}
