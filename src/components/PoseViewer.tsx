"use client";

import { useEffect, useRef } from "react";
import {
  PoseLandmarker,
  FilesetResolver,
  DrawingUtils,
} from "@mediapipe/tasks-vision";

const POSE_CONNECTIONS = PoseLandmarker.POSE_CONNECTIONS;

const TRIANGLE_SIZE = 250;
const SERIF = "'Merriweather', Georgia, serif";

type Approach = "approach" | "neutral" | "avoid";
type Affect = "happy" | "sad" | "angry" | "very_happy" | "very_sad" | "very_angry";

interface PoseViewerProps {
  onCharacterSelect?: (character: "A" | "B") => void;
  onApproachHover?: (approach: Approach | null) => void;
  onAffectHover?: (affect: Affect | null) => void;
  playbackEndTime?: number | null;
  narrationDuration?: number | null;
  characterNames?: { A: string; B: string } | null;
}

export default function PoseViewer({ onCharacterSelect, onApproachHover, onAffectHover, playbackEndTime, narrationDuration, characterNames }: PoseViewerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onCharacterSelectRef = useRef(onCharacterSelect);
  const onApproachHoverRef = useRef(onApproachHover);
  const onAffectHoverRef = useRef(onAffectHover);
  const currentApproachRef = useRef<Approach | null>(null);
  const currentAffectRef = useRef<Affect | null>(null);
  const selectedCharRef = useRef<"A" | "B" | null>(null);
  const playbackEndTimeRef = useRef(playbackEndTime);
  const narrationDurationRef = useRef(narrationDuration);
  const characterNamesRef = useRef(characterNames);
  const previewRef = useRef(false);
  const extendedAffectRef = useRef(true);

  playbackEndTimeRef.current = playbackEndTime;
  narrationDurationRef.current = narrationDuration;
  characterNamesRef.current = characterNames;
  onCharacterSelectRef.current = onCharacterSelect;
  onApproachHoverRef.current = onApproachHover;
  onAffectHoverRef.current = onAffectHover;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "p" || e.key === "P") {
        previewRef.current = !previewRef.current;
      }
      if (e.key === "o" || e.key === "O") {
        extendedAffectRef.current = !extendedAffectRef.current;
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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

        if (previewRef.current || selectedCharRef.current === "A") {
          ctx.fillStyle = "rgba(56, 189, 186, 0.35)";
          ctx.fill(triAPath);
        }
        ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
        ctx.lineWidth = 1.5;
        ctx.stroke(triAPath);

        // Label A (text must be flipped since canvas is CSS-flipped)
        ctx.save();
        ctx.translate(W - S / 3, S / 3);
        ctx.scale(-1, 1);
        ctx.font = `bold 22px ${SERIF}`;
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.textAlign = "center";
        ctx.fillText(characterNamesRef.current?.A ?? "A", 0, 8);
        ctx.restore();

        // Draw Triangle B
        const triBPath = new Path2D();
        triBPath.moveTo(0, 0);
        triBPath.lineTo(S, 0);
        triBPath.lineTo(0, S);
        triBPath.closePath();

        if (previewRef.current || selectedCharRef.current === "B") {
          ctx.fillStyle = "rgba(56, 189, 186, 0.35)";
          ctx.fill(triBPath);
        }
        ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
        ctx.lineWidth = 1.5;
        ctx.stroke(triBPath);

        // Label B
        ctx.save();
        ctx.translate(S / 3, S / 3);
        ctx.scale(-1, 1);
        ctx.font = `bold 22px ${SERIF}`;
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.textAlign = "center";
        ctx.fillText(characterNamesRef.current?.B ?? "B", 0, 8);
        ctx.restore();

        // ── Approach stoplight (canvas is flipped: visual left = high x) ──
        const slotW = 270;
        const slotHOuter = 175;
        const slotHInner = 160;
        const slotCX = (5 / 7) * canvas.width; // visual 2/7 from left
        const slotX = slotCX - slotW / 2;
        const totalH = slotHOuter * 2 + slotHInner;
        const slotTopY = canvas.height / 2 - totalH / 2;

        const approachZones: { approach: Approach; y: number; h: number; color: string; label: string }[] = [
          { approach: "approach", y: slotTopY,                            h: slotHOuter, color: "rgba(76, 175, 80, 0.5)",  label: "Approach" },
          { approach: "neutral",  y: slotTopY + slotHOuter,              h: slotHInner, color: "rgba(218, 165, 50, 0.5)", label: "Neutral" },
          { approach: "avoid",    y: slotTopY + slotHOuter + slotHInner, h: slotHOuter, color: "rgba(198, 65, 52, 0.5)",  label: "Avoid" },
        ];

        let hoveredApproach: Approach | null = null;
        for (const zone of approachZones) {
          const hit = fingerPositions.some(
            (p) => p.x >= slotX && p.x <= slotX + slotW && p.y >= zone.y && p.y <= zone.y + zone.h
          );
          if (hit) {
            hoveredApproach = zone.approach;
          }
          if (hit || previewRef.current) {
            ctx.fillStyle = zone.color;
            ctx.fillRect(slotX, zone.y, slotW, zone.h);
          }
          ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
          ctx.lineWidth = 1;
          ctx.strokeRect(slotX, zone.y, slotW, zone.h);

          // Label (flipped for CSS mirror)
          ctx.save();
          ctx.translate(slotCX, zone.y + zone.h / 2);
          ctx.scale(-1, 1);
          ctx.font = `bold 20px ${SERIF}`;
          ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(zone.label, 0, 0);
          ctx.restore();
        }

        currentApproachRef.current = hoveredApproach;
        onApproachHoverRef.current?.(hoveredApproach);

        // ── Affect circle (3-slice pie with optional outer ring) ──────
        const circleX = (2 / 7) * canvas.width;  // visual 2/7 from right
        const circleY = canvas.height / 2;
        const innerR = 170;
        const outerR = 210;
        const extended = extendedAffectRef.current;

        // Angle ranges — rotated so Happy sits at the top
        const sliceAngles: { start: number; end: number }[] = [
          { start: 7 / 6 * Math.PI, end: 11 / 6 * Math.PI }, // happy (top)
          { start: 11 / 6 * Math.PI, end: 1 / 2 * Math.PI }, // sad (bottom-right visually)
          { start: 1 / 2 * Math.PI,  end: 7 / 6 * Math.PI }, // angry (bottom-left visually)
        ];

        const innerSlices: { affect: Affect; start: number; end: number; color: string; label: string }[] = [
          { affect: "happy", ...sliceAngles[0], color: "rgba(76, 175, 80, 0.5)",  label: "Happy" },
          { affect: "sad",   ...sliceAngles[1], color: "rgba(52, 108, 185, 0.5)", label: "Sad" },
          { affect: "angry", ...sliceAngles[2], color: "rgba(198, 65, 52, 0.5)",  label: "Angry" },
        ];

        const outerSlices: { affect: Affect; start: number; end: number; color: string; label: string }[] = [
          { affect: "very_happy", ...sliceAngles[0], color: "rgba(46, 204, 64, 0.65)",  label: "VERY Happy" },
          { affect: "very_sad",   ...sliceAngles[1], color: "rgba(30, 80, 220, 0.65)",  label: "VERY Sad" },
          { affect: "very_angry", ...sliceAngles[2], color: "rgba(230, 40, 30, 0.65)",  label: "VERY Angry" },
        ];

        function angleInSlice(angle: number, start: number, end: number): boolean {
          return start > end
            ? (angle >= start || angle <= end)
            : (angle >= start && angle <= end);
        }

        // Hit-test by angle + distance
        let hoveredAffect: Affect | null = null;
        for (const fp of fingerPositions) {
          const dx = fp.x - circleX;
          const dy = fp.y - circleY;
          const dist = Math.hypot(dx, dy);
          if (dist > outerR) continue;
          let angle = Math.atan2(dy, dx);
          if (angle < 0) angle += 2 * Math.PI;

          if (extended && dist > innerR) {
            // Outer ring — very_ affects
            for (const sl of outerSlices) {
              if (angleInSlice(angle, sl.start, sl.end)) { hoveredAffect = sl.affect; break; }
            }
          } else {
            // Inner ring (or full circle in simple mode)
            for (const sl of innerSlices) {
              if (angleInSlice(angle, sl.start, sl.end)) { hoveredAffect = sl.affect; break; }
            }
          }
          if (hoveredAffect) break;
        }

        // Draw inner slices (full radius in simple mode, innerR in extended)
        const drawInnerR = extended ? innerR : outerR;
        for (const sl of innerSlices) {
          ctx.beginPath();
          ctx.moveTo(circleX, circleY);
          ctx.arc(circleX, circleY, drawInnerR, sl.start, sl.end);
          ctx.closePath();

          if (previewRef.current || hoveredAffect === sl.affect) {
            ctx.fillStyle = sl.color;
            ctx.fill();
          }
          ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
          ctx.lineWidth = 1;
          ctx.stroke();

          // Label
          const wraps = sl.start > sl.end;
          const midAngle = wraps
            ? (sl.start + (sl.end + 2 * Math.PI)) / 2
            : (sl.start + sl.end) / 2;
          const labelR = extended ? drawInnerR * 0.5 : drawInnerR * 0.6;
          const lx = circleX + Math.cos(midAngle) * labelR;
          const ly = circleY + Math.sin(midAngle) * labelR;
          ctx.save();
          ctx.translate(lx, ly);
          ctx.scale(-1, 1);
          ctx.font = `bold 20px ${SERIF}`;
          ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(sl.label, 0, 0);
          ctx.restore();
        }

        // Draw outer ring slices (extended mode only)
        if (extended) {
          for (const sl of outerSlices) {
            ctx.beginPath();
            ctx.arc(circleX, circleY, outerR, sl.start, sl.end);
            ctx.arc(circleX, circleY, innerR, sl.end, sl.start, true);
            ctx.closePath();

            if (previewRef.current || hoveredAffect === sl.affect) {
              ctx.fillStyle = sl.color;
              ctx.fill();
            }
            ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
            ctx.lineWidth = 1;
            ctx.stroke();

            // Label in the middle of the ring band
            const wraps = sl.start > sl.end;
            const midAngle = wraps
              ? (sl.start + (sl.end + 2 * Math.PI)) / 2
              : (sl.start + sl.end) / 2;
            const bandMid = (innerR + outerR) / 2;
            const lx = circleX + Math.cos(midAngle) * bandMid;
            const ly = circleY + Math.sin(midAngle) * bandMid;
            ctx.save();
            ctx.translate(lx, ly);
            ctx.scale(-1, 1);
            ctx.font = `bold 11px ${SERIF}`;
            ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(sl.label, 0, 0);
            ctx.restore();
          }
        }

        currentAffectRef.current = hoveredAffect;
        onAffectHoverRef.current?.(hoveredAffect);

        // ── Status bar at bottom ────────────────────────────────────────
        const barW = canvas.width * 2 / 3;
        const barH = 100;
        const barX = (canvas.width - barW) / 2;
        const barY = canvas.height - barH;
        const halfW = barW / 2;

        const approachRGB: Record<Approach, string> = {
          approach: "76, 175, 80",
          neutral: "218, 165, 50",
          avoid: "198, 65, 52",
        };
        const affectRGB: Record<Affect, string> = {
          happy: "76, 175, 80",
          angry: "198, 65, 52",
          sad: "52, 108, 185",
          very_happy: "46, 204, 64",
          very_angry: "230, 40, 30",
          very_sad: "30, 80, 220",
        };

        // Drain fraction: 1 = full (just started), 0 = empty (time's up)
        const endTime = playbackEndTimeRef.current;
        const totalDur = narrationDurationRef.current;
        const remaining = endTime ? Math.max(0, (endTime - Date.now()) / 1000) : null;
        const drainFrac = (remaining !== null && totalDur && totalDur > 0)
          ? Math.min(1, remaining / totalDur)
          : 0;

        // Visual left (canvas right) — approach color
        if (currentApproachRef.current) {
          const rgb = approachRGB[currentApproachRef.current];
          // Transparent background (always full)
          ctx.fillStyle = `rgba(${rgb}, 0.15)`;
          ctx.fillRect(barX + halfW, barY, halfW, barH);
          // Opaque fill that drains downward (top edge descends)
          if (drainFrac > 0) {
            const fillH = barH * drainFrac;
            ctx.fillStyle = `rgba(${rgb}, 0.55)`;
            ctx.fillRect(barX + halfW, barY + barH - fillH, halfW, fillH);
          }
        }
        // Visual right (canvas left) — affect color
        if (currentAffectRef.current) {
          const rgb = affectRGB[currentAffectRef.current];
          // Transparent background (always full)
          ctx.fillStyle = `rgba(${rgb}, 0.15)`;
          ctx.fillRect(barX, barY, halfW, barH);
          // Opaque fill that drains downward (top edge descends)
          if (drainFrac > 0) {
            const fillH = barH * drainFrac;
            ctx.fillStyle = `rgba(${rgb}, 0.55)`;
            ctx.fillRect(barX, barY + barH - fillH, halfW, fillH);
          }
        }

        // Border
        ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
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

        ctx.save();
        ctx.translate(barX + halfW, barY + barH / 2);
        ctx.scale(-1, 1);
        ctx.font = `bold 32px ${SERIF}`;
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`Next Line: ${charLabel}`, 0, 0);
        ctx.restore();

        const drawingUtils = new DrawingUtils(ctx);
        for (const landmarks of result.landmarks) {
          // Draw connectors first (skeleton lines)
          drawingUtils.drawConnectors(landmarks, POSE_CONNECTIONS, {
            color: "rgba(120, 200, 200, 0.7)",
            lineWidth: 1.5,
          });

          // Draw landmarks individually for per-joint styling
          landmarks.forEach((lm, i) => {
            const isMiddleHand = MIDDLE_HAND_INDICES.has(i);
            drawingUtils.drawLandmarks([lm], {
              radius: isMiddleHand ? 8 : 2.5,
              color: isMiddleHand ? "rgba(220, 80, 60, 0.9)" : "rgba(120, 200, 200, 0.7)",
            });

            if (isMiddleHand) {
              const px = Math.round(lm.x * canvas.width);
              const py = Math.round(lm.y * canvas.height);
              const tx = lm.x * canvas.width;
              const ty = lm.y * canvas.height;
              ctx.save();
              ctx.translate(tx, ty);
              ctx.scale(-1, 1);
              ctx.font = `16px ${SERIF}`;
              ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
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
