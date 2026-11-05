#!/usr/bin/env python3
"""Turn raw AI video clips into the hero film.

Usage:  python3 tools/prepare_video.py media-src/clips.json
Needs:  ffmpeg + ffprobe (with libvpx-vp9 and libx264), Python 3, numpy

clips.json (paths relative to that file):
{
  "clips": [
    {"file": "01-arrival.mp4",     "trim": [0, 8], "states": [["arrival", 0]]},
    {"file": "02-draw-swing.mp4",  "trim": [0, 8], "states": [["sword_draw", 0], ["sword_swing", 3.5]]},
    {"file": "03-sheath-walk.mp4", "trim": [0, 8], "states": [["sheathing", 0], ["walk_to_fire", 3.5]]},
    {"file": "04-sit.mp4",         "trim": [0, 8], "states": [["sitting", 0]]},
    {"file": "05-idle.mp4",        "trim": [0, 8], "states": [["idle", 0]]}
  ],
  "crossfade": 0.5,       # seconds of dissolve between consecutive clips
  "fade": 1.0,            # fade from/to black at the loop point
  "poster_at": null       # seconds in the final film; default: middle of the last clip
}
State times are relative to the start of the trimmed clip.

Writes:
  assets/hero/knight.webm, assets/hero/knight.mp4   (no audio, 1280x720)
  assets/knight-poster.jpg                           (static fallback)
  js/scene/video-manifest.js                         (sources, states, occupancy grid)
"""
import base64
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
W, H, FPS = 1280, 720, 24
GW, GH, GRID_FPS = 32, 18, 4  # occupancy grid used to keep the digital rain off the figure


def run(cmd):
    subprocess.run(cmd, check=True)


def duration(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                         check=True, capture_output=True, text=True).stdout
    return float(out.strip())


def main(cfg_path):
    cfg_path = Path(cfg_path).resolve()
    cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
    base = cfg_path.parent
    clips = cfg["clips"]
    xf = float(cfg.get("crossfade", 0.5))
    fade = float(cfg.get("fade", 1.0))
    for c in clips:
        if not (base / c["file"]).is_file():
            sys.exit(f"missing clip: {base / c['file']}")

    # durations after trimming, and where each clip starts in the final film
    lens, starts, t = [], [], 0.0
    for i, c in enumerate(clips):
        a, b = c.get("trim", [0, duration(base / c["file"])])
        b = min(b, duration(base / c["file"]))
        c["_trim"] = (a, b)
        lens.append(b - a)
        starts.append(t if i == 0 else t - xf)
        t = starts[-1] + lens[-1]
    total = t

    # filter graph: normalise each clip, chain cross-dissolves, crush blacks, fade at the loop point
    parts, inputs = [], []
    for i, c in enumerate(clips):
        a, b = c["_trim"]
        inputs += ["-i", str(base / c["file"])]
        parts.append(f"[{i}:v]trim={a}:{b},setpts=PTS-STARTPTS,fps={FPS},scale={W}:{H}:force_original_aspect_ratio=increase,"
                     f"crop={W}:{H},setsar=1,format=yuv420p[v{i}]")
    prev = "v0"
    for i in range(1, len(clips)):
        out = f"x{i}"
        parts.append(f"[{prev}][v{i}]xfade=transition=fade:duration={xf}:offset={starts[i]:.3f}[{out}]")
        prev = out
    parts.append(f"[{prev}]curves=all='0/0 0.07/0.015 0.5/0.47 1/1',"
                 f"fade=t=in:st=0:d={fade},fade=t=out:st={total - fade:.3f}:d={fade},format=yuv420p[out]")
    graph = ";".join(parts)

    tmp = Path(tempfile.mkdtemp(prefix="hero-"))
    master = tmp / "master.mp4"
    run(["ffmpeg", "-y", "-v", "error", *inputs, "-filter_complex", graph, "-map", "[out]", "-an",
         "-c:v", "libx264", "-crf", "12", "-preset", "medium", str(master)])

    out_dir = ROOT / "assets" / "hero"
    out_dir.mkdir(parents=True, exist_ok=True)
    webm, mp4 = out_dir / "knight.webm", out_dir / "knight.mp4"
    run(["ffmpeg", "-y", "-v", "error", "-i", str(master), "-an", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "36",
         "-row-mt", "1", "-deadline", "good", "-cpu-used", "2", "-pix_fmt", "yuv420p", str(webm)])
    run(["ffmpeg", "-y", "-v", "error", "-i", str(master), "-an", "-c:v", "libx264", "-crf", "26", "-preset", "slow",
         "-profile:v", "high", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(mp4)])

    poster_at = cfg.get("poster_at")
    if poster_at is None:
        poster_at = starts[-1] + lens[-1] / 2
    run(["ffmpeg", "-y", "-v", "error", "-ss", f"{poster_at:.3f}", "-i", str(master), "-frames:v", "1", "-q:v", "4",
         str(ROOT / "assets" / "knight-poster.jpg")])

    # occupancy grid: a cell is "occupied" when its brightest pixel stands out from the frame's dark background
    pw, ph = GW * 8, GH * 8
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(master), "-vf", f"fps={GRID_FPS},scale={pw}:{ph}:flags=area,format=gray",
                          "-f", "rawvideo", "-"], check=True, capture_output=True).stdout
    frames = np.frombuffer(raw, dtype=np.uint8).reshape(-1, ph, pw)
    packed = []
    for fr in frames:
        cells = fr.reshape(GH, 8, GW, 8).max(axis=(1, 3)).astype(np.int16)
        bgl = int(np.percentile(fr, 40))
        occ = cells > bgl + 26
        # dilate one cell, then close small horizontal gaps (dark armour between highlights)
        d = occ.copy()
        d[1:, :] |= occ[:-1, :]; d[:-1, :] |= occ[1:, :]; d[:, 1:] |= occ[:, :-1]; d[:, :-1] |= occ[:, 1:]
        for y in range(GH):
            xs = np.flatnonzero(d[y])
            for x0, x1 in zip(xs[:-1], xs[1:]):
                if 1 < x1 - x0 <= 3:
                    d[y, x0:x1] = True
        bits = np.packbits(d.flatten(), bitorder="little")
        packed.append(base64.b64encode(bits.tobytes()).decode())

    states = []
    for i, c in enumerate(clips):
        for name, rel in c.get("states", []):
            states.append([name, round(max(0.0, starts[i] + float(rel)), 3)])
    states.sort(key=lambda s: s[1])

    manifest = {
        "width": W, "height": H, "duration": round(total, 3),
        "poster": "assets/knight-poster.jpg",
        "sources": [
            {"src": "assets/hero/knight.webm", "type": 'video/webm; codecs="vp9"'},
            {"src": "assets/hero/knight.mp4", "type": "video/mp4"},
        ],
        "states": states,
        "track": {"fps": GRID_FPS, "gw": GW, "gh": GH, "frames": packed},
    }
    (ROOT / "js" / "scene" / "video-manifest.js").write_text(
        "// Generated by tools/prepare_video.py. Do not edit by hand.\n"
        "// Set back to `export default null;` to return to the procedural Canvas scene.\n"
        "export default " + json.dumps(manifest, separators=(",", ":")) + ";\n", encoding="utf-8")
    shutil.rmtree(tmp, ignore_errors=True)

    kb = lambda p: f"{p.stat().st_size / 1024:.0f} KB"
    print(f"film {total:.1f}s · webm {kb(webm)} · mp4 {kb(mp4)} · poster {kb(ROOT / 'assets/knight-poster.jpg')}")
    print("states:", ", ".join(f"{n}@{t}s" for n, t in states))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
