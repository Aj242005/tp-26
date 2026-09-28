"""Generate en-IN narration, timed captions, original score, and local demo assets.

Run with: uv run --with edge-tts --with imageio-ffmpeg --with numpy --with pillow python scripts/prepare.py
Only the authored narration is sent to Microsoft's speech service. No app data or secrets.
"""
import asyncio
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import wave

import edge_tts
import imageio_ffmpeg
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
BUILD = ROOT / "build"
PUBLIC.mkdir(exist_ok=True)
BUILD.mkdir(exist_ok=True)
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
SCENES = json.loads((ROOT / "script.json").read_text(encoding="utf-8"))
VOICE = os.environ.get("FILM_VOICE", "en-IN-NeerjaNeural")


def ffmpeg(*args):
    result = subprocess.run([FFMPEG, "-hide_banner", "-loglevel", "error", "-y", *map(str, args)], capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(result.stderr[-3000:])


def duration(path):
    result = subprocess.run([FFMPEG, "-hide_banner", "-i", str(path)], capture_output=True, text=True)
    match = re.search(r"Duration: (\d+):(\d+):(\d+\.\d+)", result.stderr)
    if not match:
        raise RuntimeError(f"Cannot read duration: {path}")
    h, m, s = map(float, match.groups())
    return h * 3600 + m * 60 + s


async def narration():
    captions, reports = [], []
    for i, scene in enumerate(SCENES):
        signature = hashlib.sha256((scene["voice"] + VOICE + "+18%").encode()).hexdigest()[:10]
        raw = BUILD / f"voice-{i:02d}-{signature}.mp3"
        boundary_file = BUILD / f"voice-{i:02d}-{signature}.json"
        if raw.exists() and boundary_file.exists():
            words = json.loads(boundary_file.read_text(encoding="utf-8"))
        else:
            words = []
            for attempt in range(3):
                try:
                    words = []
                    with raw.open("wb") as audio:
                        stream = edge_tts.Communicate(scene["voice"], VOICE, rate="+18%", boundary="WordBoundary")
                        async for chunk in stream.stream():
                            if chunk["type"] == "audio":
                                audio.write(chunk["data"])
                            elif chunk["type"] == "WordBoundary":
                                words.append({"start": chunk["offset"] / 1e7, "end": (chunk["offset"] + chunk["duration"]) / 1e7, "text": chunk["text"]})
                    if not words or raw.stat().st_size < 1000:
                        raise RuntimeError("Speech service returned no usable audio")
                    break
                except Exception:
                    if attempt == 2:
                        raise
                    await asyncio.sleep(2)
            boundary_file.write_text(json.dumps(words, ensure_ascii=False), encoding="utf-8")
        length = duration(raw)
        available = scene["duration"] - 0.65
        speed = max(1.0, length / available)
        if speed > 1.32:
            raise ValueError(f"Scene {i} needs a shorter script: {speed:.2f}x")
        ffmpeg("-i", raw, "-af", f"atempo={speed:.6f},loudnorm=I=-16:TP=-2:LRA=8,afade=t=in:d=0.02", "-ar", "48000", PUBLIC / f"voice-{i:02d}.wav")
        cursor = 0
        for word in words:
            found = scene["voice"].lower().find(word["text"].lower(), cursor)
            if found >= 0:
                end = found + len(word["text"])
                while end < len(scene["voice"]) and scene["voice"][end] in ".,;:!?":
                    end += 1
                word["text"] = scene["voice"][found:end]
                cursor = end
        group = []
        for word in words:
            if group and (len(" ".join(w["text"] for w in group)) + len(word["text"]) > 62 or len(group) >= 9 or group[-1]["text"].endswith((".", "?", "!", ";"))):
                captions.append({"start": scene["start"] + 0.25 + group[0]["start"] / speed, "end": scene["start"] + 0.25 + word["start"] / speed, "text": " ".join(w["text"] for w in group)})
                group = []
            group.append(word)
        if group:
            captions.append({"start": scene["start"] + 0.25 + group[0]["start"] / speed, "end": min(scene["start"] + scene["duration"] - 0.15, scene["start"] + 0.5 + group[-1]["end"] / speed), "text": " ".join(w["text"] for w in group)})
        reports.append({"scene": scene["id"], "duration": round(length / speed, 3), "speed": round(speed, 3), "voice": VOICE})
        print(f"Narration {i + 1}/12 ready ({length / speed:.1f}s)", flush=True)
    (ROOT / "src" / "captions.json").write_text(json.dumps(captions, ensure_ascii=False, indent=2), encoding="utf-8")
    (BUILD / "narration-report.json").write_text(json.dumps(reports, indent=2), encoding="utf-8")

    def srt_time(seconds):
        ms = round(seconds * 1000)
        return f"{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02},{ms % 1000:03}"

    (PUBLIC / "prooflane-en-IN.srt").write_text("\n\n".join(f"{i+1}\n{srt_time(c['start'])} --> {srt_time(c['end'])}\n{c['text']}" for i, c in enumerate(captions)) + "\n", encoding="utf-8")


def score():
    # Original restrained electronic score: D minor, 96 BPM. No sampled music.
    sr, seconds = 48000, 120
    track = np.zeros((sr * seconds, 2), dtype=np.float32)
    rng = np.random.default_rng(26155)

    def tone(start, length, frequency, gain, pan=0, kind="pad"):
        n = min(round(length * sr), len(track) - round(start * sr))
        if n <= 0:
            return
        t = np.arange(n, dtype=np.float32) / sr
        if kind == "pad":
            env = np.minimum(t / .8, 1) * np.minimum((length - t) / 1.5, 1)
            signal = (np.sin(2*np.pi*frequency*t) + .24*np.sin(2*np.pi*frequency*2.002*t)) * env
        else:
            env = (1-np.exp(-t*100)) * np.exp(-t*3.5)
            signal = (np.sin(2*np.pi*frequency*t) + .18*np.sin(2*np.pi*frequency*3*t)) * env
        signal *= gain
        at = round(start * sr)
        track[at:at+n, 0] += signal * np.sqrt((1-pan)/2)
        track[at:at+n, 1] += signal * np.sqrt((1+pan)/2)

    chords = [(146.832,174.614,220), (130.813,174.614,220), (130.813,164.814,196), (130.813,146.832,196)]
    for bar in range(24):
        for j, hz in enumerate(chords[bar % 4]):
            tone(bar*5, 6.3, hz, .013, (j-1)*.5)
        tone(bar*5, 4.6, chords[bar % 4][0]/2, .02)
        for beat in range(8):
            if beat % 2 == 0 or bar >= 4:
                tone(bar*5+beat*.625, 1.3, chords[bar % 4][beat % 3]*2, .011, (-1 if beat%2 else 1)*.4, "pluck")
    for scene in SCENES[1:]:
        start = scene["start"]-.18
        n = int(.5*sr)
        t = np.arange(n)/sr
        noise = rng.standard_normal(n).astype(np.float32)
        noise = np.convolve(noise, np.ones(35)/35, mode="same")
        sweep = noise * np.sin(np.pi*t/.5)**2 * .028
        at = int(start*sr)
        track[at:at+n] += sweep[:,None]
        tone(scene["start"], .7, 880, .012, 0, "pluck")
    time = np.arange(len(track))/sr
    track *= (np.minimum(time/2, 1)*np.clip((120-time)/2.3, 0, 1))[:,None]
    write_wave(PUBLIC / "score.wav", track, sr)


def write_wave(path, data, sr):
    with wave.open(str(path), "wb") as out:
        out.setnchannels(2)
        out.setsampwidth(2)
        out.setframerate(sr)
        out.writeframes((np.clip(data, -1, 1)*32767).astype("<i2").tobytes())


def assets():
    project = ROOT.parent
    shutil.copy2(project / "runtime/ui-prooflane/overview-viewport.png", PUBLIC / "overview.png")
    shutil.copy2(project / "runtime/audit-trail/pipeline.png", PUBLIC / "trail.png")
    Image.open(project / "runtime/ui-prooflane/evidence.png").crop((285, 610, 1565, 1330)).save(PUBLIC / "evidence-detail.png")
    ffmpeg("-ss", "32", "-i", project / "docs/deliverables/demo.webm", "-t", "9", "-vf", "crop=1440:880:0:0,fps=30", "-an", "-c:v", "libx264", "-crf", "17", "-preset", "fast", "-pix_fmt", "yuv420p", PUBLIC / "app-evidence.mp4")
    (BUILD / "ffmpeg-path.txt").write_text(FFMPEG, encoding="utf-8")


def mix():
    args = ["-i", PUBLIC / "score.wav"]
    filters, inputs = [], ["[0:a]"]
    for i, scene in enumerate(SCENES):
        args.extend(["-i", PUBLIC / f"voice-{i:02d}.wav"])
        delay = round((scene["start"]+.25)*1000)
        filters.append(f"[{i+1}:a]adelay={delay}|{delay}[v{i}]")
        inputs.append(f"[v{i}]")
    filters.append("".join(inputs) + f"amix=inputs={len(inputs)}:duration=first:normalize=0,alimiter=limit=0.95:level=false[out]")
    ffmpeg(*args, "-filter_complex", ";".join(filters), "-map", "[out]", "-ar", "48000", "-ac", "2", "-t", "120", PUBLIC / "master.wav")


if __name__ == "__main__":
    assert sum(s["duration"] for s in SCENES) == 120
    assert all(s["start"] == sum(x["duration"] for x in SCENES[:i]) for i, s in enumerate(SCENES))
    (ROOT / "src").mkdir(exist_ok=True)
    if not (PUBLIC / "app-evidence.mp4").exists():
        assets()
    if not (PUBLIC / "score.wav").exists():
        score()
    asyncio.run(narration())
    mix()
    print("Prepared 120-second master, en-IN captions, score and product assets.")
