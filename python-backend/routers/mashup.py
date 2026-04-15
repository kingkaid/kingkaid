"""Module 4 — Mashup video generation.

Directory layout (populated by the user via the Assets page or out-of-band):
    DATA_ROOT/assets/mashup_pool/
        产品/
        人物/
        门店展示/
        操作过程/
        服务过程/
        其他/

Routes:
    GET  /api/mashup/categories           — list categories + file counts
    POST /api/mashup/upload               — upload an asset into a category
    POST /api/mashup/build                — random-sample + concat Job
    GET  /api/mashup/{job_id}
"""
import random
import uuid
from pathlib import Path

import aiofiles
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from config import DATA_ROOT, OUTPUTS_DIR
from db.session import SessionLocal, get_db
from db.store import create_job, get_job, job_to_dict, update_job
from services import ffmpeg_service

router = APIRouter(prefix="/mashup", tags=["mashup"])

MASHUP_POOL = DATA_ROOT / "assets" / "mashup_pool"
MASHUP_OUTPUTS = OUTPUTS_DIR / "mashup"

# The six categories match the original KrLongAI.exe layout exactly
CATEGORIES = ["产品", "人物", "门店展示", "操作过程", "服务过程", "其他"]

VIDEO_EXTS = {".mp4", ".mov", ".mkv", ".avi", ".webm"}


def _ensure_category_dirs() -> None:
    for cat in CATEGORIES:
        (MASHUP_POOL / cat).mkdir(parents=True, exist_ok=True)
    MASHUP_OUTPUTS.mkdir(parents=True, exist_ok=True)


_ensure_category_dirs()


class Asset(BaseModel):
    path: str
    filename: str
    size: int


class CategoryInfo(BaseModel):
    name: str
    count: int
    files: list[Asset]


class BuildRequest(BaseModel):
    category: str
    count: int = Field(3, ge=1, le=20)
    seed: int | None = None


class UploadResponse(BaseModel):
    path: str
    category: str
    filename: str
    size: int


class JobResponse(BaseModel):
    job_id: str
    status: str


@router.get("/categories", response_model=list[CategoryInfo])
def list_categories():
    _ensure_category_dirs()
    result: list[CategoryInfo] = []
    for cat in CATEGORIES:
        cat_dir = MASHUP_POOL / cat
        files = [
            Asset(path=str(p), filename=p.name, size=p.stat().st_size)
            for p in sorted(cat_dir.iterdir())
            if p.is_file() and p.suffix.lower() in VIDEO_EXTS
        ]
        result.append(CategoryInfo(name=cat, count=len(files), files=files))
    return result


@router.post("/upload", response_model=UploadResponse)
async def upload_asset(
    file: UploadFile = File(...),
    category: str = Form(...),
):
    if category not in CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Unknown category: {category}")

    cat_dir = MASHUP_POOL / category
    cat_dir.mkdir(parents=True, exist_ok=True)

    safe_name = file.filename or f"asset-{uuid.uuid4().hex}.mp4"
    if Path(safe_name).suffix.lower() not in VIDEO_EXTS:
        raise HTTPException(status_code=400, detail="Only video files allowed")
    dest = cat_dir / f"{uuid.uuid4().hex[:8]}_{safe_name}"

    size = 0
    async with aiofiles.open(dest, "wb") as out:
        while True:
            chunk = await file.read(1 << 20)
            if not chunk:
                break
            await out.write(chunk)
            size += len(chunk)

    return UploadResponse(path=str(dest), category=category, filename=safe_name, size=size)


async def _run_build_job(job_id: str, category: str, count: int, seed: int | None) -> None:
    db = SessionLocal()
    try:
        update_job(db, job_id, status="running", progress=10)

        cat_dir = MASHUP_POOL / category
        pool = [p for p in sorted(cat_dir.iterdir()) if p.is_file() and p.suffix.lower() in VIDEO_EXTS]
        if len(pool) == 0:
            raise ValueError(f"Category '{category}' has no assets")

        rng = random.Random(seed)
        k = min(count, len(pool))
        chosen = rng.sample(pool, k)
        update_job(db, job_id, progress=30)

        # Normalize each clip via re-encoding so concat can stream-copy safely.
        # (Different sources often have different codecs / profiles.)
        normalized: list[Path] = []
        temp_dir = MASHUP_OUTPUTS / f"build-{uuid.uuid4().hex}"
        temp_dir.mkdir(parents=True, exist_ok=True)
        for i, src in enumerate(chosen):
            dst = temp_dir / f"norm_{i:03d}.mp4"
            await ffmpeg_service._run_ffmpeg([
                "-i", str(src),
                "-vf", "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2",
                "-r", "25",
                "-c:v", "libx264",
                "-preset", "ultrafast",
                "-pix_fmt", "yuv420p",
                "-c:a", "aac",
                "-ar", "44100",
                "-ac", "2",
                str(dst),
            ])
            normalized.append(dst)
            update_job(db, job_id, progress=30 + int(50 * (i + 1) / k))

        output_path = MASHUP_OUTPUTS / f"mashup-{uuid.uuid4().hex}.mp4"
        await ffmpeg_service.concat_videos(normalized, output_path)

        # Cleanup temp dir
        for p in normalized:
            p.unlink(missing_ok=True)
        temp_dir.rmdir()

        duration = await ffmpeg_service._probe_duration(output_path)
        update_job(
            db,
            job_id,
            status="done",
            progress=100,
            result={
                "output_path": str(output_path),
                "duration": duration,
                "category": category,
                "clips_used": [p.name for p in chosen],
                "clips_count": k,
            },
        )
    except Exception as e:  # noqa: BLE001
        update_job(db, job_id, status="failed", error=repr(e))
    finally:
        db.close()


@router.post("/build", response_model=JobResponse)
async def build(
    req: BuildRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    if req.category not in CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Unknown category: {req.category}")

    job = create_job(
        db,
        kind="mashup",
        payload={"category": req.category, "count": req.count, "seed": req.seed},
    )
    background_tasks.add_task(_run_build_job, job.id, req.category, req.count, req.seed)
    return JobResponse(job_id=job.id, status="queued")


@router.get("/{job_id}")
def read_job(job_id: str, db: Session = Depends(get_db)):
    job = get_job(db, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.kind != "mashup":
        raise HTTPException(status_code=400, detail="Wrong job kind")
    return job_to_dict(job)
