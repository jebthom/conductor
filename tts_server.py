"""Kokoro TTS sidecar server. Run with: .venv/Scripts/python.exe tts_server.py"""

import io
import soundfile as sf
from flask import Flask, request, jsonify, send_file
from kokoro import KPipeline

app = Flask(__name__)
pipeline: KPipeline | None = None


def get_pipeline() -> KPipeline:
    global pipeline
    if pipeline is None:
        pipeline = KPipeline(lang_code="a")  # American English
    return pipeline


@app.route("/speak", methods=["POST"])
def speak():
    data = request.get_json()
    text = data.get("text", "")
    voice = data.get("voice", "af_heart")
    speed = data.get("speed", 1.0)

    if not text:
        return jsonify({"error": "Missing text"}), 400

    pipe = get_pipeline()

    # Generate all audio chunks and concatenate
    samples = []
    for _, _, audio in pipe(text, voice=voice, speed=speed):
        samples.append(audio)

    import torch
    full_audio = torch.cat(samples)

    buf = io.BytesIO()
    sf.write(buf, full_audio.numpy(), 24000, format="WAV")
    buf.seek(0)

    return send_file(buf, mimetype="audio/wav")


@app.route("/health")
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    print("Loading Kokoro model...")
    get_pipeline()
    print("Kokoro TTS sidecar ready on http://localhost:5100")
    app.run(host="127.0.0.1", port=5100)
