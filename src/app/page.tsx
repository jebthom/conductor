"use client";

import { useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { useConductor } from "@/lib/conductor/useConductor";
import type { Approach, Affect } from "@/lib/conductor/types";

const PoseViewer = dynamic(() => import("@/components/PoseViewer"), {
  ssr: false,
});

// ── Tutorial / description text ─────────────────────────────────────────────

const COMBO_TEXT: Record<Approach, Record<Affect, string>> = {
  approach: {
    happy: "A warm confession — sharing something true and personal",
    sad: "A painful admission — saying the thing they've been holding back",
    angry: "A direct confrontation — naming what the other person did",
    very_happy: "An overwhelming declaration — breathless, unguarded devotion",
    very_sad: "A devastating confession — raw, dignity-stripping vulnerability",
    very_angry: "Explosive fury — a scorching accusation demanding answers",
  },
  neutral: {
    happy: "A bright observation — noticing something that opens a new thread",
    sad: "A plain hard truth — acknowledging what both already know",
    angry: "A sharp callout — pointing to a pattern or contradiction",
    very_happy: "Giddy clarity — laughing at the beautiful absurdity of it all",
    very_sad: "Eerie calm — the quiet voice of someone who's already given up",
    very_angry: "Cold dissection — clinically naming exactly how they failed",
  },
  avoid: {
    happy: "A cheerful dodge — changing the subject to a memory or joke",
    sad: "A quiet surrender — closing a door, accepting something painful",
    angry: "A cutting deflection — weaponizing a truth to redirect the heat",
    very_happy: "Manic cheerfulness — desperate theatrical escape from the moment",
    very_sad: "A grand farewell — saying everything by walking away",
    very_angry: "Nuclear deflection — a spectacularly cruel attack to end it all",
  },
};

const APPROACH_TEXT: Record<Approach, string> = {
  approach: "Lean in — reveal, confess, or confront",
  neutral: "Hold steady — observe, acknowledge, or redirect",
  avoid: "Pull back — deflect, shut down, or escape",
};

const AFFECT_TEXT: Record<Affect, string> = {
  happy: "Warm — joy, gratitude, connection",
  sad: "Heavy — grief, regret, loss",
  angry: "Sharp — accusation, demand, confrontation",
  very_happy: "Elated — overwhelming, operatic joy",
  very_sad: "Devastated — raw, theatrical grief",
  very_angry: "Furious — explosive, scorching rage",
};

const CHARACTER_TEXT: Record<"A" | "B", string> = {
  A: "You'll speak as this character next",
  B: "You'll speak as this character next",
};

const IDLE_TEXT = "Move your hands into the zones to shape the conversation";

function getTutorialText(
  approach: Approach | null,
  affect: Affect | null,
  character: "A" | "B" | null,
  charNames: { A: string; B: string } | null
): string {
  if (approach && affect) return COMBO_TEXT[approach][affect];
  if (approach) return APPROACH_TEXT[approach];
  if (affect) return AFFECT_TEXT[affect];
  if (character && charNames) return `${charNames[character]} — ${CHARACTER_TEXT[character]}`;
  if (character) return `Character ${character} — ${CHARACTER_TEXT[character]}`;
  return IDLE_TEXT;
}

export default function Home() {
  const { state, start, handleCharacterSelect, handleApproachUpdate, handleAffectUpdate, handleInstantApproach, handleInstantAffect, handleBeginEnding } = useConductor();

  const onCharacterSelect = useCallback(
    (character: "A" | "B") => handleCharacterSelect(character),
    [handleCharacterSelect]
  );

  const onApproachHover = useCallback(
    (approach: Approach | null) => handleApproachUpdate(approach),
    [handleApproachUpdate]
  );

  const onAffectHover = useCallback(
    (affect: Affect | null) => handleAffectUpdate(affect),
    [handleAffectUpdate]
  );

  // ── Keyboard controls (dev) ──────────────────────────────────────────────

  useEffect(() => {
    const APPROACH_KEYS: Record<string, Approach> = { w: "approach", s: "neutral", x: "avoid" };
    const AFFECT_KEYS: Record<string, Affect> = {
      ArrowUp: "happy", ArrowLeft: "sad", ArrowRight: "angry",
      "1": "very_happy", "2": "very_sad", "3": "very_angry",
    };
    const CHAR_KEYS: Record<string, "A" | "B"> = { q: "A", e: "B" };

    function onKeyDown(e: KeyboardEvent) {
      if (e.repeat) return;

      const char = CHAR_KEYS[e.key];
      if (char) { handleCharacterSelect(char); return; }

      const approach = APPROACH_KEYS[e.key];
      if (approach) { handleInstantApproach(approach); return; }

      const affect = AFFECT_KEYS[e.key];
      if (affect) { handleInstantAffect(affect); return; }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleCharacterSelect, handleInstantApproach, handleInstantAffect]);

  const phaseLabel = (() => {
    switch (state.phase) {
      case "idle":
        return "Hold your hand over Start to begin";
      case "init":
        return "Loading scene...";
      case "narrating-intro":
        return "Narrating scene...";
      case "narrating":
        return "Speaking...";
      case "locked":
        return "Preparing speech...";
      case "waiting":
        return "Waiting for selection...";
      case "finished":
        return "Scene complete.";
      default:
        return state.phase;
    }
  })();

  const sel = state.selection;
  const charNames = state.sceneConfig ? { A: state.sceneConfig.characters.A.name, B: state.sceneConfig.characters.B.name } : null;

  const tutorialText = getTutorialText(
    sel.hoveredApproach,
    sel.hoveredAffect,
    state.activeCharacter,
    charNames
  );

  return (
    <main className="h-screen w-screen flex items-center justify-center bg-black">
      <div className="aspect-[4/3] max-h-full max-w-full flex flex-col">
        <div className="h-3/4">
          <PoseViewer
            onCharacterSelect={onCharacterSelect}
            onApproachHover={onApproachHover}
            onAffectHover={onAffectHover}
            onEndTriggered={handleBeginEnding}
            onStartTriggered={start}
            playbackEndTime={state.playbackEndTime}
            narrationDuration={state.narrationDuration}
            characterNames={charNames}
            endingTurnsLeft={state.endingTurnsLeft}
            phase={state.phase}
          />
        </div>
        <div className="h-1/4 flex flex-col items-center justify-center px-4 gap-2">
          <p className="text-sm font-serif text-white/60">{phaseLabel}</p>
          {state.currentLine && state.speakingCharacter ? (
            <p className="text-lg font-serif text-white text-center">
              {state.sceneConfig?.characters[state.speakingCharacter]?.name ?? state.speakingCharacter}: &quot;{state.currentLine}&quot;
            </p>
          ) : (
            <p className="text-base font-serif text-white/70 text-center italic">
              {tutorialText}
            </p>
          )}
          <div className="flex gap-4 text-xs font-serif text-white/40">
            <span>
              char:{" "}
              <span className={state.activeCharacter ? "text-teal-300" : ""}>
                {state.activeCharacter ?? "—"}
              </span>
            </span>
            <span>
              approach:{" "}
              <span className={sel.confirmedApproach ? "text-teal-300" : ""}>
                {sel.confirmedApproach ?? sel.hoveredApproach ?? "—"}
              </span>
            </span>
            <span>
              affect:{" "}
              <span className={sel.confirmedAffect ? "text-teal-300" : ""}>
                {sel.confirmedAffect ?? sel.hoveredAffect ?? "—"}
              </span>
            </span>
            <span>history: {state.history.length}</span>
          </div>
        </div>
      </div>
    </main>
  );
}
