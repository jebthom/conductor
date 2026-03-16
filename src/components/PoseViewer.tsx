"use client";

import { useEffect, useRef } from "react";
import {
  PoseLandmarker,
  FilesetResolver,
  DrawingUtils,
} from "@mediapipe/tasks-vision";

const POSE_CONNECTIONS = PoseLandmarker.POSE_CONNECTIONS;

const TRIANGLE_SIZE = 250;

type Approach = "approach" | "neutral" | "avoid";
type Affect = "happy" | "sad" | "angry";

interface PoseViewerProps {
  onCharacterSelect?: (character: "A" | "B") => void;
  onApproachHover?: (approach: Approach | null) => void;
  onAffectHover?: (affect: Affect | null) => void;
  playbackEndTime?: number | null;
  characterNames?: { A: string; B: string } | null;
}

export default function PoseViewer({ onCharacterSelect, onApproachHover, onAffectHover, playbackEndTime, characterNames }: PoseViewerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onCharacterSelectRef = useRef(onCharacterSelect);
  const onApproachHoverRef = useRef(onApproachHover);
  const onAffectHoverRef = useRef(onAffectHover);
  const currentApproachRef = useRef<Approach | null>(null);
  const currentAffectRef = useRef<Affect | null>(null);
  const selectedCharRef = useRef<"A" | "B" | null>(null);
  const playbackEndTimeRef = useRef(playbackEndTime);
  const characterNamesRef = useRef(characterNames);

  playbackEndTimeRef.current = playbackEndTime;
  characterNamesRef.current = characterNames;
  onCharacterSelectRef.current = onCharacterSelect;
  onApproachHoverRef.current = onApproachHover;
  onAffectHoverRef.current = onAffectHover;

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let animId: number;
    let landmarker: PoseLandmarker | null = null;

    async function init() {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );
      if (cancelled) return;

      landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numPoses: 1,
      });
      if (cancelled) return;

      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      if (cancelled) return;

      function renderLoop() {
        if (cancelled) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;

        if (!video || !canvas || !landmarker || video.readyState < 2) {
          animId = requestAnimationFrame(renderLoop);
          return;
        }

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const W = canvas.width;
        const S = TRIANGLE_SIZE;

        const ctx = canvas.getContext("2d")!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const result = landmarker.detectForVideo(video, performance.now());

        // MediaPipe Pose hand landmarks: 19 = left index finger, 20 = right index finger
        const MIDDLE_HAND_INDICES = new Set([19, 20]);

        // Collect finger pixel positions for hit-testing
        const fingerPositions: { x: number; y: number }[] = [];
        for (const landmarks of result.landmarks) {
          for (const idx of MIDDLE_HAND_INDICES) {
            const lm = landmarks[idx];
            if (lm) {
              fingerPositions.push({ x: lm.x * canvas.width, y: lm.y * canvas.height });
            }
          }
        }

        // ── Triangle A: visual top-left = canvas top-right ──────────────
        // Vertices: (W, 0), (W-S, 0), (W, S)
        // Inside test: x >= W-S AND y <= x - (W-S)
        const triAHit = fingerPositions.some(
          (p) => p.x >= W - S && p.y >= 0 && p.y <= p.x - (W - S)
        );

        // ── Triangle B: visual top-right = canvas top-left ─────────────
        // Vertices: (0, 0), (S, 0), (0, S)
        // Inside test: x + y <= S
        const triBHit = fingerPositions.some(
          (p) => p.x <= S && p.y >= 0 && p.x + p.y <= S
        );

        // Update selected character on touch (instant flip, stays selected)
        if (triAHit && selectedCharRef.current !== "A") {
          selectedCharRef.current = "A";
          onCharacterSelectRef.current?.("A");
        }
        if (triBHit && selectedCharRef.current !== "B") {
          selectedCharRef.current = "B";
          onCharacterSelectRef.current?.("B");
        }

        // Draw Triangle A
        const triAPath = new Path2D();
        triAPath.moveTo(W, 0);
        triAPath.lineTo(W - S, 0);
        triAPath.lineTo(W, S);
        triAPath.closePath();

        if (selectedCharRef.current === "A") {
          ctx.fillStyle = "rgba(0, 255, 255, 0.3)";
          ctx.fill(triAPath);
        }
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 2;
        ctx.stroke(triAPath);

        // Label A (text must be flipped since canvas is CSS-flipped)
        ctx.save();
        ctx.translate(W - S / 3, S / 3);
        ctx.scale(-1, 1);
        ctx.font = "bold 24px monospace";
        ctx.fillStyle = "#FFFFFF";
        ctx.textAlign = "center";
        ctx.fillText(characterNamesRef.current?.A ?? "A", 0, 8);
        ctx.restore();

        // Draw Triangle B
        const triBPath = new Path2D();
        triBPath.moveTo(0, 0);
        triBPath.lineTo(S, 0);
        triBPath.lineTo(0, S);
        triBPath.closePath();

        if (selectedCharRef.current === "B") {
          ctx.fillStyle = "rgba(0, 255, 255, 0.3)";
          ctx.fill(triBPath);
        }
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 2;
        ctx.stroke(triBPath);

        // Label B
        ctx.save();
        ctx.translate(S / 3, S / 3);
        ctx.scale(-1, 1);
        ctx.font = "bold 24px monospace";
        ctx.fillStyle = "#FFFFFF";
        ctx.textAlign = "center";
        ctx.fillText(characterNamesRef.current?.B ?? "B", 0, 8);
        ctx.restore();

        // ── Approach stoplight (canvas is flipped: visual left = high x) ──
        const slotW = 270;
        const slotH = 160;
        const slotCX = (5 / 7) * canvas.width; // visual 2/7 from left
        const slotX = slotCX - slotW / 2;
        const totalH = slotH * 3;
        const slotTopY = canvas.height / 2 - totalH / 2;

        const approachZones: { approach: Approach; y: number; color: string; label: string }[] = [
          { approach: "approach", y: slotTopY,              color: "rgba(0, 200, 0, 0.4)",   label: "Approach" },
          { approach: "neutral",  y: slotTopY + slotH,     color: "rgba(255, 191, 0, 0.4)", label: "Neutral" },
          { approach: "avoid",    y: slotTopY + slotH * 2, color: "rgba(255, 0, 0, 0.4)",   label: "Avoid" },
        ];

        let hoveredApproach: Approach | null = null;
        for (const zone of approachZones) {
          const hit = fingerPositions.some(
            (p) => p.x >= slotX && p.x <= slotX + slotW && p.y >= zone.y && p.y <= zone.y + slotH
          );
          if (hit) {
            hoveredApproach = zone.approach;
            ctx.fillStyle = zone.color;
            ctx.fillRect(slotX, zone.y, slotW, slotH);
          }
          ctx.strokeStyle = "#FFFFFF";
          ctx.lineWidth = 2;
          ctx.strokeRect(slotX, zone.y, slotW, slotH);

          // Label (flipped for CSS mirror)
          ctx.save();
          ctx.translate(slotCX, zone.y + slotH / 2);
          ctx.scale(-1, 1);
          ctx.font = "bold 16px monospace";
          ctx.fillStyle = "#FFFFFF";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(zone.label, 0, 0);
          ctx.restore();
        }

        currentApproachRef.current = hoveredApproach;
        onApproachHoverRef.current?.(hoveredApproach);

        // ── Affect circle (3-slice pie) ─────────────────────────────────
        const circleX = (2 / 7) * canvas.width;  // visual 2/7 from right
        const circleY = canvas.height / 2;
        const circleR = 180;

        // Rotated -π/2 (clockwise 90°) so Happy sits at the top
        const affectSlices: { affect: Affect; start: number; end: number; color: string; label: string }[] = [
          { affect: "happy", start: 7 / 6 * Math.PI, end: 11 / 6 * Math.PI, color: "rgba(0, 200, 0, 0.4)",   label: "Happy" },
          { affect: "sad",   start: 11 / 6 * Math.PI, end: 1 / 2 * Math.PI, color: "rgba(0, 100, 255, 0.4)", label: "Sad" },
          { affect: "angry", start: 1 / 2 * Math.PI,  end: 7 / 6 * Math.PI, color: "rgba(255, 0, 0, 0.4)",   label: "Angry" },
        ];

        // Hit-test by angle
        let hoveredAffect: Affect | null = null;
        for (const fp of fingerPositions) {
          const dx = fp.x - circleX;
          const dy = fp.y - circleY;
          if (Math.hypot(dx, dy) > circleR) continue;
          let angle = Math.atan2(dy, dx);
          if (angle < 0) angle += 2 * Math.PI;
          for (const sl of affectSlices) {
            const hit = sl.start > sl.end
              ? (angle >= sl.start || angle <= sl.end)   // wraps around 0
              : (angle >= sl.start && angle <= sl.end);
            if (hit) { hoveredAffect = sl.affect; break; }
          }
          if (hoveredAffect) break;
        }

        // Draw slices
        for (const sl of affectSlices) {
          ctx.beginPath();
          ctx.moveTo(circleX, circleY);
          ctx.arc(circleX, circleY, circleR, sl.start, sl.end);
          ctx.closePath();

          if (hoveredAffect === sl.affect) {
            ctx.fillStyle = sl.color;
            ctx.fill();
          }
          ctx.strokeStyle = "#FFFFFF";
          ctx.lineWidth = 2;
          ctx.stroke();

          // Label at midpoint of arc, 60% out from centre
          const wraps = sl.start > sl.end;
          const midAngle = wraps
            ? (sl.start + (sl.end + 2 * Math.PI)) / 2
            : (sl.start + sl.end) / 2;
          const lx = circleX + Math.cos(midAngle) * circleR * 0.6;
          const ly = circleY + Math.sin(midAngle) * circleR * 0.6;
          ctx.save();
          ctx.translate(lx, ly);
          ctx.scale(-1, 1);
          ctx.font = "bold 14px monospace";
          ctx.fillStyle = "#FFFFFF";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(sl.label, 0, 0);
          ctx.restore();
        }

        currentAffectRef.current = hoveredAffect;
        onAffectHoverRef.current?.(hoveredAffect);

        // ── Status bar at bottom ────────────────────────────────────────
        const barW = canvas.width * 2 / 3;
        const barH = 100;
        const barX = (canvas.width - barW) / 2;
        const barY = canvas.height - barH;
        const halfW = barW / 2;

        const approachColors: Record<Approach, string> = {
          approach: "rgba(0, 200, 0, 0.4)",
          neutral: "rgba(255, 191, 0, 0.4)",
          avoid: "rgba(255, 0, 0, 0.4)",
        };
        const affectColors: Record<Affect, string> = {
          happy: "rgba(0, 200, 0, 0.4)",
          angry: "rgba(255, 0, 0, 0.4)",
          sad: "rgba(0, 100, 255, 0.4)",
        };

        // Visual left (canvas right) — approach color
        if (currentApproachRef.current) {
          ctx.fillStyle = approachColors[currentApproachRef.current];
          ctx.fillRect(barX + halfW, barY, halfW, barH);
        }
        // Visual right (canvas left) — affect color
        if (currentAffectRef.current) {
          ctx.fillStyle = affectColors[currentAffectRef.current];
          ctx.fillRect(barX, barY, halfW, barH);
        }

        // Border
        ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barW, barH);
        // Divider
        ctx.beginPath();
        ctx.moveTo(barX + halfW, barY);
        ctx.lineTo(barX + halfW, barY + barH);
        ctx.stroke();

        // Label (flipped for CSS mirror)
        const names = characterNamesRef.current;
        const charLabel = selectedCharRef.current
          ? (names?.[selectedCharRef.current] ?? selectedCharRef.current)
          : "—";
        const endTime = playbackEndTimeRef.current;
        const remaining = endTime ? Math.max(0, (endTime - Date.now()) / 1000) : null;
        const timerStr = remaining !== null ? `  [${remaining.toFixed(1)}s]` : "";

        ctx.save();
        ctx.translate(barX + halfW, barY + barH / 2);
        ctx.scale(-1, 1);
        ctx.font = "bold 36px monospace";
        ctx.fillStyle = "#FFFFFF";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`Next Line: ${charLabel}${timerStr}`, 0, 0);
        ctx.restore();

        const drawingUtils = new DrawingUtils(ctx);
        for (const landmarks of result.landmarks) {
          // Draw connectors first (skeleton lines)
          drawingUtils.drawConnectors(landmarks, POSE_CONNECTIONS, {
            color: "#00FFFF",
            lineWidth: 2,
          });

          // Draw landmarks individually for per-joint styling
          landmarks.forEach((lm, i) => {
            const isMiddleHand = MIDDLE_HAND_INDICES.has(i);
            drawingUtils.drawLandmarks([lm], {
              radius: isMiddleHand ? 9 : 3,
              color: isMiddleHand ? "#FF0000" : "#00FFFF",
            });

            if (isMiddleHand) {
              const px = Math.round(lm.x * canvas.width);
              const py = Math.round(lm.y * canvas.height);
              const tx = lm.x * canvas.width;
              const ty = lm.y * canvas.height;
              ctx.save();
              ctx.translate(tx, ty);
              ctx.scale(-1, 1);
              ctx.font = "20px monospace";
              ctx.fillStyle = "#FFFFFF";
              ctx.fillText(`(${px}, ${py})`, 14, 4);
              ctx.restore();
            }
          });
        }

        animId = requestAnimationFrame(renderLoop);
      }

      animId = requestAnimationFrame(renderLoop);
    }

    init();

    return () => {
      cancelled = true;
      cancelAnimationFrame(animId);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (landmarker) landmarker.close();
    };
  }, []);

  return (
    <div className="relative w-full h-full">
      <video
        ref={videoRef}
        className="w-full h-full object-cover -scale-x-100 grayscale"
        playsInline
        muted
      />
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full -scale-x-100"
      />
    </div>
  );
}
