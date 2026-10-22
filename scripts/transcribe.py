"""Local transcription adapter. Emit one JSON document; never call an AI API."""
import argparse
import json
import os
import sys
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("audio")
    parser.add_argument("--model", default="base")
    parser.add_argument("--language", default="")
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    os.environ.setdefault("HF_HOME", str(root / ".local/cache/huggingface"))
    os.environ.setdefault("XDG_CACHE_HOME", str(root / ".local/cache"))
    from faster_whisper import WhisperModel
    model = WhisperModel(args.model, device="cpu", compute_type="int8", download_root=str(root / ".local/cache/whisper"))
    segments, info = model.transcribe(args.audio, language=args.language or None, beam_size=5, vad_filter=True, condition_on_previous_text=False)
    rows = [{"start": round(s.start, 3), "end": round(s.end, 3), "text": s.text.strip()} for s in segments if s.text.strip()]
    print(json.dumps({"text": " ".join(s["text"] for s in rows), "language": info.language,
        "segments": rows, "engine": "faster-whisper", "model": args.model, "status": "completed",
        "note": "Speech recognition can miss words, names, code-switching, and music. Check important quotes against the video."}))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Local transcription failed: {type(error).__name__}: {error}", file=sys.stderr)
        sys.exit(1)
