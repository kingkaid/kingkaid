"""Module 10 — Viral title + hashtag generation (SSE via cloud Claude)."""
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from services import cloud_proxy_service

router = APIRouter(prefix="/title", tags=["title"])


class TitleRequest(BaseModel):
    transcript: str = Field(..., min_length=1)
    count: int = Field(default=10, ge=1, le=20)
    license_key: str
    device_fingerprint: str


async def _relay(req: TitleRequest):
    try:
        async for line in cloud_proxy_service.stream_title(
            transcript=req.transcript,
            count=req.count,
            license_key=req.license_key,
            device_fingerprint=req.device_fingerprint,
        ):
            yield (line + "\n").encode("utf-8")
    except cloud_proxy_service.CloudProxyError as e:
        yield f"event: error\ndata: {str(e)}\n\n".encode("utf-8")


@router.post("/generate")
async def generate(req: TitleRequest):
    return StreamingResponse(
        _relay(req),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
