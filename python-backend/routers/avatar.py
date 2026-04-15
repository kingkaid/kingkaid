"""Module 2 — Digital human video generation via HeyGem.

POST /api/avatar/upload    — multipart upload of a reference video/image
POST /api/avatar/register  — submit reference to HeyGem, get voice_id
POST /api/avatar/generate  — create video Job (text + voice_id), poll HeyGem
GET  /api/avatar/{job_id}  — read job status
"""
import asyncio
import uuid
from pathlib import Path

import aiofiles
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from config import UPLOADS_DIR
from db.session import SessionLocal, get_db
from db.store import create_job, get_job, job_to_dict, update_job
from services import heygem_service

router = APIRouter(prefix="/avatar", tags=["avatar"])


class UploadResponse(BaseModel):
    file_path: str
    filename: str
    size: int


class RegisterRequest(BaseModel):
    video_path: str = Field(..., min_length=1)
    name: str | None = None


class RegisterResponse(BaseModel):
    voice_id: str


class GenerateRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    voice_id: str = Field(..., min_length=1)


class JobResponse(BaseModel):
    job_id: str
    status: str


@router.post("/upload", response_model=UploadResponse)
async def upload_reference(file: UploadFile = File(...), session_id: str = Form("default")):
    """Stream the uploaded file to the reference_videos directory."""
    ref_dir = UPLOADS_DIR / "reference_videos"
    ref_dir.mkdir(parents=True, exist_ok=True)

    safe_name = file.filename or f"upload-{uuid.uuid4().hex}.mp4"
    dest = ref_dir / f"{uuid.uuid4().hex}_{safe_name}"

    size = 0
    async with aiofiles.open(dest, "wb") as out:
        while True:
            chunk = await file.read(1 << 20)  # 1 MiB
            if not chunk:
                break
            await out.write(chunk)
            size += len(chunk)

    return UploadResponse(file_path=str(dest), filename=safe_name, size=size)


@router.post("/register", response_model=RegisterResponse)
async def register_voice(req: RegisterRequest):
    """Submit reference video to HeyGem and get a voice_id back."""
    path = Path(req.video_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Reference file not found")
    try:
        voice_id = await heygem_service.register_voice(str(path))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"HeyGem register failed: {e}") from e
    return RegisterResponse(voice_id=voice_id)


async def _run_avatar_job(job_id: str, text: str, voice_id: str) -> None:
    """Background task — drive HeyGem's three-step pipeline:
       1. /v1/invoke → synthesize audio
       2. /easy/submit → start video composition
       3. /easy/query → poll until done
    """
    db = SessionLocal()
    try:
        update_job(db, job_id, status="running", progress=5)

        # Step 1: synthesize audio from text via TTS
        audio_url = await heygem_service.synthesize_audio(text, voice_id)
        update_job(db, job_id, progress=25)

        # Step 2: submit video composition task
        task_code = await heygem_service.submit_video_task(audio_url, voice_id)
        update_job(db, job_id, progress=35)

        # Step 3: poll until done
        while True:
            info = await heygem_service.query_video_task(task_code)
            status = info.get("status", "pending")
            percent = int(info.get("percent", 0))
            # Map HeyGem percent (0..100) into remaining 35..95 range
            mapped = 35 + int(percent * 0.6)
            update_job(db, job_id, progress=min(mapped, 95))

            if status == "done":
                update_job(
                    db,
                    job_id,
                    status="done",
                    progress=100,
                    result={
                        "video_url": info.get("url"),
                        "audio_url": audio_url,
                        "voice_id": voice_id,
                        "task_code": task_code,
                    },
                )
                return
            if status == "failed":
                update_job(db, job_id, status="failed", error=info.get("error", "HeyGem task failed"))
                return
            await asyncio.sleep(2)
    except Exception as e:  # noqa: BLE001
        update_job(db, job_id, status="failed", error=repr(e))
    finally:
        db.close()


@router.post("/generate", response_model=JobResponse)
async def generate_video(
    req: GenerateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    job = create_job(
        db,
        kind="avatar",
        payload={"text": req.text, "voice_id": req.voice_id},
    )
    background_tasks.add_task(_run_avatar_job, job.id, req.text, req.voice_id)
    return JobResponse(job_id=job.id, status="queued")


@router.get("/{job_id}")
def read_job(job_id: str, db: Session = Depends(get_db)):
    job = get_job(db, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.kind != "avatar":
        raise HTTPException(status_code=400, detail="Wrong job kind")
    return job_to_dict(job)
