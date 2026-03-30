"use client";

import { useReducer, useEffect, useRef, useCallback } from "react";
import type {
  ConductorState,
  SelectionState,
  Approach,
  Affect,
  AffectCategory,
  Character,
  Candidates,
  Phase,
  SceneConfig,
} from "./types";
import { createScene, affectToCategory, getAffectWinner, assignCoreSecrets } from "./scene";

// ── Retry helper ─────────────────────────────────────────────────────────────

async function fetchWithRetry(
  input: RequestInfo,
  init?: RequestInit,
  retries = 3,
  delayMs = 1000
): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(input, init);
      if (res.ok || attempt === retries) return res;
      console.warn(`[conductor] fetch attempt ${attempt}/${retries} got ${res.status}, retrying...`);
    } catch (err) {
      if (attempt === retries) throw err;
      console.warn(`[conductor] fetch attempt ${attempt}/${retries} failed:`, err, "retrying...");
    }
    await new Promise((r) => setTimeout(r, delayMs * attempt));
  }
  throw new Error("fetchWithRetry: unreachable");
}

// ── Affect → TTS emotion prompt mapping ─────────────────────────────────────

const AFFECT_EMOTION: Record<Affect, string> = {
  happy: "Speak with warmth and gentle happiness",
  sad: "Speak with sadness and quiet regret",
  angry: "Speak with sharp, controlled anger",
  very_happy: "Speak with overwhelming joy and breathless excitement",
  very_sad: "Speak with deep devastation, voice breaking with grief",
  very_angry: "Speak with explosive fury and righteous rage",
};

// ── Actions ──────────────────────────────────────────────────────────────────

type Action =
  | { type: "SCENE_CREATED"; sceneConfig: SceneConfig }
  | { type: "SCENE_AUDIO_READY"; audioBuffer: AudioBuffer }
  | { type: "CANDIDATES_READY"; candidatesA: Candidates; candidatesB: Candidates; fetchMs: number }
  | { type: "NARRATION_ENDED" }
  | { type: "CHARACTER_SELECT"; character: Character }
  | { type: "APPROACH_UPDATE"; approach: Approach | null }
  | { type: "AFFECT_UPDATE"; affect: Affect | null }
  | { type: "INSTANT_APPROACH"; approach: Approach }
  | { type: "INSTANT_AFFECT"; affect: Affect }
  | { type: "LOCK_IN" }
  | { type: "TTS_READY"; audioBuffer: AudioBuffer }
  | { type: "PLAY_PENDING" }
  | { type: "ENTER_WAITING" }
  | { type: "SET_PHASE"; phase: Phase }
  | { type: "NARRATION_STARTED"; startTime: number; duration: number }
  | { type: "SESSION_STARTED"; sessionId: string }
  | { type: "BEGIN_ENDING" };

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
  affectHistory: [],
  coreSecretCategory: null,
  audioBuffer: null,
  candidatesA: null,
  candidatesB: null,
  activeCharacter: null,
  selection: initialSelection,
  currentLine: null,
  speakingCharacter: null,
  pendingLine: null,
  pendingCharacter: null,
  pendingApproach: null,
  pendingAffect: null,
  pendingAudio: null,
  playbackEndedAt: null,
  narrationStartTime: null,
  narrationDuration: null,
  playbackEndTime: null,
  sessionId: null,
  lineSequence: 1,
  lastCandidatesFetchMs: null,
  endingTurnsLeft: null,
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

    case "SESSION_STARTED":
      return { ...state, sessionId: action.sessionId, lineSequence: 1 };

    case "CANDIDATES_READY":
      return {
        ...state,
        candidatesA: action.candidatesA,
        candidatesB: action.candidatesB,
        lastCandidatesFetchMs: action.fetchMs,
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
      if (state.endingTurnsLeft === 0) {
        return { ...initialState };
      }
      return { ...state, phase: "waiting", playbackEndTime: null, playbackEndedAt: Date.now() };

    case "CHARACTER_SELECT":
      return { ...state, activeCharacter: action.character };

    case "APPROACH_UPDATE": {
      const prev = state.selection;
      if (action.approach === null) {
        return {
          ...state,
          selection: { ...prev, hoveredApproach: null, approachHeldSince: null, confirmedApproach: null },
        };
      }
      const now = Date.now();
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
      const prev = state.selection;
      if (action.affect === null) {
        return {
          ...state,
          selection: { ...prev, hoveredAffect: null, affectHeldSince: null, confirmedAffect: null },
        };
      }
      const now = Date.now();
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

      // Track affect trajectory and assign core secrets when pattern is clear
      const newAffectHistory = [...state.affectHistory, affectToCategory(confirmedAffect)];
      let newSceneConfig = sceneConfig;
      let newCoreCategory = state.coreSecretCategory;

      if (!newCoreCategory && newSceneConfig && newAffectHistory.length >= 4) {
        const winner = getAffectWinner(newAffectHistory);
        if (winner) {
          newCoreCategory = winner;
          newSceneConfig = assignCoreSecrets(newSceneConfig, winner);
          console.log("[conductor] core secrets assigned — affect trajectory:", winner);
        }
      }

      const newEndingTurnsLeft = state.endingTurnsLeft !== null
        ? state.endingTurnsLeft - 1
        : null;

      return {
        ...state,
        phase: "locked",
        sceneConfig: newSceneConfig,
        affectHistory: newAffectHistory,
        coreSecretCategory: newCoreCategory,
        endingTurnsLeft: newEndingTurnsLeft,
        pendingLine: line,
        pendingCharacter: activeCharacter,
        pendingApproach: confirmedApproach,
        pendingAffect: confirmedAffect,
        pendingAudio: null,
        history: [...state.history, `${charName}: ${line}`],
        turnNumber: state.turnNumber + 1,
        lineSequence: state.lineSequence + 1,
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
        pendingApproach: null,
        pendingAffect: null,
        playbackEndedAt: null,
      };

    case "ENTER_WAITING":
      return { ...state, phase: "waiting" };

    case "BEGIN_ENDING":
      if (state.endingTurnsLeft !== null) return state; // already ending
      console.log("[conductor] ending sequence triggered — 2 turns remaining");
      return { ...state, endingTurnsLeft: 2 };

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

  async function fetchAudio(
    text: string,
    voice?: string,
    session?: { sessionId: string; sequence: number },
    emotion?: string,
    affect?: string
  ): Promise<{ audioBuf: AudioBuffer; ttsMs: number }> {
    const label = text.length > 40 ? text.slice(0, 40) + "…" : text;
    console.log("[conductor] fetchAudio start:", label, voice ? `(${voice})` : "", emotion ? `[${emotion}]` : "");
    const t0 = performance.now();
    const res = await fetchWithRetry("/api/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice, emotion, affect, sessionId: session?.sessionId, sequence: session?.sequence }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("[conductor] fetchAudio FAILED:", res.status, body);
      throw new Error("TTS failed");
    }
    const arrayBuf = await res.arrayBuffer();
    const audioBuf = await getAudioCtx().decodeAudioData(arrayBuf);
    const ttsMs = performance.now() - t0;
    console.log("[conductor] fetchAudio done:", Math.round(ttsMs), "ms, duration:", audioBuf.duration.toFixed(2), "s");
    return { audioBuf, ttsMs };
  }

  async function fetchAllCandidates(
    scene: SceneConfig,
    history: string[],
    turnNumber: number,
    endingTurnsLeft?: number | null
  ): Promise<{ candidatesA: Candidates; candidatesB: Candidates; fetchMs: number }> {
    console.log("[conductor] fetchCandidates start: both chars, history length", history.length, "turn", turnNumber);
    const t0 = performance.now();
    const res = await fetchWithRetry("/api/generate-candidates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scene, history, turnNumber, endingTurnsLeft }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("[conductor] fetchCandidates FAILED:", res.status, body);
      throw new Error("Candidate generation failed");
    }
    const { candidatesA, candidatesB } = await res.json();
    const fetchMs = performance.now() - t0;
    console.log("[conductor] fetchCandidates done:", Math.round(fetchMs), "ms");
    return { candidatesA: candidatesA as Candidates, candidatesB: candidatesB as Candidates, fetchMs };
  }

  function logSessionLine(params: {
    sessionId: string;
    sequence: number;
    character?: string;
    approach?: string;
    affect?: string;
    text: string;
    durationSec: number;
    llmMs?: number;
    ttsMs: number;
  }) {
    fetch("/api/session/line", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    }).catch((err) => console.error("[conductor] session log failed:", err));
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
      const session = state.sessionId ? { sessionId: state.sessionId, sequence: state.lineSequence } : undefined;
      const narratorVoice = state.sceneConfig.characters.A.voice;
      fetchAudio(state.sceneConfig.narratedIntro, narratorVoice, session).then(({ audioBuf, ttsMs }) => {
        if (state.sessionId) {
          logSessionLine({
            sessionId: state.sessionId,
            sequence: state.lineSequence,
            character: "[intro]",
            text: state.sceneConfig!.narratedIntro,
            durationSec: audioBuf.duration,
            ttsMs,
          });
        }
        dispatch({ type: "SCENE_AUDIO_READY", audioBuffer: audioBuf });
      });
    }

    if (phase === "narrating-intro" && state.audioBuffer) {
      if (!state.sceneConfig) return;
      // Play intro narration + fetch candidates for both characters in parallel
      playBuffer(state.audioBuffer, () => {
        dispatch({ type: "NARRATION_ENDED" });
      });

      fetchAllCandidates(state.sceneConfig, state.history, state.turnNumber).then(({ candidatesA, candidatesB, fetchMs }) => {
        dispatch({ type: "CANDIDATES_READY", candidatesA, candidatesB, fetchMs });
      });
    }

    if (phase === "locked") {
      if (!state.pendingLine || !state.pendingCharacter || !state.sceneConfig) return;
      const voice = state.sceneConfig.characters[state.pendingCharacter].voice;
      const session = state.sessionId ? { sessionId: state.sessionId, sequence: state.lineSequence } : undefined;
      const charName = state.sceneConfig.characters[state.pendingCharacter].name;
      const { pendingLine, pendingApproach, pendingAffect, sessionId, lineSequence, lastCandidatesFetchMs } = state;

      // Fire TTS and candidate fetch independently
      const emotion = pendingAffect ? AFFECT_EMOTION[pendingAffect] : undefined;
      fetchAudio(pendingLine, voice, session, emotion, pendingAffect ?? undefined).then(({ audioBuf, ttsMs }) => {
        if (sessionId) {
          logSessionLine({
            sessionId,
            sequence: lineSequence,
            character: charName,
            approach: pendingApproach ?? undefined,
            affect: pendingAffect ?? undefined,
            text: pendingLine,
            durationSec: audioBuf.duration,
            llmMs: lastCandidatesFetchMs ?? undefined,
            ttsMs,
          });
        }
        dispatch({ type: "TTS_READY", audioBuffer: audioBuf });
      });

      // Skip candidate fetch if this is the final turn
      if (state.endingTurnsLeft === null || state.endingTurnsLeft > 0) {
        fetchAllCandidates(state.sceneConfig, state.history, state.turnNumber, state.endingTurnsLeft).then(({ candidatesA, candidatesB, fetchMs }) => {
          dispatch({ type: "CANDIDATES_READY", candidatesA, candidatesB, fetchMs });
        });
      }
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

  const start = useCallback(async () => {
    getAudioCtx();
    const sceneConfig = createScene();
    dispatch({ type: "SCENE_CREATED", sceneConfig });

    // Create session folder
    try {
      const charA = sceneConfig.characters.A.name;
      const charB = sceneConfig.characters.B.name;
      const res = await fetch("/api/session/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneDescription: `${charA} and ${charB}` }),
      });
      if (res.ok) {
        const { sessionId } = await res.json();
        dispatch({ type: "SESSION_STARTED", sessionId });
      }
    } catch (err) {
      console.error("[conductor] session start failed:", err);
    }

    dispatch({ type: "SET_PHASE", phase: "init" });
  }, []);

  const handleCharacterSelect = useCallback(
    (character: Character) => {
      dispatch({ type: "CHARACTER_SELECT", character });
    },
    []
  );

  const handleApproachUpdate = useCallback(
    (approach: Approach | null) => {
      dispatch({ type: "APPROACH_UPDATE", approach });
    },
    []
  );

  const handleAffectUpdate = useCallback(
    (affect: Affect | null) => {
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

  const handleBeginEnding = useCallback(() => {
    dispatch({ type: "BEGIN_ENDING" });
  }, []);

  return { state, start, handleCharacterSelect, handleApproachUpdate, handleAffectUpdate, handleInstantApproach, handleInstantAffect, handleBeginEnding };
}
