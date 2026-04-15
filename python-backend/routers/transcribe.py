"""Module 1 — transcription pipeline.

POST /api/transcribe
    Input: { url: str }
    Flow: yt-dlp → extract audio → SenseVoice → clean up
    Output: { job_id }

The actual ASR work runs in a background task registered with APScheduler.
Clients poll GET /api/jobs/{job_id} until status == "done".
"""
import asyncio
import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from config import TMP_DIR
from db.session import SessionLocal, get_db
from db.store import create_job, update_job, get_job, job_to_dict
from services import ffmpeg_service, sensevoice_service, ytdlp_service

router = APIRouter(prefix="/transcribe", tags=["transcribe"])


class TranscribeRequest(BaseModel):
    url: str = Field(..., min_length=1)


class TranscribeResponse(BaseModel):
    job_id: str
    status: str


async def _run_transcribe_job(job_id: str, url: str) -> None:
    """Background task — runs in the event loop off the request path."""
    db = SessionLocal()
    work_dir = TMP_DIR / f"transcribe-{uuid.uuid4().hex}"
    try:
        update_job(db, job_id, status="running", progress=5)

        work_dir.mkdir(parents=True, exist_ok=True)

        # 1. Download video via yt-dlp
        update_job(db, job_id, progress=15)
        video_path = await ytdlp_service.download_video(url, work_dir)

        # 2. Extract audio
        update_job(db, job_id, progress=40)
        audio_path = work_dir / "audio.wav"
        await ffmpeg_service.extract_audio(video_path, audio_path)

        # 3. Probe duration
        duration = await ffmpeg_service._probe_duration(video_path)

        # 4. Run ASR (blocking → offload to thread)
        update_job(db, job_id, progress=60)
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(None, sensevoice_service.transcribe, audio_path)

        update_job(
            db,
            job_id,
            status="done",
            progress=100,
            result={
                "transcript": result.get("text", ""),
                "emotion": result.get("emotion"),
                "duration": duration,
                "source_url": url,
            },
        )
    except Exception as e:  # noqa: BLE001
        update_job(db, job_id, status="failed", error=repr(e))
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)
        db.close()


@router.post("", response_model=TranscribeResponse)
async def transcribe(
    req: TranscribeRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    job = create_job(db, kind="transcribe", payload={"url": req.url})
    background_tasks.add_task(_run_transcribe_job, job.id, req.url)
    return TranscribeResponse(job_id=job.id, status="queued")


@router.get("/{job_id}")
def read_transcribe_job(job_id: str, db: Session = Depends(get_db)):
    job = get_job(db, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.kind != "transcribe":
        raise HTTPException(status_code=400, detail="Wrong job kind")
    return job_to_dict(job)
