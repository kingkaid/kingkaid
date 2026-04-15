"""yt-dlp wrapper: video download + metadata extraction."""
import asyncio
import json
from pathlib import Path


async def _run(*args: str) -> tuple[int, str, str]:
    proc = await asyncio.create_subprocess_exec(
        *args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()
    return proc.returncode or 0, stdout.decode("utf-8", errors="replace"), stderr.decode("utf-8", errors="replace")


async def dump_info(url: str) -> dict:
    """Extract video metadata without downloading (yt-dlp --dump-json)."""
    rc, stdout, stderr = await _run(
        "yt-dlp",
        "--dump-json",
        "--no-warnings",
        "--no-playlist",
        url,
    )
    if rc != 0:
        raise RuntimeError(f"yt-dlp dump-json failed: {stderr.strip()}")
    return json.loads(stdout.strip().splitlines()[0])


async def download_video(url: str, output_dir: Path) -> Path:
    """Download a video to output_dir, return the resulting mp4 path."""
    output_dir.mkdir(parents=True, exist_ok=True)
    template = str(output_dir / "video.%(ext)s")
    rc, stdout, stderr = await _run(
        "yt-dlp",
        "-f",
        "best[ext=mp4]/best",
        "-o",
        template,
        "--no-playlist",
        "--no-warnings",
        url,
    )
    if rc != 0:
        raise RuntimeError(f"yt-dlp download failed: {stderr.strip()}")
    # Find the output file
    for p in output_dir.glob("video.*"):
        return p
    raise RuntimeError("yt-dlp download completed but no output file found")
