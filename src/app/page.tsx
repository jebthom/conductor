"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";

const PoseViewer = dynamic(() => import("@/components/PoseViewer"), {
  ssr: false,
});

export default function Home() {
  const [status, setStatus] = useState("Press SPACE to conduct");
  const [busy, setBusy] = useState(false);

  const conduct = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setStatus("Generating text...");

    try {
      const genRes = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: "Say two interesting sentences about music and movement.",
        }),
      });
      const { text, error: genError } = await genRes.json();
      if (genError) throw new Error(genError);

      setStatus(`Speaking: "${text}"`);

      const speakRes = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!speakRes.ok) throw new Error("TTS failed");

      const audioBlob = await speakRes.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      await new Promise<void>((resolve, reject) => {
        audio.onended = () => resolve();
        audio.onerror = () => reject(new Error("Audio playback failed"));
        audio.play();
      });

      URL.revokeObjectURL(audioUrl);
      setStatus("Press SPACE to conduct");
    } catch (err) {
      console.error(err);
      setStatus(`Error: ${err instanceof Error ? err.message : "unknown"}`);
    } finally {
      setBusy(false);
    }
  }, [busy]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        conduct();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [conduct]);

  return (
    <main className="h-screen w-screen flex items-center justify-center bg-black">
      <div className="aspect-[4/3] max-w-[1280px] max-h-full w-full flex flex-col">
        <div className="h-3/4">
          <PoseViewer />
        </div>
        <div className="h-1/4 flex items-center justify-center px-4">
          <p className="text-lg font-mono text-white text-center">{status}</p>
        </div>
      </div>
    </main>
  );
}
