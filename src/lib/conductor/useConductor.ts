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
  SceneConfig,
} from "./types";
import { createScene } from "./scene";

// ── Actions ──────────────────────────────────────────────────────────────────

type Action =
  | { type: "SCENE_CREATED"; sceneConfig: SceneConfig }
  | { type: "SCENE_AUDIO_READY"; audioBuffer: AudioBuffer }
  | { type: "CANDIDATES_READY"; candidatesA: Candidates; candidatesB: Candidates }
  | { type: "NARRATION_ENDED" }
  | { type: "CHARACTER_SELECT"; character: Character }
  | { type: "APPROACH_UPDATE"; approach: Approach }
  | { type: "AFFECT_UPDATE"; affect: Affect }
  | { type: "INSTANT_APPROACH"; approach: Approach }
  | { type: "INSTANT_AFFECT"; affect: Affect }
  | { type: "LOCK_IN" }
  | { type: "TTS_READY"; audioBuffer: AudioBuffer }
  | { type: "PLAY_PENDING" }
  | { type: "ENTER_WAITING" }
  | { type: "SET_PHASE"; phase: Phase }
  | { type: "NARRATION_STARTED"; startTime: number; duration: number };

// ── Initial state ────────────────────────────────────────────────────────────

const initialSelection: SelectionState = {
  hoveredApproach: null,
  hoveredAffect: null,
  approachHeldSince: null,
  affectHeldSince: null,
  confirmedApproach: null,
  confirmedAffect: null,
};

const initialState: ConductorState = {
  phase: "idle",
  sceneConfig: null,
  turnNumber: 1,
  history: [],
  audioBuffer: null,
  candidatesA: null,
  candidatesB: null,
  activeCharacter: null,
  selection: initialSelection,
  currentLine: null,
  speakingCharacter: null,
  pendingLine: null,
  pendingCharacter: null,
  pendingAudio: null,
  playbackEndedAt: null,
  narrationStartTime: null,
  narrationDuration: null,
  playbackEndTime: null,
};

// ── Reducer ──────────────────────────────────────────────────────────────────

function reducer(state: ConductorState, action: Action): ConductorState {
  switch (action.type) {
    case "SET_PHASE":
      return { ...state, phase: action.phase };

    case "SCENE_CREATED":
      return { ...state, sceneConfig: action.sceneConfig };

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
        playbackEndTime: Date.now() + action.duration * 1000,
      };

    case "NARRATION_ENDED":
      if (state.phase === "locked") {
        // Old audio finished while preparing next line — record end time, stay locked
        return { ...state, playbackEndedAt: Date.now(), playbackEndTime: null };
      }
      return { ...state, phase: "waiting", playbackEndTime: null, playbackEndedAt: Date.now() };

    case "CHARACTER_SELECT":
      return { ...state, activeCharacter: action.character };

    case "APPROACH_UPDATE": {
      const now = Date.now();
      const prev = state.selection;
      let { hoveredApproach, approachHeldSince, confirmedApproach } = prev;

      if (action.approach !== hoveredApproach) {
        hoveredApproach = action.approach;
        approachHeldSince = now;
        confirmedApproach = null;
      } else if (approachHeldSince && now - approachHeldSince >= 1000) {
        confirmedApproach = hoveredApproach;
      }

      return {
        ...state,
        selection: { ...prev, hoveredApproach, approachHeldSince, confirmedApproach },
      };
    }

    case "AFFECT_UPDATE": {
      const now = Date.now();
      const prev = state.selection;
      let { hoveredAffect, affectHeldSince, confirmedAffect } = prev;

      if (action.affect !== hoveredAffect) {
        hoveredAffect = action.affect;
        affectHeldSince = now;
        confirmedAffect = null;
      } else if (affectHeldSince && now - affectHeldSince >= 1000) {
        confirmedAffect = hoveredAffect;
      }

      return {
        ...state,
        selection: { ...prev, hoveredAffect, affectHeldSince, confirmedAffect },
      };
    }

    case "INSTANT_APPROACH":
      return {
        ...state,
        selection: {
          ...state.selection,
          hoveredApproach: action.approach,
          confirmedApproach: action.approach,
        },
      };

    case "INSTANT_AFFECT":
      return {
        ...state,
        selection: {
          ...state.selection,
          hoveredAffect: action.affect,
          confirmedAffect: action.affect,
        },
      };

    case "LOCK_IN": {
      const { activeCharacter, sceneConfig } = state;
      const { confirmedApproach, confirmedAffect } = state.selection;
      if (!activeCharacter || !confirmedApproach || !confirmedAffect) {
        return state;
      }
      const candidates = activeCharacter === "A" ? state.candidatesA : state.candidatesB;
      if (!candidates) return state;

      const line = candidates[confirmedApproach][confirmedAffect];
      const charName = sceneConfig?.characters[activeCharacter]?.name ?? activeCharacter;
      return {
        ...state,
        phase: "locked",
        pendingLine: line,
        pendingCharacter: activeCharacter,
        pendingAudio: null,
        // Keep currentLine/speakingCharacter — caption shows what's playing
        history: [...state.history, `${charName}: ${line}`],
        turnNumber: state.turnNumber + 1,
        candidatesA: null,
        candidatesB: null,
        selection: initialSelection,
      };
    }

    case "TTS_READY":
      return { ...state, pendingAudio: action.audioBuffer };

    case "PLAY_PENDING":
      return {
        ...state,
        phase: "narrating",
        audioBuffer: state.pendingAudio,
        currentLine: state.pendingLine,
        speakingCharacter: state.pendingCharacter,
        pendingAudio: null,
        pendingLine: null,
        pendingCharacter: null,
        playbackEndedAt: null,
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
    scene: SceneConfig,
    history: string[],
    turnNumber: number
  ): Promise<{ candidatesA: Candidates; candidatesB: Candidates }> {
    console.log("[conductor] fetchCandidates start: both chars, history length", history.length, "turn", turnNumber);
    const t0 = performance.now();
    const res = await fetch("/api/generate-candidates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scene, history, turnNumber }),
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

  useEffect(() => {
    if (state.activeCharacter) {
      console.log("[conductor] active character:", state.activeCharacter);
    }
  }, [state.activeCharacter]);

  const prevConfirmed = useRef({ app: state.selection.confirmedApproach, aff: state.selection.confirmedAffect });
  useEffect(() => {
    const s = state.selection;
    const prev = prevConfirmed.current;
    if (s.confirmedApproach !== prev.app || s.confirmedAffect !== prev.aff) {
      console.log("[conductor] selection confirmed:", {
        approach: s.confirmedApproach,
        affect: s.confirmedAffect,
      });
      prevConfirmed.current = { app: s.confirmedApproach, aff: s.confirmedAffect };
    }
  }, [state.selection]);

  useEffect(() => {
    console.log("[conductor] candidates ready: A:", !!state.candidatesA, "B:", !!state.candidatesB);
  }, [state.candidatesA, state.candidatesB]);

  // ── Phase effects ────────────────────────────────────────────────────────

  useEffect(() => {
    const { phase } = state;

    if (phase === "init") {
      if (!state.sceneConfig) return;
      fetchAudio(state.sceneConfig.narratedIntro).then((buf) => {
        dispatch({ type: "SCENE_AUDIO_READY", audioBuffer: buf });
      });
    }

    if (phase === "narrating-intro" && state.audioBuffer) {
      if (!state.sceneConfig) return;
      // Play intro narration + fetch candidates for both characters in parallel
      playBuffer(state.audioBuffer, () => {
        dispatch({ type: "NARRATION_ENDED" });
      });

      fetchAllCandidates(state.sceneConfig, state.history, state.turnNumber).then(({ candidatesA, candidatesB }) => {
        dispatch({ type: "CANDIDATES_READY", candidatesA, candidatesB });
      });
    }

    if (phase === "locked") {
      if (!state.pendingLine || !state.pendingCharacter || !state.sceneConfig) return;
      const voice = state.sceneConfig.characters[state.pendingCharacter].voice;

      // Fire TTS and candidate fetch independently
      fetchAudio(state.pendingLine, voice).then((audioBuf) => {
        dispatch({ type: "TTS_READY", audioBuffer: audioBuf });
      });

      fetchAllCandidates(state.sceneConfig, state.history, state.turnNumber).then(({ candidatesA, candidatesB }) => {
        dispatch({ type: "CANDIDATES_READY", candidatesA, candidatesB });
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
        const { confirmedApproach, confirmedAffect } = s.selection;
        const { activeCharacter } = s;
        const candidates = activeCharacter === "A" ? s.candidatesA : activeCharacter === "B" ? s.candidatesB : null;
        if (candidates && activeCharacter && confirmedApproach && confirmedAffect) {
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

  // ── Pending playback: wait for TTS + 1s gap after old audio ─────────────

  useEffect(() => {
    if (state.phase !== "locked" || !state.pendingAudio || state.playbackEndedAt === null) return;

    const elapsed = Date.now() - state.playbackEndedAt;
    const remaining = Math.max(0, 1000 - elapsed);

    const timer = setTimeout(() => {
      dispatch({ type: "PLAY_PENDING" });
    }, remaining);
    return () => clearTimeout(timer);
  }, [state.phase, state.pendingAudio, state.playbackEndedAt]);

  // ── Waiting phase: check for confirmation ────────────────────────────────

  useEffect(() => {
    if (state.phase !== "waiting") return;

    const { confirmedApproach, confirmedAffect } = state.selection;
    const { activeCharacter } = state;
    const candidates = activeCharacter === "A" ? state.candidatesA : activeCharacter === "B" ? state.candidatesB : null;
    if (candidates && activeCharacter && confirmedApproach && confirmedAffect) {
      dispatch({ type: "LOCK_IN" });
    }
  }, [state.phase, state.selection, state.candidatesA, state.candidatesB]);

  // ── Public API ───────────────────────────────────────────────────────────

  const start = useCallback(() => {
    getAudioCtx();
    const sceneConfig = createScene();
    dispatch({ type: "SCENE_CREATED", sceneConfig });
    dispatch({ type: "SET_PHASE", phase: "init" });
  }, []);

  const handleCharacterSelect = useCallback(
    (character: Character) => {
      dispatch({ type: "CHARACTER_SELECT", character });
    },
    []
  );

  const handleApproachUpdate = useCallback(
    (approach: Approach) => {
      dispatch({ type: "APPROACH_UPDATE", approach });
    },
    []
  );

  const handleAffectUpdate = useCallback(
    (affect: Affect) => {
      dispatch({ type: "AFFECT_UPDATE", affect });
    },
    []
  );

  const handleInstantApproach = useCallback(
    (approach: Approach) => {
      dispatch({ type: "INSTANT_APPROACH", approach });
    },
    []
  );

  const handleInstantAffect = useCallback(
    (affect: Affect) => {
      dispatch({ type: "INSTANT_AFFECT", affect });
    },
    []
  );

  return { state, start, handleCharacterSelect, handleApproachUpdate, handleAffectUpdate, handleInstantApproach, handleInstantAffect };
}
