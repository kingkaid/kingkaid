"""Module 3 — Video editing: cut, merge, upload and probe.

POST /api/clip/upload  — upload a source video
POST /api/clip/cut     — cut [start, end] segments and concat them
POST /api/clip/merge   — merge multiple existing videos
POST /api/clip/probe   — get duration for a video
GET  /api/clip/{job_id}
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

router = APIRouter(prefix="/clip", tags=["clip"])

CLIP_UPLOADS = UPLOADS_DIR / "clip_sources"
CLIP_OUTPUTS = OUTPUTS_DIR / "clips"
CLIP_UPLOADS.mkdir(parents=True, exist_ok=True)
CLIP_OUTPUTS.mkdir(parents=True, exist_ok=True)


class UploadResponse(BaseModel):
    file_path: str
    filename: str
    size: int
    duration: float


class Segment(BaseModel):
    start: float = Field(..., ge=0)
    end: float = Field(..., gt=0)


class CutRequest(BaseModel):
    input_path: str
    segments: list[Segment] = Field(..., min_length=1)


class MergeRequest(BaseModel):
    paths: list[str] = Field(..., min_length=2)


class ProbeRequest(BaseModel):
    path: str


class JobResponse(BaseModel):
    job_id: str
    status: str


@router.post("/upload", response_model=UploadResponse)
async def upload_source(file: UploadFile = File(...), session_id: str = Form("default")):
    safe_name = file.filename or f"upload-{uuid.uuid4().hex}.mp4"
    dest = CLIP_UPLOADS / f"{uuid.uuid4().hex}_{safe_name}"

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


@router.post("/probe")
async def probe(req: ProbeRequest):
    path = Path(req.path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    duration = await ffmpeg_service._probe_duration(path)
    return {"path": str(path), "duration": duration}


async def _run_cut_job(job_id: str, input_path: str, segments: list[dict]) -> None:
    db = SessionLocal()
    try:
        update_job(db, job_id, status="running", progress=10)
        src = Path(input_path)
        if not src.exists():
            raise FileNotFoundError(f"Source not found: {src}")

        temp_dir = CLIP_OUTPUTS / f"cut-{uuid.uuid4().hex}"
        temp_dir.mkdir(parents=True, exist_ok=True)

        clip_paths: list[Path] = []
        total = len(segments)
        for i, seg in enumerate(segments):
            clip_path = temp_dir / f"part_{i:03d}.mp4"
            await ffmpeg_service.cut_segment(src, float(seg["start"]), float(seg["end"]), clip_path)
            clip_paths.append(clip_path)
            update_job(db, job_id, progress=10 + int(70 * (i + 1) / total))

        output_path = CLIP_OUTPUTS / f"output-{uuid.uuid4().hex}.mp4"
        if len(clip_paths) == 1:
            clip_paths[0].rename(output_path)
        else:
            await ffmpeg_service.concat_videos(clip_paths, output_path)

        # Cleanup temp parts
        for p in clip_paths:
            p.unlink(missing_ok=True)
        temp_dir.rmdir()

        final_duration = await ffmpeg_service._probe_duration(output_path)
        update_job(
            db,
            job_id,
            status="done",
            progress=100,
            result={
                "output_path": str(output_path),
                "duration": final_duration,
                "segments_count": total,
            },
        )
    except Exception as e:  # noqa: BLE001
        update_job(db, job_id, status="failed", error=repr(e))
    finally:
        db.close()


async def _run_merge_job(job_id: str, paths: list[str]) -> None:
    db = SessionLocal()
    try:
        update_job(db, job_id, status="running", progress=15)
        src_paths = [Path(p) for p in paths]
        for p in src_paths:
            if not p.exists():
                raise FileNotFoundError(f"Source not found: {p}")

        output_path = CLIP_OUTPUTS / f"merged-{uuid.uuid4().hex}.mp4"
        update_job(db, job_id, progress=40)
        await ffmpeg_service.concat_videos(src_paths, output_path)

        duration = await ffmpeg_service._probe_duration(output_path)
        update_job(
            db,
            job_id,
            status="done",
            progress=100,
            result={
                "output_path": str(output_path),
                "duration": duration,
                "input_count": len(paths),
            },
        )
    except Exception as e:  # noqa: BLE001
        update_job(db, job_id, status="failed", error=repr(e))
    finally:
        db.close()


@router.post("/cut", response_model=JobResponse)
async def cut(req: CutRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    segments_dicts = [seg.model_dump() for seg in req.segments]
    job = create_job(db, kind="clip", payload={"op": "cut", "input": req.input_path, "segments": segments_dicts})
    background_tasks.add_task(_run_cut_job, job.id, req.input_path, segments_dicts)
    return JobResponse(job_id=job.id, status="queued")


@router.post("/merge", response_model=JobResponse)
async def merge(req: MergeRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    job = create_job(db, kind="clip", payload={"op": "merge", "paths": req.paths})
    background_tasks.add_task(_run_merge_job, job.id, req.paths)
    return JobResponse(job_id=job.id, status="queued")


@router.get("/{job_id}")
def read_job(job_id: str, db: Session = Depends(get_db)):
    job = get_job(db, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.kind != "clip":
        raise HTTPException(status_code=400, detail="Wrong job kind")
    return job_to_dict(job)
