"use client";

import { useEffect, useRef } from "react";
import {
  PoseLandmarker,
  FilesetResolver,
  DrawingUtils,
} from "@mediapipe/tasks-vision";

const POSE_CONNECTIONS = PoseLandmarker.POSE_CONNECTIONS;

export default function PoseViewer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

      stream = await navigator.mediaDevices.getUserMedia({ video: true });
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

        const drawingUtils = new DrawingUtils(ctx);
        for (const landmarks of result.landmarks) {
          drawingUtils.drawLandmarks(landmarks, {
            radius: 3,
            color: "#00FF00",
          });
          drawingUtils.drawConnectors(landmarks, POSE_CONNECTIONS, {
            color: "#00FFFF",
            lineWidth: 2,
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
    <div className="relative inline-block">
      <video
        ref={videoRef}
        className="block -scale-x-100"
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
