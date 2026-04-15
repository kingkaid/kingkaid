"""Module 6 — Subtitle generation.

POST /api/subtitle/upload   — upload a video to subtitle
POST /api/subtitle/generate — run SenseVoice + export SRT/ASS (async Job)
GET  /api/subtitle/{job_id}
GET  /api/subtitle/{job_id}/download — download the finished subtitle file
"""
import asyncio
import uuid
from pathlib import Path

import aiofiles
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from config import OUTPUTS_DIR, UPLOADS_DIR
from db.session import SessionLocal, get_db
from db.store import create_job, get_job, job_to_dict, update_job
from services import ffmpeg_service, sensevoice_service, subtitle_service

router = APIRouter(prefix="/subtitle", tags=["subtitle"])

SUB_UPLOADS = UPLOADS_DIR / "subtitle_sources"
SUB_OUTPUTS = OUTPUTS_DIR / "subtitled"
SUB_UPLOADS.mkdir(parents=True, exist_ok=True)
SUB_OUTPUTS.mkdir(parents=True, exist_ok=True)


class UploadResponse(BaseModel):
    file_path: str
    filename: str
    size: int
    duration: float


class GenerateRequest(BaseModel):
    video_path: str
    format: str = Field("srt", pattern="^(srt|ass)$")


class JobResponse(BaseModel):
    job_id: str
    status: str


@router.post("/upload", response_model=UploadResponse)
async def upload(file: UploadFile = File(...), session_id: str = Form("default")):
    safe_name = file.filename or f"sub-{uuid.uuid4().hex}.mp4"
    dest = SUB_UPLOADS / f"{uuid.uuid4().hex[:8]}_{safe_name}"

    size = 0
    async with aiofiles.open(dest, "wb") as out:
        while True:
            chunk = await file.read(1 << 20)
            if not chunk:
                break
            await out.write(chunk)
            size += len(chunk)

    duration = await ffmpeg_service._probe_duration(dest)
    return UploadResponse(file_path=str(dest), filename=safe_name, size=size, duration=duration)


async def _run_generate_job(job_id: str, video_path: str, fmt: str) -> None:
    db = SessionLocal()
    try:
        update_job(db, job_id, status="running", progress=10)
        src = Path(video_path)
        if not src.exists():
            raise FileNotFoundError(f"Source not found: {src}")

        # Extract audio for ASR
        temp_dir = SUB_OUTPUTS / f"tmp-{uuid.uuid4().hex}"
        temp_dir.mkdir(parents=True, exist_ok=True)
        audio_path = temp_dir / "audio.wav"
        await ffmpeg_service.extract_audio(src, audio_path)
        update_job(db, job_id, progress=35)

        duration = await ffmpeg_service._probe_duration(src)

        # Run ASR (offload to thread)
        loop = asyncio.get_running_loop()
        asr_result = await loop.run_in_executor(None, sensevoice_service.transcribe, audio_path)
        update_job(db, job_id, progress=70)

        transcript = asr_result.get("text", "")

        # If SenseVoice returned per-segment timestamps in raw, prefer those.
        raw = asr_result.get("raw") or {}
        segments = _extract_segments_from_raw(raw)
        if not segments:
            segments = subtitle_service.split_transcript_by_time(transcript, duration)

        # Write subtitle file
        suffix = "srt" if fmt == "srt" else "ass"
        output_path = SUB_OUTPUTS / f"subtitle-{uuid.uuid4().hex}.{suffix}"
        subtitle_service.write_subtitle(segments, output_path, fmt)

        # Clean up audio temp
        audio_path.unlink(missing_ok=True)
        temp_dir.rmdir()

        update_job(
            db,
            job_id,
            status="done",
            progress=100,
            result={
                "output_path": str(output_path),
                "format": fmt,
                "segments_count": len(segments),
                "duration": duration,
                "transcript": transcript,
            },
        )
    except Exception as e:  # noqa: BLE001
        update_job(db, job_id, status="failed", error=repr(e))
    finally:
        db.close()


def _extract_segments_from_raw(raw: dict) -> list[tuple[float, float, str]]:
    """Attempt to pull SenseVoice per-segment timestamps from the raw result.

    FunASR returns different shapes depending on the model config. We check
    the common fields: `sentence_info` (list of {start, end, text}) or
    `sentences` (same structure under a different key).
    """
    candidates = raw.get("sentence_info") or raw.get("sentences") or []
    segments: list[tuple[float, float, str]] = []
    for item in candidates:
        if not isinstance(item, dict):
            continue
        start = float(item.get("start", 0)) / 1000.0 if item.get("start", 0) > 10 else float(item.get("start", 0))
        end = float(item.get("end", 0)) / 1000.0 if item.get("end", 0) > 10 else float(item.get("end", 0))
        text = str(item.get("text", "")).strip()
        if text and end > start:
            segments.append((start, end, text))
    return segments


@router.post("/generate", response_model=JobResponse)
async def generate(
    req: GenerateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    job = create_job(db, kind="subtitle", payload={"video_path": req.video_path, "format": req.format})
    background_tasks.add_task(_run_generate_job, job.id, req.video_path, req.format)
    return JobResponse(job_id=job.id, status="queued")


@router.get("/{job_id}/download")
def download(job_id: str, db: Session = Depends(get_db)):
    job = get_job(db, job_id)
    if job is None or job.kind != "subtitle":
        raise HTTPException(status_code=404, detail="Job not found")
    import json as _json

    res = _json.loads(job.result or "{}")
    output = res.get("output_path")
    if not output:
        raise HTTPException(status_code=404, detail="Output not available yet")
    return FileResponse(output, media_type="text/plain", filename=Path(output).name)


@router.get("/{job_id}")
def read_job(job_id: str, db: Session = Depends(get_db)):
    job = get_job(db, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.kind != "subtitle":
        raise HTTPException(status_code=400, detail="Wrong job kind")
    return job_to_dict(job)
