import { NextResponse } from "next/server";
import { getLLM } from "@/lib/providers";
import { buildCandidatePrompt } from "@/lib/conductor/scene";

export async function POST(req: Request) {
  try {
    const { sceneDescription, history } = (await req.json()) as {
      sceneDescription: string;
      history: string[];
    };

    const llm = getLLM();
    const [candidatesA, candidatesB] = await Promise.all([
      llm.generateCandidates(buildCandidatePrompt({ sceneDescription, history, character: "A" })),
      llm.generateCandidates(buildCandidatePrompt({ sceneDescription, history, character: "B" })),
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
