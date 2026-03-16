export type Approach = "approach" | "neutral" | "avoid";
export type Affect = "happy" | "sad" | "angry";
export type Character = "A" | "B";

export type Phase =
  | "idle"
  | "init"
  | "narrating-intro"
  | "narrating"
  | "locked"
  | "waiting";

export type Candidates = Record<Approach, Record<Affect, string>>;

export interface SelectionState {
  hoveredCharacter: Character | null;
  hoveredApproach: Approach | null;
  hoveredAffect: Affect | null;
  characterHeldSince: number | null;
  approachHeldSince: number | null;
  affectHeldSince: number | null;
  confirmedCharacter: Character | null;
  confirmedApproach: Approach | null;
  confirmedAffect: Affect | null;
}

export interface ConductorState {
  phase: Phase;
  scene: string;
  history: string[];
  audioBuffer: AudioBuffer | null;
  candidatesA: Candidates | null;
  candidatesB: Candidates | null;
  selection: SelectionState;
  currentLine: string | null;
  speakingCharacter: Character | null;
  narrationStartTime: number | null;
  narrationDuration: number | null;
}
