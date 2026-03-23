"use client";

import { useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { useConductor } from "@/lib/conductor/useConductor";
import type { Approach, Affect } from "@/lib/conductor/types";

const PoseViewer = dynamic(() => import("@/components/PoseViewer"), {
  ssr: false,
});

export default function Home() {
  const { state, start, handleCharacterSelect, handleApproachUpdate, handleAffectUpdate, handleInstantApproach, handleInstantAffect } = useConductor();

  const onCharacterSelect = useCallback(
    (character: "A" | "B") => handleCharacterSelect(character),
    [handleCharacterSelect]
  );

  const onApproachHover = useCallback(
    (approach: Approach | null) => {
      if (approach) handleApproachUpdate(approach);
    },
    [handleApproachUpdate]
  );

  const onAffectHover = useCallback(
    (affect: Affect | null) => {
      if (affect) handleAffectUpdate(affect);
    },
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
        return 'Click "Start" to begin';
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
      default:
        return state.phase;
    }
  })();

  const sel = state.selection;

  return (
    <main className="h-screen w-screen flex items-center justify-center bg-black">
      <div className="aspect-[4/3] max-h-full max-w-full flex flex-col">
        <div className="h-3/4">
          <PoseViewer
            onCharacterSelect={onCharacterSelect}
            onApproachHover={onApproachHover}
            onAffectHover={onAffectHover}
            playbackEndTime={state.playbackEndTime}
            narrationDuration={state.narrationDuration}
            characterNames={state.sceneConfig ? { A: state.sceneConfig.characters.A.name, B: state.sceneConfig.characters.B.name } : null}
          />
        </div>
        <div className="h-1/4 flex flex-col items-center justify-center px-4 gap-2">
          {state.phase === "idle" ? (
            <button
              onClick={start}
              className="px-8 py-3 bg-white/90 text-black font-serif text-lg tracking-wide rounded-sm hover:bg-white transition-colors"
            >
              Start
            </button>
          ) : (
            <>
              <p className="text-sm font-serif text-white/60">{phaseLabel}</p>
              {state.currentLine && state.speakingCharacter && (
                <p className="text-lg font-serif text-white text-center">
                  {state.sceneConfig?.characters[state.speakingCharacter]?.name ?? state.speakingCharacter}: &quot;{state.currentLine}&quot;
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
            </>
          )}
        </div>
      </div>
    </main>
  );
}
