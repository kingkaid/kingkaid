"""Module 5 — Picture-in-Picture overlay.

POST /api/pip/upload   — upload a main video or PIP clip
POST /api/pip/compose  — overlay PIP onto main at (x,y,w,h) during [start,end]
GET  /api/pip/{job_id}
"""
import uuid
from pathlib import Path

import aiofiles
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from config import OUTPUTS_DIR, UPLOADS_DIR
from db.session import SessionLocal, get_db
from db.store import create_job, get_job, job_to_dict, update_job
from services import ffmpeg_service

router = APIRouter(prefix="/pip", tags=["pip"])

PIP_UPLOADS = UPLOADS_DIR / "pip_sources"
PIP_OUTPUTS = OUTPUTS_DIR / "pip"
PIP_UPLOADS.mkdir(parents=True, exist_ok=True)
PIP_OUTPUTS.mkdir(parents=True, exist_ok=True)


class UploadResponse(BaseModel):
    file_path: str
    filename: str
    size: int
    duration: float


class ComposeRequest(BaseModel):
    main_path: str
    pip_path: str
    x: int = Field(..., ge=0)
    y: int = Field(..., ge=0)
    w: int = Field(..., gt=0)
    h: int = Field(..., gt=0)
    start: float = Field(..., ge=0)
    end: float = Field(..., gt=0)


class JobResponse(BaseModel):
    job_id: str
    status: str


@router.post("/upload", response_model=UploadResponse)
async def upload_source(file: UploadFile = File(...), role: str = Form("main")):
    """Upload a video for PIP. role: 'main' or 'pip'."""
    safe_name = file.filename or f"pip-{uuid.uuid4().hex}.mp4"
    dest = PIP_UPLOADS / f"{role}_{uuid.uuid4().hex[:8]}_{safe_name}"

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


async def _run_compose_job(job_id: str, req: ComposeRequest) -> None:
    db = SessionLocal()
    try:
        update_job(db, job_id, status="running", progress=10)
        main = Path(req.main_path)
        pip_clip = Path(req.pip_path)
        if not main.exists():
            raise FileNotFoundError(f"Main video not found: {main}")
        if not pip_clip.exists():
            raise FileNotFoundError(f"PIP video not found: {pip_clip}")

        if req.end <= req.start:
            raise ValueError("end must be greater than start")

        output_path = PIP_OUTPUTS / f"pip-{uuid.uuid4().hex}.mp4"
        update_job(db, job_id, progress=30)

        await ffmpeg_service.overlay_pip(
            main,
            pip_clip,
            req.x,
            req.y,
            req.w,
            req.h,
            req.start,
            req.end,
            output_path,
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
                "x": req.x,
                "y": req.y,
                "w": req.w,
                "h": req.h,
            },
        )
    except Exception as e:  # noqa: BLE001
        update_job(db, job_id, status="failed", error=repr(e))
    finally:
        db.close()


@router.post("/compose", response_model=JobResponse)
async def compose(
    req: ComposeRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    job = create_job(db, kind="pip", payload=req.model_dump())
    background_tasks.add_task(_run_compose_job, job.id, req)
    return JobResponse(job_id=job.id, status="queued")


@router.get("/{job_id}")
def read_job(job_id: str, db: Session = Depends(get_db)):
    job = get_job(db, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.kind != "pip":
        raise HTTPException(status_code=400, detail="Wrong job kind")
    return job_to_dict(job)
