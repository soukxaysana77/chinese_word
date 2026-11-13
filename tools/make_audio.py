"""Make the recorded audio for the game with Kokoro (runs offline on this PC).

Writes audio/<id>.mp3 for every sentence and every word block, plus
audio/manifest.json mapping each text to its file. The game plays these and
falls back to the browser's voice for anything without a file (e.g. words the
admin adds later — just run this again and push).

Setup (once): see "Recorded audio" in SERVER_SETUP.md. Then, from the repo root:

    ..\\tts\\env\\Scripts\\python -X utf8 tools\\make_audio.py

Options: --voice zf_003 (one of Kokoro v1.1-zh's voices), --speed 0.9,
         --model <folder with kokoro-v1.1-zh.fp16.onnx, voices-v1.1-zh.bin, config.json>
Existing files are reused, so re-running only makes what's new. Use --redo to
make everything again (e.g. after changing the voice).
"""
import argparse
import hashlib
import json
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

import numpy as np
import soundfile as sf

REPO = Path(__file__).resolve().parent.parent
AUDIO = REPO / "audio"


def load_built_in():
    """Sentences from data/questions.js (it's JavaScript, so let node read it)."""
    js = "const fs=require('fs');const s=fs.readFileSync(process.argv[1],'utf8');" \
         "process.stdout.write(JSON.stringify(new Function(s+';return allQuestions;')()))"
    out = subprocess.run(["node", "-e", js, str(REPO / "data" / "questions.js")],
                         capture_output=True, check=True)
    return json.loads(out.stdout.decode("utf-8"))


def load_server():
    """The live list the admin saved (if js/config.js points at a server)."""
    cfg = (REPO / "js" / "config.js").read_text(encoding="utf-8")
    url = re.search(r'supabaseUrl:\s*"([^"]*)"', cfg)
    key = re.search(r'supabaseKey:\s*"([^"]*)"', cfg)
    if not (url and key and url.group(1) and key.group(1)):
        return []
    req = urllib.request.Request(
        url.group(1).rstrip("/") + "/rest/v1/game_data?id=eq.main&select=questions",
        headers={"apikey": key.group(1)})
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            rows = json.loads(res.read().decode("utf-8"))
        return rows[0]["questions"] if rows else []
    except Exception as e:  # offline etc. — built-in list is still done
        print("  (couldn't read the server list:", e, ")")
        return []


def clip_name(text, voice, speed):
    # the voice is part of the name, so a new voice gets new file addresses and
    # browsers can't keep playing the old one from their cache
    key = f"{voice}|{speed}|{text}"
    return hashlib.sha1(key.encode("utf-8")).hexdigest()[:12] + ".mp3"


def trim(samples, sr):
    """Cut the silence the voice adds before/after, keep a tiny margin."""
    level = np.abs(samples)
    loud = np.where(level > 0.02 * level.max())[0]
    if not len(loud):
        return samples
    pad = int(0.04 * sr)
    return samples[max(0, loud[0] - pad): loud[-1] + pad]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", default="zf_003")
    ap.add_argument("--speed", type=float, default=0.9)
    ap.add_argument("--model", default=str(REPO.parent / "tts" / "model"))
    ap.add_argument("--redo", action="store_true")
    args = ap.parse_args()

    questions = load_built_in() + load_server()
    texts = set()
    for q in questions:
        texts.add(q["chinese"])
        texts.update(q["answer"])
    texts = sorted(t for t in texts if t.strip())

    AUDIO.mkdir(exist_ok=True)
    manifest_path = AUDIO / "manifest.json"
    name = {t: clip_name(t, args.voice, args.speed) for t in texts}

    todo = [t for t in texts if args.redo or not (AUDIO / name[t]).exists()]
    print(f"{len(texts)} texts ({len(questions)} sentences), {len(todo)} to make, voice {args.voice}")

    if todo:
        from kokoro_onnx import Kokoro
        from misaki import zh
        m = Path(args.model)
        kokoro = Kokoro(str(m / "kokoro-v1.1-zh.fp16.onnx"), str(m / "voices-v1.1-zh.bin"),
                        vocab_config=str(m / "config.json"))
        g2p = zh.ZHG2P(version="1.1")
        for i, text in enumerate(todo, 1):
            phonemes, _ = g2p(text)
            samples, sr = kokoro.create(phonemes, voice=args.voice, speed=args.speed, is_phonemes=True)
            sf.write(AUDIO / name[text], trim(samples, sr), sr, format="MP3", compression_level=0.7)
            if i % 50 == 0 or i == len(todo):
                print(f"  {i}/{len(todo)}")

    # drop files no longer used (old voice, deleted sentences)
    keep = set(name.values())
    removed = 0
    for f in AUDIO.glob("*.mp3"):
        if f.name not in keep:
            f.unlink()
            removed += 1

    manifest = {
        "voice": args.voice,
        "speed": args.speed,
        "note": "Made by tools/make_audio.py (Kokoro v1.1-zh). text -> file in this folder.",
        "files": name,
    }
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
    size = sum(f.stat().st_size for f in AUDIO.glob("*.mp3"))
    print(f"done: {len(texts)} clips, {size / 1024 / 1024:.2f} MB, removed {removed} unused")


if __name__ == "__main__":
    sys.exit(main())
