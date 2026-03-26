import type { Approach, Affect, AffectCategory, Character, SceneConfig } from "./types";
import { getVoices } from "@/lib/providers";

// ── Randomization pools ─────────────────────────────────────────────────────

const NAMES_FEMALE = ["Elena", "Margot", "Delia", "Simone", "Nadia", "Vera", "Iris", "Cleo"];
const NAMES_MALE = ["Marcus", "Julian", "Declan", "Anton", "Samir", "Leo", "Rafe", "Theo"];

// const SETTINGS = [
//   "a near-empty hotel bar at 2 AM",
//   "a rain-soaked park bench at dusk",
//   "a hospital waiting room after visiting hours",
//   "the roof of their old apartment building",
//   "a ferry crossing on a grey morning",
//   "a half-packed kitchen the night before a move",
// ];
const SETTING = "the roof of their old apartment building";

// ── Surface secrets (mild, character-establishing) ──────────────────────────

const SURFACE_SECRETS_A = [
  "She hasn't been home in three years and her family doesn't know where she is.",
  "She quit her job last month and hasn't told anyone yet.",
  "She's been writing letters she never sends.",
  "She came here tonight to say goodbye, but hasn't found the words.",
  "She's been carrying a photograph she found in his old apartment.",
  "She knows his phone number by heart but has never called.",
];

const SURFACE_SECRETS_B = [
  "He's been sleeping on a friend's couch for the past two weeks.",
  "He drove four hours to be here and told no one where he was going.",
  "He's been sober for sixty days and counting.",
  "He's wearing his father's watch — the one he swore he'd never put on.",
  "He almost didn't come tonight.",
  "He's been rehearsing what to say for weeks.",
];

// ── Core secrets (intense, affect-categorized) ──────────────────────────────

const CORE_SECRETS_A: Record<AffectCategory, string[]> = {
  happy: [
    "She's pregnant and he's the only person she wants to tell.",
    "She got the letter — she's been accepted to the program she's dreamed about since she was sixteen.",
    "She realized she's still in love with him and it's the first thing that's made her feel alive in years.",
  ],
  sad: [
    "She found out her mother is dying and she can't go home to see her.",
    "She's been diagnosed with something she can't bring herself to name.",
    "She scattered her best friend's ashes last Tuesday and hasn't cried yet.",
  ],
  angry: [
    "She found the emails — she knows exactly what he did and who he did it with.",
    "She discovered he's been lying about where the money went — all of it.",
    "She has proof that he's the one who reported her to the board.",
  ],
};

const CORE_SECRETS_B: Record<AffectCategory, string[]> = {
  happy: [
    "He just found out he has a daughter he never knew about, and she wants to meet him.",
    "He sold everything and bought two plane tickets — one for her, if she'll take it.",
    "He's been offered a second chance he thought was impossible and he's terrified to believe it.",
  ],
  sad: [
    "He just got back from identifying a body and he hasn't told anyone whose it was.",
    "He's been writing a will because the doctors gave him a number and it wasn't a big one.",
    "He watched the building they grew up in get demolished last week and stood there until dark.",
  ],
  angry: [
    "He knows she's the one who turned him in — he has the recording.",
    "He found out the whole thing was a setup and she was in on it from the start.",
    "He just learned that the person who destroyed his career did it as a favor to her.",
  ],
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Affect category helpers ─────────────────────────────────────────────────

export function affectToCategory(affect: Affect): AffectCategory {
  if (affect === "happy" || affect === "very_happy") return "happy";
  if (affect === "sad" || affect === "very_sad") return "sad";
  return "angry";
}

export function getAffectWinner(history: AffectCategory[]): AffectCategory | null {
  const counts: Record<AffectCategory, number> = { happy: 0, sad: 0, angry: 0 };
  for (const cat of history) counts[cat]++;
  const sorted = (Object.entries(counts) as [AffectCategory, number][]).sort((a, b) => b[1] - a[1]);
  if (sorted[0][1] > sorted[1][1]) return sorted[0][0];
  return null; // tie — keep tracking
}

/** Pick core secrets for both characters from the given affect category. */
export function assignCoreSecrets(scene: SceneConfig, category: AffectCategory): SceneConfig {
  return {
    ...scene,
    characters: {
      A: { ...scene.characters.A, coreSecret: pick(CORE_SECRETS_A[category]) },
      B: { ...scene.characters.B, coreSecret: pick(CORE_SECRETS_B[category]) },
    },
  };
}

// ── Scene creation ──────────────────────────────────────────────────────────

export function createScene(): SceneConfig {
  const nameA = pick(NAMES_FEMALE);
  let nameB = pick(NAMES_MALE);
  while (nameB === nameA) nameB = pick(NAMES_MALE);

  const narratedIntro = `${nameA} and ${nameB} find themselves on ${SETTING}. They haven't spoken in a long time, and neither expected to be here tonight.`;

  return {
    narratedIntro,
    characters: {
      A: { name: nameA, voice: getVoices().female, surfaceSecret: pick(SURFACE_SECRETS_A), coreSecret: null },
      B: { name: nameB, voice: getVoices().male, surfaceSecret: pick(SURFACE_SECRETS_B), coreSecret: null },
    },
  };
}

// ── Combo descriptors ───────────────────────────────────────────────────────

const COMBO_DESCRIPTORS: Record<Approach, Record<Affect, string>> = {
  approach: {
    happy: "Reveals something true and personal. Makes a concrete offer, admission, or declaration. Names a specific memory, fact, or feeling — no hedging.",
    sad: "Confesses something painful. Says the thing they've been holding back — a regret, a loss, an uncomfortable truth. Specific and vulnerable.",
    angry: "Confronts directly with a specific accusation or demand. Names what the other person did, asks the hard question, draws the line.",
    very_happy: "Overwhelmed with emotion — a breathless, unguarded declaration of love, gratitude, or devotion. Melodramatically sincere, holding nothing back. Grand, operatic, embarrassingly earnest.",
    very_sad: "Completely broken. A raw, shaking confession of devastation — the kind of admission that strips away all dignity. Theatrical grief, voice-cracking vulnerability.",
    very_angry: "Explosive, righteous fury. A scorching accusation delivered with theatrical force — names the betrayal, the lie, the unforgivable thing, and demands an answer NOW.",
  },
  neutral: {
    happy: "Makes an observation that shifts the conversation's direction. Notices something specific — about the other person, the situation, or what was just said — that opens a new thread.",
    sad: "States a hard truth plainly, without drama. Acknowledges something both of them know but haven't said. Matter-of-fact, not self-pitying.",
    angry: "Calls out a pattern or contradiction. Points to something specific the other person is doing right now in this conversation — deflecting, lying, performing.",
    very_happy: "A sudden, almost manic burst of clarity — sees the beautiful absurdity of the whole situation and can't help laughing about it. Giddily philosophical, theatrically delighted by the irony.",
    very_sad: "Delivers a devastating observation with eerie calm — the quiet voice of someone who has already given up. Melodramatically resigned, as though narrating their own tragedy.",
    very_angry: "Coldly furious dissection — a clinical, devastating enumeration of exactly how the other person has failed. Theatrical precision, each word placed like a scalpel.",
  },
  avoid: {
    happy: "Changes the subject to something concrete and specific — a memory, a joke, a plan — that clearly sidesteps what was just raised. The avoidance itself reveals something.",
    sad: "Shuts down with finality. Says something that closes a door — gives up on a point, concedes a loss, accepts something painful. Not vague withdrawal but a specific surrender.",
    angry: "Lashes out while deflecting — a specific, cutting observation about the other person that redirects the heat away from themselves. Weaponizes a truth to avoid being the one exposed.",
    very_happy: "Manically cheerful deflection — launches into an absurdly elaborate tangent or performance, the desperate theatricality itself revealing how much they need to escape this moment.",
    very_sad: "A melodramatic farewell or surrender — announces they're done, can't do this anymore, delivers a devastating exit line. Grand, operatic withdrawal that says everything by saying goodbye.",
    very_angry: "Nuclear deflection — a spectacularly cruel, personal attack designed to end the conversation entirely. Goes for the jugular with theatrical venom, scorched earth to avoid being vulnerable.",
  },
};

// ── Prompt builder ──────────────────────────────────────────────────────────

export function buildCandidatePrompt(input: {
  scene: SceneConfig;
  history: string[];
  character: Character;
  turnNumber: number;
  endingTurnsLeft?: number | null;
}): { system: string; user: string } {
  const { scene, history, character, turnNumber, endingTurnsLeft } = input;
  const charA = scene.characters.A;
  const charB = scene.characters.B;
  const name = scene.characters[character].name;

  const approaches: Approach[] = ["approach", "neutral", "avoid"];
  const affects: Affect[] = ["happy", "sad", "angry", "very_happy", "very_sad", "very_angry"];

  const comboLines = approaches
    .flatMap((app) =>
      affects.map((aff) => `- ${app}/${aff}: ${COMBO_DESCRIPTORS[app][aff]}`)
    )
    .join("\n");

  const system = `You write dialogue for a live interactive performance.
Respond with ONLY a JSON object — no markdown fences, no explanation.

The JSON has 3 keys: "approach", "neutral", "avoid".
Each maps to an object with keys "happy", "sad", "angry", "very_happy", "very_sad", "very_angry".
Each value is a single sentence of natural spoken dialogue.
The "very_" variants are melodramatically intense — operatic, theatrical, grand in scale.

HOW DETAILS WORK:
- "approach" and "neutral" lines may surface secrets from the backstory that haven't been spoken aloud yet. They bring buried truths into the open — as confessions, accusations, or observations.
- "avoid" lines must ONLY reference details already spoken in the conversation history. They redirect, reframe, or weaponize what's already on the table — they never introduce new information.
- No line should promise a future reveal ("there's something I need to tell you"). Either say the thing or don't.
What each combination means:
${comboLines}

Respect the approach and affect exactly.`;

  // ── Build backstory block ───────────────────────────────────────────────
  const backstoryLines: string[] = [];
  backstoryLines.push(`${charA.name}'s surface detail: ${charA.surfaceSecret}`);
  if (charA.coreSecret) backstoryLines.push(`${charA.name}'s deeper secret: ${charA.coreSecret}`);
  backstoryLines.push(`${charB.name}'s surface detail: ${charB.surfaceSecret}`);
  if (charB.coreSecret) backstoryLines.push(`${charB.name}'s deeper secret: ${charB.coreSecret}`);
  const backstoryBlock = backstoryLines.join("\n");

  let turnPressure: string;
  if (endingTurnsLeft === 1) {
    turnPressure = "THIS IS THE SECOND-TO-LAST LINE. Begin wrapping up — land the emotional arc, start bringing threads together.";
  } else if (endingTurnsLeft === 0) {
    turnPressure = "THIS IS THE FINAL LINE OF THE SCENE. Make it count — deliver the last word, the closing image, the thing that lingers.";
  } else if (turnNumber <= 5) {
    turnPressure = "The conversation is just beginning.";
  } else if (turnNumber <= 10) {
    turnPressure = "The conversation is deepening.";
  } else if (turnNumber <= 15) {
    turnPressure = "The conversation is reaching its climax.";
  } else {
    turnPressure = "This may be the last exchange.";
  }

  const historyBlock =
    history.length > 0
      ? `\n\nConversation so far:\n${history.join("\n")}`
      : "";

  const user = `Scene: ${scene.narratedIntro}

${backstoryBlock}

${name} speaks next. This is exchange ${turnNumber} of roughly 20.
${turnPressure}${historyBlock}

Generate 18 candidate lines for ${name}.`;

  return { system, user };
}
