import type { Character } from "./types";

export const SCENE_DESCRIPTION = `Two old friends meet at a coffee shop after years apart. Character A just got fired from their dream job. Character B just got engaged but hasn't told anyone yet. Neither knows the other's news. The conversation is about to get complicated.`;

export function buildCandidatePrompt(input: {
  sceneDescription: string;
  history: string[];
  character: Character;
}): { system: string; user: string } {
  const { sceneDescription, history, character } = input;

  const system = `You write dialogue for a live interactive performance. You MUST respond with ONLY a JSON object, no markdown fences, no explanation.

The JSON has 3 keys: "approach", "neutral", "avoid". Each maps to an object with keys "happy", "sad", "angry". Each value is a single sentence of dialogue.

- "approach": the character moves closer, engages warmly
- "neutral": the character holds position, measured response
- "avoid": the character pulls back, deflects or withdraws

The affects (happy, sad, angry) color the emotional tone of the line.

Character ${character} speaks next. Keep lines natural, conversational, 1 sentence each.`;

  const historyBlock =
    history.length > 0
      ? `\n\nConversation so far:\n${history.join("\n")}`
      : "";

  const user = `Scene: ${sceneDescription}${historyBlock}

Generate 9 candidate lines for Character ${character}.`;

  return { system, user };
}
