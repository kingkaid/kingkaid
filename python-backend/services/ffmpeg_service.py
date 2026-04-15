"""ffmpeg wrapper: audio extraction + video editing operations.

All operations run ffmpeg as a subprocess. ffmpeg-python is used for
filter composition; final execution is via asyncio.subprocess to keep
the event loop free.

ffmpeg binary is located via imageio-ffmpeg (bundled static binary),
with fallback to the system `ffmpeg` on PATH.
"""
import asyncio
import shutil
from functools import lru_cache
from pathlib import Path


@lru_cache(maxsize=1)
def ffmpeg_binary() -> str:
    """Return path to a usable ffmpeg binary."""
    # Prefer bundled static binary
    try:
        import imageio_ffmpeg  # type: ignore

        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:  # noqa: BLE001
        pass
    # Fall back to system PATH
    system = shutil.which("ffmpeg")
    if system:
        return system
    raise RuntimeError("ffmpeg not found (install ffmpeg or imageio-ffmpeg)")


@lru_cache(maxsize=1)
def ffprobe_binary() -> str:
    """Return path to a usable ffprobe. imageio-ffmpeg does not ship ffprobe;
    for duration probing we can use `ffmpeg -i` parsing as a fallback."""
    system = shutil.which("ffprobe")
    if system:
        return system
    # imageio-ffmpeg does NOT include ffprobe — we'll probe via ffmpeg -i
    return ""


async def _run_ffmpeg(args: list[str]) -> None:
    proc = await asyncio.create_subprocess_exec(
        ffmpeg_binary(),
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        *args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {stderr.decode('utf-8', errors='replace').strip()}")


async def extract_audio(video_path: Path, output_path: Path) -> Path:
    """Extract mono 16kHz WAV from a video (optimal for ASR)."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    await _run_ffmpeg([
        "-i", str(video_path),
        "-vn",
        "-ac", "1",
        "-ar", "16000",
        "-f", "wav",
        str(output_path),
    ])
    return output_path


async def cut_segment(input_path: Path, start: float, end: float, output_path: Path) -> Path:
    """Cut [start, end] from input video.

    Uses re-encoding (libx264 + aac) instead of stream copy to get frame-accurate
    cuts. Stream copy would be faster but would align to keyframes, which can
    drift by 1-2 seconds on typical encoded videos.
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)
    duration = max(0.0, end - start)
    await _run_ffmpeg([
        "-ss", f"{start:.3f}",
        "-i", str(input_path),
        "-t", f"{duration:.3f}",
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-avoid_negative_ts", "make_zero",
        str(output_path),
    ])
    return output_path


async def concat_videos(paths: list[Path], output_path: Path) -> Path:
    """Concat multiple videos using ffmpeg concat demuxer."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    list_file = output_path.parent / f"{output_path.stem}_list.txt"
    with open(list_file, "w", encoding="utf-8") as f:
        for p in paths:
            f.write(f"file '{p.absolute()}'\n")
    try:
        await _run_ffmpeg([
            "-f", "concat",
            "-safe", "0",
            "-i", str(list_file),
            "-c", "copy",
            str(output_path),
        ])
    finally:
        list_file.unlink(missing_ok=True)
    return output_path


async def overlay_pip(
    main_path: Path,
    pip_path: Path,
    x: int,
    y: int,
    w: int,
    h: int,
    start: float,
    end: float,
    output_path: Path,
) -> Path:
    """Overlay pip_path onto main_path at (x,y) with size (w,h) during [start,end]."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    filter_complex = (
        f"[1:v]scale={w}:{h}[pip];"
        f"[0:v][pip]overlay={x}:{y}:enable='between(t,{start},{end})'"
    )
    await _run_ffmpeg([
        "-i", str(main_path),
        "-i", str(pip_path),
        "-filter_complex", filter_complex,
        "-c:a", "copy",
        str(output_path),
    ])
    return output_path


async def mix_bgm(
    video_path: Path,
    bgm_path: Path,
    bgm_volume: float,
    fade_in: float,
    fade_out: float,
    output_path: Path,
) -> Path:
    """Mix BGM with video audio, with fade in/out on the BGM track."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    # Probe duration — use ffprobe
    dur = await _probe_duration(video_path)
    fade_out_start = max(0.0, dur - fade_out)
    filter_complex = (
        f"[1:a]volume={bgm_volume},"
        f"afade=t=in:st=0:d={fade_in},"
        f"afade=t=out:st={fade_out_start}:d={fade_out},"
        f"atrim=0:{dur},asetpts=PTS-STARTPTS[bgm];"
        f"[0:a][bgm]amix=inputs=2:duration=first:dropout_transition=0[aout]"
    )
    await _run_ffmpeg([
        "-i", str(video_path),
        "-i", str(bgm_path),
        "-filter_complex", filter_complex,
        "-map", "0:v",
        "-map", "[aout]",
        "-c:v", "copy",
        "-shortest",
        str(output_path),
    ])
    return output_path


async def _probe_duration(path: Path) -> float:
    """Probe video duration. Prefers ffprobe if available, falls back to
    parsing `ffmpeg -i` stderr for 'Duration: HH:MM:SS.mmm'."""
    probe = ffprobe_binary()
    if probe:
        proc = await asyncio.create_subprocess_exec(
            probe,
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            str(path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await proc.communicate()
        try:
            return float(stdout.decode().strip())
        except ValueError:
            return 0.0

    # Fallback: parse `ffmpeg -i` stderr
    proc = await asyncio.create_subprocess_exec(
        ffmpeg_binary(),
        "-hide_banner",
        "-i",
        str(path),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()
    text = stderr.decode("utf-8", errors="replace")
    import re

    m = re.search(r"Duration:\s*(\d+):(\d+):(\d+\.\d+)", text)
    if m:
        h, mi, s = int(m.group(1)), int(m.group(2)), float(m.group(3))
        return h * 3600 + mi * 60 + s
    return 0.0
