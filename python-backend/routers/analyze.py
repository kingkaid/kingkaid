"""Module 13 — Competitor analysis for Douyin videos.

POST /api/analyze/video  — extract title/tags/transcript/thumbnail from a URL
GET  /api/analyze/{job_id}
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
from db.store import create_job, get_job, job_to_dict, update_job
from services import ffmpeg_service, sensevoice_service, ytdlp_service

router = APIRouter(prefix="/analyze", tags=["analyze"])


class AnalyzeRequest(BaseModel):
    url: str = Field(..., min_length=1)


class JobResponse(BaseModel):
    job_id: str
    status: str


async def _run_analyze_job(job_id: str, url: str) -> None:
    db = SessionLocal()
    work_dir = TMP_DIR / f"analyze-{uuid.uuid4().hex}"
    try:
        update_job(db, job_id, status="running", progress=5)
        work_dir.mkdir(parents=True, exist_ok=True)

        # 1. Extract metadata via yt-dlp --dump-json
        info = await ytdlp_service.dump_info(url)
        update_job(db, job_id, progress=20)

        title = info.get("title", "")
        description = info.get("description", "")
        tags = info.get("tags") or []
        # Normalize tags to "#xxx" format
        hash_tags = [f"#{t}" for t in tags if t]
        thumbnail_url = info.get("thumbnail") or ""
        uploader = info.get("uploader") or info.get("channel") or ""
        upload_date = info.get("upload_date") or ""
        like_count = info.get("like_count")
        view_count = info.get("view_count")

        # 2. Download video for transcription
        update_job(db, job_id, progress=35)
        video_path = await ytdlp_service.download_video(url, work_dir)

        # 3. Extract audio
        audio_path = work_dir / "audio.wav"
        await ffmpeg_service.extract_audio(video_path, audio_path)
        update_job(db, job_id, progress=55)

        duration = await ffmpeg_service._probe_duration(video_path)

        # 4. Transcribe with SenseVoice
        loop = asyncio.get_running_loop()
        asr = await loop.run_in_executor(None, sensevoice_service.transcribe, audio_path)
        update_job(db, job_id, progress=90)

        transcript = asr.get("text", "")

        update_job(
            db,
            job_id,
            status="done",
            progress=100,
            result={
                "title": title,
                "description": description,
                "tags": hash_tags,
                "transcript": transcript,
                "thumbnail_url": thumbnail_url,
                "uploader": uploader,
                "upload_date": upload_date,
                "like_count": like_count,
                "view_count": view_count,
                "duration": duration,
                "source_url": url,
            },
        )
    except Exception as e:  # noqa: BLE001
        update_job(db, job_id, status="failed", error=repr(e))
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)
        db.close()


@router.post("/video", response_model=JobResponse)
async def analyze_video(
    req: AnalyzeRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    job = create_job(db, kind="analyze", payload={"url": req.url})
    background_tasks.add_task(_run_analyze_job, job.id, req.url)
    return JobResponse(job_id=job.id, status="queued")


@router.get("/{job_id}")
def read_job(job_id: str, db: Session = Depends(get_db)):
    job = get_job(db, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.kind != "analyze":
        raise HTTPException(status_code=400, detail="Wrong job kind")
    return job_to_dict(job)
