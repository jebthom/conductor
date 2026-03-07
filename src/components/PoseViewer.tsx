"use client";

import { useEffect, useRef, useCallback } from "react";
import {
  PoseLandmarker,
  FilesetResolver,
  DrawingUtils,
} from "@mediapipe/tasks-vision";

const POSE_CONNECTIONS = PoseLandmarker.POSE_CONNECTIONS;

export default function PoseViewer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);

  const initPose = useCallback(async () => {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );

    landmarkerRef.current = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numPoses: 1,
    });
  }, []);

  const startCamera = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    const video = videoRef.current!;
    video.srcObject = stream;
    await video.play();
  }, []);

  const renderLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = landmarkerRef.current;

    if (!video || !canvas || !landmarker || video.readyState < 2) {
      requestAnimationFrame(renderLoop);
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

    requestAnimationFrame(renderLoop);
  }, []);

  useEffect(() => {
    initPose().then(startCamera).then(() => requestAnimationFrame(renderLoop));
  }, [initPose, startCamera, renderLoop]);

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
