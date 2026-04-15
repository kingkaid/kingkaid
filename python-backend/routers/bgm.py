"""Module 8 — Background music mixing.

GET  /api/bgm/library    — list built-in BGM tracks
POST /api/bgm/upload     — upload a custom BGM track
POST /api/bgm/upload_video — upload a video to mix BGM into
POST /api/bgm/mix        — async Job: mix video + BGM with fade in/out
GET  /api/bgm/{job_id}
"""
import uuid
from pathlib import Path

import aiofiles
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from config import DATA_ROOT, OUTPUTS_DIR, UPLOADS_DIR
from db.session import SessionLocal, get_db
from db.store import create_job, get_job, job_to_dict, update_job
from services import ffmpeg_service

router = APIRouter(prefix="/bgm", tags=["bgm"])

BGM_LIBRARY = DATA_ROOT / "assets" / "bgm"
BGM_UPLOADS = UPLOADS_DIR / "bgm_videos"
BGM_OUTPUTS = OUTPUTS_DIR / "bgm"

BGM_LIBRARY.mkdir(parents=True, exist_ok=True)
BGM_UPLOADS.mkdir(parents=True, exist_ok=True)
BGM_OUTPUTS.mkdir(parents=True, exist_ok=True)

AUDIO_EXTS = {".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg"}


class BgmTrack(BaseModel):
    path: str
    filename: str
    size: int


class MixRequest(BaseModel):
    video_path: str
    bgm_path: str
    bgm_volume: float = Field(0.4, ge=0.0, le=2.0)
    fade_in: float = Field(1.0, ge=0.0, le=10.0)
    fade_out: float = Field(1.5, ge=0.0, le=10.0)


class JobResponse(BaseModel):
    job_id: str
    status: str


class UploadResponse(BaseModel):
    file_path: str
    filename: str
    size: int


class VideoUploadResponse(UploadResponse):
    duration: float


@router.get("/library", response_model=list[BgmTrack])
def list_library():
    """Scan the built-in BGM library directory (assets/bgm)."""
    if not BGM_LIBRARY.exists():
        return []
    tracks: list[BgmTrack] = []
    for p in sorted(BGM_LIBRARY.iterdir()):
        if p.is_file() and p.suffix.lower() in AUDIO_EXTS:
            tracks.append(BgmTrack(path=str(p), filename=p.name, size=p.stat().st_size))
    return tracks


@router.post("/upload", response_model=UploadResponse)
async def upload_bgm(file: UploadFile = File(...)):
    """Upload a custom BGM track into the library for reuse."""
    safe_name = file.filename or f"bgm-{uuid.uuid4().hex}.mp3"
    if Path(safe_name).suffix.lower() not in AUDIO_EXTS:
        raise HTTPException(status_code=400, detail="Only audio files allowed")
    dest = BGM_LIBRARY / f"{uuid.uuid4().hex[:8]}_{safe_name}"

    size = 0
    async with aiofiles.open(dest, "wb") as out:
        while True:
            chunk = await file.read(1 << 20)
            if not chunk:
                break
            await out.write(chunk)
            size += len(chunk)

    return UploadResponse(file_path=str(dest), filename=safe_name, size=size)


@router.post("/upload_video", response_model=VideoUploadResponse)
async def upload_video(file: UploadFile = File(...), session_id: str = Form("default")):
    safe_name = file.filename or f"vid-{uuid.uuid4().hex}.mp4"
    dest = BGM_UPLOADS / f"{uuid.uuid4().hex[:8]}_{safe_name}"
    size = 0
    async with aiofiles.open(dest, "wb") as out:
        while True:
            chunk = await file.read(1 << 20)
            if not chunk:
                break
            await out.write(chunk)
            size += len(chunk)
    duration = await ffmpeg_service._probe_duration(dest)
    return VideoUploadResponse(file_path=str(dest), filename=safe_name, size=size, duration=duration)


async def _run_mix_job(job_id: str, req: MixRequest) -> None:
    db = SessionLocal()
    try:
        update_job(db, job_id, status="running", progress=10)
        video = Path(req.video_path)
        bgm = Path(req.bgm_path)
        if not video.exists():
            raise FileNotFoundError(f"Video not found: {video}")
        if not bgm.exists():
            raise FileNotFoundError(f"BGM not found: {bgm}")

        update_job(db, job_id, progress=30)
        output_path = BGM_OUTPUTS / f"bgm-mix-{uuid.uuid4().hex}.mp4"

        await ffmpeg_service.mix_bgm(
            video, bgm, req.bgm_volume, req.fade_in, req.fade_out, output_path
        )

        duration = await ffmpeg_service._probe_duration(output_path)
        update_job(
            db,
            job_id,
            status="done",
            progress=100,
            result={
                "output_path": str(output_path),
                "duration": duration,
                "bgm_volume": req.bgm_volume,
                "fade_in": req.fade_in,
                "fade_out": req.fade_out,
            },
        )
    except Exception as e:  # noqa: BLE001
        update_job(db, job_id, status="failed", error=repr(e))
    finally:
        db.close()


@router.post("/mix", response_model=JobResponse)
async def mix(req: MixRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    job = create_job(db, kind="bgm", payload=req.model_dump())
    background_tasks.add_task(_run_mix_job, job.id, req)
    return JobResponse(job_id=job.id, status="queued")


@router.get("/{job_id}")
def read_job(job_id: str, db: Session = Depends(get_db)):
    job = get_job(db, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.kind != "bgm":
        raise HTTPException(status_code=400, detail="Wrong job kind")
    return job_to_dict(job)
