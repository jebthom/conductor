"use client";

import { useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { useConductor } from "@/lib/conductor/useConductor";
import type { Approach, Affect, Character } from "@/lib/conductor/types";

const PoseViewer = dynamic(() => import("@/components/PoseViewer"), {
  ssr: false,
});

const APPROACHES: Approach[] = ["approach", "neutral", "avoid"];
const AFFECTS: Affect[] = ["happy", "sad", "angry"];

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function makeTouchHandler(
  character: Character,
  handleSelectionUpdate: (c: Character, a: Approach, af: Affect) => void,
  intervalRef: React.RefObject<ReturnType<typeof setInterval> | null>
) {
  return (touching: boolean) => {
    if (touching) {
      const approach = randomPick(APPROACHES);
      const affect = randomPick(AFFECTS);
      handleSelectionUpdate(character, approach, affect);
      intervalRef.current = setInterval(() => {
        handleSelectionUpdate(character, approach, affect);
      }, 100);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  };
}

export default function Home() {
  const { state, start, handleSelectionUpdate } = useConductor();
  const boxInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const circleInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const onBoxTouch = useCallback(
    makeTouchHandler("A", handleSelectionUpdate, boxInterval),
    [handleSelectionUpdate]
  );

  const onCircleTouch = useCallback(
    makeTouchHandler("B", handleSelectionUpdate, circleInterval),
    [handleSelectionUpdate]
  );

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
      <div className="aspect-[4/3] max-w-[1280px] max-h-full w-full flex flex-col">
        <div className="h-3/4">
          <PoseViewer onBoxTouch={onBoxTouch} onCircleTouch={onCircleTouch} />
        </div>
        <div className="h-1/4 flex flex-col items-center justify-center px-4 gap-2">
          {state.phase === "idle" ? (
            <button
              onClick={start}
              className="px-6 py-3 bg-white text-black font-mono text-lg rounded hover:bg-gray-200 transition-colors"
            >
              Start
            </button>
          ) : (
            <>
              <p className="text-sm font-mono text-white/60">{phaseLabel}</p>
              {state.currentLine && state.speakingCharacter && (
                <p className="text-lg font-mono text-white text-center">
                  {state.speakingCharacter}: &quot;{state.currentLine}&quot;
                </p>
              )}
              <div className="flex gap-4 text-xs font-mono text-white/40">
                <span>
                  char:{" "}
                  <span className={sel.confirmedCharacter ? "text-cyan-400" : ""}>
                    {sel.confirmedCharacter ?? sel.hoveredCharacter ?? "—"}
                  </span>
                </span>
                <span>
                  approach:{" "}
                  <span className={sel.confirmedApproach ? "text-cyan-400" : ""}>
                    {sel.confirmedApproach ?? sel.hoveredApproach ?? "—"}
                  </span>
                </span>
                <span>
                  affect:{" "}
                  <span className={sel.confirmedAffect ? "text-cyan-400" : ""}>
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
