"use client";

import { useReducer, useEffect, useRef, useCallback } from "react";
import type {
  ConductorState,
  SelectionState,
  Approach,
  Affect,
  Character,
  Candidates,
  Phase,
} from "./types";
import { SCENE_DESCRIPTION } from "./scene";

const VOICE_MAP: Record<Character, string> = {
  A: "af_heart",   // female
  B: "am_michael", // male
};

// ── Actions ──────────────────────────────────────────────────────────────────

type Action =
  | { type: "SCENE_AUDIO_READY"; audioBuffer: AudioBuffer }
  | { type: "CANDIDATES_READY"; candidatesA: Candidates; candidatesB: Candidates }
  | { type: "NARRATION_ENDED" }
  | { type: "SELECTION_UPDATE"; character: Character; approach: Approach; affect: Affect }
  | { type: "LOCK_IN" }
  | { type: "TTS_READY"; audioBuffer: AudioBuffer; line: string; character: Character }
  | { type: "ENTER_WAITING" }
  | { type: "SET_PHASE"; phase: Phase }
  | { type: "NARRATION_STARTED"; startTime: number; duration: number };

// ── Initial state ────────────────────────────────────────────────────────────

const initialSelection: SelectionState = {
  hoveredCharacter: null,
  hoveredApproach: null,
  hoveredAffect: null,
  characterHeldSince: null,
  approachHeldSince: null,
  affectHeldSince: null,
  confirmedCharacter: null,
  confirmedApproach: null,
  confirmedAffect: null,
};

const initialState: ConductorState = {
  phase: "idle",
  scene: SCENE_DESCRIPTION,
  history: [],
  audioBuffer: null,
  candidatesA: null,
  candidatesB: null,
  selection: initialSelection,
  currentLine: null,
  speakingCharacter: null,
  narrationStartTime: null,
  narrationDuration: null,
};

// ── Reducer ──────────────────────────────────────────────────────────────────

function reducer(state: ConductorState, action: Action): ConductorState {
  switch (action.type) {
    case "SET_PHASE":
      return { ...state, phase: action.phase };

    case "SCENE_AUDIO_READY":
      return {
        ...state,
        phase: "narrating-intro",
        audioBuffer: action.audioBuffer,
      };

    case "CANDIDATES_READY":
      return {
        ...state,
        candidatesA: action.candidatesA,
        candidatesB: action.candidatesB,
      };

    case "NARRATION_STARTED":
      return {
        ...state,
        narrationStartTime: action.startTime,
        narrationDuration: action.duration,
      };

    case "NARRATION_ENDED":
      return { ...state, phase: "waiting" };

    case "SELECTION_UPDATE": {
      const now = Date.now();
      const prev = state.selection;
      let { hoveredCharacter, characterHeldSince, confirmedCharacter } = prev;
      let { hoveredApproach, approachHeldSince, confirmedApproach } = prev;
      let { hoveredAffect, affectHeldSince, confirmedAffect } = prev;

      // Character axis
      if (action.character !== hoveredCharacter) {
        hoveredCharacter = action.character;
        characterHeldSince = now;
        confirmedCharacter = null;
      } else if (characterHeldSince && now - characterHeldSince >= 1000) {
        confirmedCharacter = hoveredCharacter;
      }

      // Approach axis
      if (action.approach !== hoveredApproach) {
        hoveredApproach = action.approach;
        approachHeldSince = now;
        confirmedApproach = null;
      } else if (approachHeldSince && now - approachHeldSince >= 1000) {
        confirmedApproach = hoveredApproach;
      }

      // Affect axis
      if (action.affect !== hoveredAffect) {
        hoveredAffect = action.affect;
        affectHeldSince = now;
        confirmedAffect = null;
      } else if (affectHeldSince && now - affectHeldSince >= 1000) {
        confirmedAffect = hoveredAffect;
      }

      return {
        ...state,
        selection: {
          hoveredCharacter,
          hoveredApproach,
          hoveredAffect,
          characterHeldSince,
          approachHeldSince,
          affectHeldSince,
          confirmedCharacter,
          confirmedApproach,
          confirmedAffect,
        },
      };
    }

    case "LOCK_IN": {
      const { confirmedCharacter, confirmedApproach, confirmedAffect } = state.selection;
      if (!confirmedCharacter || !confirmedApproach || !confirmedAffect) {
        return state;
      }
      const candidates = confirmedCharacter === "A" ? state.candidatesA : state.candidatesB;
      if (!candidates) return state;

      const line = candidates[confirmedApproach][confirmedAffect];
      return {
        ...state,
        phase: "locked",
        currentLine: line,
        speakingCharacter: confirmedCharacter,
        history: [...state.history, `${confirmedCharacter}: ${line}`],
        candidatesA: null,
        candidatesB: null,
        selection: initialSelection,
      };
    }

    case "TTS_READY":
      return {
        ...state,
        phase: "narrating",
        audioBuffer: action.audioBuffer,
        currentLine: action.line,
        speakingCharacter: action.character,
        selection: initialSelection,
      };

    case "ENTER_WAITING":
      return { ...state, phase: "waiting" };

    default:
      return state;
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useConductor() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const rafRef = useRef<number>(0);
  const stateRef = useRef(state);
  stateRef.current = state;

  // ── Helpers ──────────────────────────────────────────────────────────────

  function getAudioCtx(): AudioContext {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    return audioCtxRef.current;
  }

  async function fetchAudio(text: string, voice?: string): Promise<AudioBuffer> {
    const label = text.length > 40 ? text.slice(0, 40) + "…" : text;
    console.log("[conductor] fetchAudio start:", label, voice ? `(${voice})` : "");
    const t0 = performance.now();
    const res = await fetch("/api/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("[conductor] fetchAudio FAILED:", res.status, body);
      throw new Error("TTS failed");
    }
    const arrayBuf = await res.arrayBuffer();
    const audioBuf = await getAudioCtx().decodeAudioData(arrayBuf);
    console.log("[conductor] fetchAudio done:", Math.round(performance.now() - t0), "ms, duration:", audioBuf.duration.toFixed(2), "s");
    return audioBuf;
  }

  async function fetchAllCandidates(
    history: string[]
  ): Promise<{ candidatesA: Candidates; candidatesB: Candidates }> {
    console.log("[conductor] fetchCandidates start: both chars, history length", history.length);
    const t0 = performance.now();
    const res = await fetch("/api/generate-candidates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sceneDescription: SCENE_DESCRIPTION,
        history,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("[conductor] fetchCandidates FAILED:", res.status, body);
      throw new Error("Candidate generation failed");
    }
    const data = await res.json();
    console.log("[conductor] fetchCandidates done:", Math.round(performance.now() - t0), "ms");
    return { candidatesA: data.candidatesA, candidatesB: data.candidatesB };
  }

  function playBuffer(buffer: AudioBuffer, onEnded: () => void) {
    const ctx = getAudioCtx();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = onEnded;
    source.start();
    sourceRef.current = source;

    dispatch({
      type: "NARRATION_STARTED",
      startTime: ctx.currentTime,
      duration: buffer.duration,
    });
  }

  // ── Debug logging ─────────────────────────────────────────────────────────

  useEffect(() => {
    console.log("[conductor] phase:", state.phase);
  }, [state.phase]);

  const prevConfirmed = useRef({ char: state.selection.confirmedCharacter, app: state.selection.confirmedApproach, aff: state.selection.confirmedAffect });
  useEffect(() => {
    const s = state.selection;
    const prev = prevConfirmed.current;
    if (s.confirmedCharacter !== prev.char || s.confirmedApproach !== prev.app || s.confirmedAffect !== prev.aff) {
      console.log("[conductor] selection confirmed:", {
        character: s.confirmedCharacter,
        approach: s.confirmedApproach,
        affect: s.confirmedAffect,
      });
      prevConfirmed.current = { char: s.confirmedCharacter, app: s.confirmedApproach, aff: s.confirmedAffect };
    }
  }, [state.selection]);

  useEffect(() => {
    console.log("[conductor] candidates ready: A:", !!state.candidatesA, "B:", !!state.candidatesB);
  }, [state.candidatesA, state.candidatesB]);

  // ── Phase effects ────────────────────────────────────────────────────────

  useEffect(() => {
    const { phase } = state;

    if (phase === "init") {
      fetchAudio(SCENE_DESCRIPTION).then((buf) => {
        dispatch({ type: "SCENE_AUDIO_READY", audioBuffer: buf });
      });
    }

    if (phase === "narrating-intro" && state.audioBuffer) {
      // Play intro narration + fetch candidates for both characters in parallel
      playBuffer(state.audioBuffer, () => {
        dispatch({ type: "NARRATION_ENDED" });
      });

      fetchAllCandidates(state.history).then(({ candidatesA, candidatesB }) => {
        dispatch({ type: "CANDIDATES_READY", candidatesA, candidatesB });
      });
    }

    if (phase === "locked") {
      if (!state.currentLine || !state.speakingCharacter) return;
      const line = state.currentLine;
      const character = state.speakingCharacter;

      // Fire TTS for selected line + fetch next candidates in parallel
      Promise.all([
        fetchAudio(line, VOICE_MAP[character]),
        fetchAllCandidates(state.history),
      ]).then(([audioBuf, { candidatesA, candidatesB }]) => {
        dispatch({ type: "CANDIDATES_READY", candidatesA, candidatesB });
        dispatch({ type: "TTS_READY", audioBuffer: audioBuf, line, character });
      });
    }

    if (phase === "narrating" && state.audioBuffer) {
      playBuffer(state.audioBuffer, () => {
        dispatch({ type: "NARRATION_ENDED" });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]);

  // ── Timing tick (lock-in check during narration) ─────────────────────────

  useEffect(() => {
    const { phase } = state;
    if (phase !== "narrating-intro" && phase !== "narrating") {
      cancelAnimationFrame(rafRef.current);
      return;
    }

    function tick() {
      const s = stateRef.current;
      const ctx = audioCtxRef.current;
      if (
        !ctx ||
        s.narrationStartTime == null ||
        s.narrationDuration == null
      ) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const elapsed = ctx.currentTime - s.narrationStartTime;
      const remaining = s.narrationDuration - elapsed;

      if (remaining <= 1.0 && remaining > 0) {
        const { confirmedCharacter, confirmedApproach, confirmedAffect } = s.selection;
        const candidates = confirmedCharacter === "A" ? s.candidatesA : confirmedCharacter === "B" ? s.candidatesB : null;
        if (candidates && confirmedCharacter && confirmedApproach && confirmedAffect) {
          dispatch({ type: "LOCK_IN" });
          return;
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]);

  // ── Waiting phase: check for confirmation ────────────────────────────────

  useEffect(() => {
    if (state.phase !== "waiting") return;

    const { confirmedCharacter, confirmedApproach, confirmedAffect } = state.selection;
    const candidates = confirmedCharacter === "A" ? state.candidatesA : confirmedCharacter === "B" ? state.candidatesB : null;
    if (candidates && confirmedCharacter && confirmedApproach && confirmedAffect) {
      dispatch({ type: "LOCK_IN" });
    }
  }, [state.phase, state.selection, state.candidatesA, state.candidatesB]);

  // ── Public API ───────────────────────────────────────────────────────────

  const start = useCallback(() => {
    getAudioCtx();
    dispatch({ type: "SET_PHASE", phase: "init" });
  }, []);

  const handleSelectionUpdate = useCallback(
    (character: Character, approach: Approach, affect: Affect) => {
      dispatch({ type: "SELECTION_UPDATE", character, approach, affect });
    },
    []
  );

  return { state, start, handleSelectionUpdate };
}
