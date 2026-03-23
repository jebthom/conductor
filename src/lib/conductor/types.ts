export type Approach = "approach" | "neutral" | "avoid";
export type Affect = "happy" | "sad" | "angry" | "very_happy" | "very_sad" | "very_angry";
export type Character = "A" | "B";

export interface CharacterInfo {
  name: string;
  voice: string;
  secretDetail: string;
}

export interface SceneConfig {
  narratedIntro: string;
  secretBackstory: string;
  characters: Record<Character, CharacterInfo>;
}

export type Phase =
  | "idle"
  | "init"
  | "narrating-intro"
  | "narrating"
  | "locked"
  | "waiting";

export type Candidates = Record<Approach, Record<Affect, string>>;

export interface SelectionState {
  hoveredApproach: Approach | null;
  hoveredAffect: Affect | null;
  approachHeldSince: number | null;
  affectHeldSince: number | null;
  confirmedApproach: Approach | null;
  confirmedAffect: Affect | null;
}

export interface ConductorState {
  phase: Phase;
  sceneConfig: SceneConfig | null;
  turnNumber: number;
  history: string[];
  audioBuffer: AudioBuffer | null;
  candidatesA: Candidates | null;
  candidatesB: Candidates | null;
  activeCharacter: Character | null;
  selection: SelectionState;
  currentLine: string | null;
  speakingCharacter: Character | null;
  pendingLine: string | null;
  pendingCharacter: Character | null;
  pendingApproach: Approach | null;
  pendingAffect: Affect | null;
  pendingAudio: AudioBuffer | null;
  playbackEndedAt: number | null;
  narrationStartTime: number | null;
  narrationDuration: number | null;
  playbackEndTime: number | null;
  sessionId: string | null;
  lineSequence: number;
  lastCandidatesFetchMs: number | null;
}
