"""Module 7 — Cover image generation.

GET  /api/cover/templates       — list 9 built-in templates with thumbnails
POST /api/cover/upload          — upload a background image
POST /api/cover/generate        — generate a cover PNG
"""
import uuid
from pathlib import Path

import aiofiles
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from config import OUTPUTS_DIR, UPLOADS_DIR
from services import cover_service

router = APIRouter(prefix="/cover", tags=["cover"])

COVER_UPLOADS = UPLOADS_DIR / "cover_backgrounds"
COVER_OUTPUTS = OUTPUTS_DIR / "covers"
COVER_UPLOADS.mkdir(parents=True, exist_ok=True)
COVER_OUTPUTS.mkdir(parents=True, exist_ok=True)


class GenerateRequest(BaseModel):
    template_id: int = Field(..., ge=1, le=9)
    title: str = Field(..., min_length=1, max_length=40)
    subtitle: str = Field("", max_length=30)
    background_path: str | None = None


class GenerateResponse(BaseModel):
    cover_path: str
    template_id: int
    size_bytes: int


@router.get("/templates")
def list_templates():
    return cover_service.list_templates()


@router.post("/upload")
async def upload_background(file: UploadFile = File(...), session_id: str = Form("default")):
    safe_name = file.filename or f"bg-{uuid.uuid4().hex}.jpg"
    dest = COVER_UPLOADS / f"{uuid.uuid4().hex[:8]}_{safe_name}"
    size = 0
    async with aiofiles.open(dest, "wb") as out:
        while True:
            chunk = await file.read(1 << 20)
            if not chunk:
                break
            await out.write(chunk)
            size += len(chunk)
    return {"file_path": str(dest), "filename": safe_name, "size": size}


@router.post("/generate", response_model=GenerateResponse)
def generate(req: GenerateRequest):
    output_path = COVER_OUTPUTS / f"cover-{uuid.uuid4().hex}.png"
    try:
        cover_service.generate_cover(
            template_id=req.template_id,
            title=req.title,
            subtitle=req.subtitle,
            background_path=req.background_path,
            output_path=output_path,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return GenerateResponse(
        cover_path=str(output_path),
        template_id=req.template_id,
        size_bytes=output_path.stat().st_size,
    )
