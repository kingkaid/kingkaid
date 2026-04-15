"""Subtitle generation — turn SenseVoice ASR output into SRT/ASS files.

SenseVoice returns timestamped text (per-sentence or per-word). We translate
those into standard subtitle formats. Also provides a naive fallback that
splits a bare transcript by sentence boundaries when timestamps are absent.
"""
import re
from datetime import timedelta
from pathlib import Path

import srt


def _format_srt_time(seconds: float) -> str:
    return srt.timedelta_to_srt_timestamp(timedelta(seconds=max(0.0, seconds)))


def split_transcript_by_time(transcript: str, duration: float, target_seconds: float = 4.0) -> list[tuple[float, float, str]]:
    """Fallback: split a transcript evenly across the video duration.

    Used when SenseVoice's per-segment timestamps aren't available. Splits
    on CJK punctuation and sentence boundaries, then distributes time.
    """
    if not transcript.strip() or duration <= 0:
        return []

    # Split by CJK/Western punctuation
    pieces = re.split(r"(?<=[。！？!?\.\n])|(?<=[,，；;])", transcript)
    pieces = [p.strip() for p in pieces if p.strip()]
    if not pieces:
        return [(0.0, duration, transcript.strip())]

    # Group pieces until each group is roughly target_seconds long
    total_chars = sum(len(p) for p in pieces)
    time_per_char = duration / max(1, total_chars)

    segments: list[tuple[float, float, str]] = []
    t = 0.0
    buf: list[str] = []
    buf_chars = 0
    for p in pieces:
        buf.append(p)
        buf_chars += len(p)
        if buf_chars * time_per_char >= target_seconds:
            seg_dur = buf_chars * time_per_char
            text = "".join(buf).strip()
            segments.append((t, min(duration, t + seg_dur), text))
            t += seg_dur
            buf = []
            buf_chars = 0
    if buf:
        segments.append((t, duration, "".join(buf).strip()))

    return segments


def to_srt(segments: list[tuple[float, float, str]]) -> str:
    subs = [
        srt.Subtitle(index=i + 1, start=timedelta(seconds=s), end=timedelta(seconds=e), content=text)
        for i, (s, e, text) in enumerate(segments)
    ]
    return srt.compose(subs)


def to_ass(segments: list[tuple[float, float, str]]) -> str:
    """Minimal ASS output with a single default style."""
    header = (
        "[Script Info]\n"
        "Title: KingKaid\n"
        "ScriptType: v4.00+\n"
        "\n"
        "[V4+ Styles]\n"
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, "
        "BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, "
        "BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
        "Style: Default,微软雅黑,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,"
        "0,0,0,0,100,100,0,0,1,2,0,2,10,10,30,1\n"
        "\n"
        "[Events]\n"
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    )

    def _fmt(t: float) -> str:
        td = timedelta(seconds=max(0.0, t))
        total = int(td.total_seconds())
        h = total // 3600
        m = (total % 3600) // 60
        s = total % 60
        cs = int(td.microseconds / 10000)
        return f"{h}:{m:02d}:{s:02d}.{cs:02d}"

    lines = [
        f"Dialogue: 0,{_fmt(s)},{_fmt(e)},Default,,0,0,0,,{text}"
        for (s, e, text) in segments
    ]
    return header + "\n".join(lines) + "\n"


def write_subtitle(segments: list[tuple[float, float, str]], output_path: Path, fmt: str) -> Path:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if fmt == "srt":
        output_path.write_text(to_srt(segments), encoding="utf-8")
    elif fmt == "ass":
        output_path.write_text(to_ass(segments), encoding="utf-8")
    else:
        raise ValueError(f"Unsupported subtitle format: {fmt}")
    return output_path
