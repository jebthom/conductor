import type { Approach, Affect, Character, SceneConfig } from "./types";

// ── Randomization pools ─────────────────────────────────────────────────────

const NAMES_FEMALE = ["Elena", "Margot", "Delia", "Simone", "Nadia", "Vera", "Iris", "Cleo"];
const NAMES_MALE = ["Marcus", "Julian", "Declan", "Anton", "Samir", "Leo", "Rafe", "Theo"];

const SECRETS_A = [
  "She stole from his family's business and was never caught.",
  "She's been secretly recording their conversations for months.",
  "She once testified against someone innocent to protect herself.",
  "She's the reason his last relationship ended, though he doesn't know it.",
  "She's been offered a position that would require betraying his trust.",
  "She discovered something about his past that could ruin him.",
];

const SECRETS_B = [
  "He just found out he's terminally ill and has told no one.",
  "He's been living under a false identity for the past three years.",
  "He witnessed something terrible and chose to stay silent.",
  "He's about to disappear — new city, new name, no goodbyes.",
  "He recently learned they share a connection neither of them suspects.",
  "He's carrying a message from someone she thought was dead.",
];

const SECRETS_SHARED = [
  "They both covered up an incident in college that ruined someone's life.",
  "They were both involved in the same betrayal, each thinking the other doesn't know.",
  "They each separately promised the same dying person they'd take care of the other.",
  "They both know a secret about a mutual friend that could destroy everything.",
  "They once made a pact they swore never to speak of again.",
  "They were both witnesses to something they agreed to forget.",
];

const SETTINGS = [
  "a near-empty hotel bar at 2 AM",
  "a rain-soaked park bench at dusk",
  "a hospital waiting room after visiting hours",
  "the roof of their old apartment building",
  "a ferry crossing on a grey morning",
  "a half-packed kitchen the night before a move",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Scene creation ──────────────────────────────────────────────────────────

export function createScene(): SceneConfig {
  const nameA = pick(NAMES_FEMALE);
  let nameB = pick(NAMES_MALE);
  while (nameB === nameA) nameB = pick(NAMES_MALE);

  const secretA = pick(SECRETS_A);
  const secretB = pick(SECRETS_B);
  const secretShared = pick(SECRETS_SHARED);
  const setting = pick(SETTINGS);

  const narratedIntro = `${nameA} and ${nameB} find themselves at ${setting}. They haven't spoken in a long time, and neither expected to be here tonight.`;

  const secretBackstory = [
    "NEVER reference these secrets directly — let them bleed into subtext, coloring word choice and emotional weight.",
    "",
    `${nameA}'s secret: ${secretA}`,
    `${nameB}'s secret: ${secretB}`,
    `Shared secret: ${secretShared}`,
  ].join("\n");

  return {
    narratedIntro,
    secretBackstory,
    characters: {
      A: { name: nameA, voice: "af_heart", secretDetail: secretA },
      B: { name: nameB, voice: "am_michael", secretDetail: secretB },
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
}): { system: string; user: string } {
  const { scene, history, character, turnNumber } = input;
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
- Do not invent details beyond what the backstory provides.

What each combination means:
${comboLines}

Respect the approach and affect exactly.`;

  let turnPressure: string;
  if (turnNumber <= 5) turnPressure = "The conversation is just beginning.";
  else if (turnNumber <= 10) turnPressure = "The conversation is deepening.";
  else if (turnNumber <= 15) turnPressure = "The conversation is reaching its climax.";
  else turnPressure = "This may be the last exchange.";

  const historyBlock =
    history.length > 0
      ? `\n\nConversation so far:\n${history.join("\n")}`
      : "";

  const user = `Scene: ${scene.narratedIntro}

${scene.secretBackstory}

${name} speaks next. This is exchange ${turnNumber} of roughly 20.
${turnPressure}${historyBlock}

Generate 18 candidate lines for ${name}.`;

  return { system, user };
}
