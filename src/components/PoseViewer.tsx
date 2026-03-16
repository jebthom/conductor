"use client";

import { useEffect, useRef } from "react";
import {
  PoseLandmarker,
  FilesetResolver,
  DrawingUtils,
} from "@mediapipe/tasks-vision";

const POSE_CONNECTIONS = PoseLandmarker.POSE_CONNECTIONS;

interface PoseViewerProps {
  onBoxTouch?: (touching: boolean) => void;
  onCircleTouch?: (touching: boolean) => void;
}

export default function PoseViewer({ onBoxTouch, onCircleTouch }: PoseViewerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onBoxTouchRef = useRef(onBoxTouch);
  const onCircleTouchRef = useRef(onCircleTouch);
  const boxWasTouching = useRef(false);
  const circleWasTouching = useRef(false);

  onBoxTouchRef.current = onBoxTouch;
  onCircleTouchRef.current = onCircleTouch;

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

        // Draw target shapes (canvas is flipped: visual left = high x, visual right = low x)
        const boxSize = 180;
        const boxX = (5 / 7) * canvas.width - boxSize / 2;  // visual 2/7 from left
        const boxY = canvas.height / 2 - boxSize / 2;
        const boxHit = fingerPositions.some(
          (p) => p.x >= boxX && p.x <= boxX + boxSize && p.y >= boxY && p.y <= boxY + boxSize
        );
        if (boxHit) {
          ctx.fillStyle = "rgba(0, 255, 255, 0.4)";
          ctx.fillRect(boxX, boxY, boxSize, boxSize);
        }
        if (boxHit !== boxWasTouching.current) {
          onBoxTouchRef.current?.(boxHit);
        }
        boxWasTouching.current = boxHit;
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 2;
        ctx.strokeRect(boxX, boxY, boxSize, boxSize);

        const circleX = (2 / 7) * canvas.width;  // visual 2/7 from right
        const circleY = canvas.height / 2;
        const circleR = 90;
        const circleHit = fingerPositions.some(
          (p) => Math.hypot(p.x - circleX, p.y - circleY) <= circleR
        );
        ctx.beginPath();
        ctx.arc(circleX, circleY, circleR, 0, Math.PI * 2);
        if (circleHit) {
          ctx.fillStyle = "rgba(0, 255, 255, 0.4)";
          ctx.fill();
        }
        if (circleHit !== circleWasTouching.current) {
          onCircleTouchRef.current?.(circleHit);
        }
        circleWasTouching.current = circleHit;
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 2;
        ctx.stroke();

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
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2/3 h-[100px] border border-white/50 rounded" />
    </div>
  );
}
