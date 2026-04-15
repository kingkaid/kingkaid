"""Module 1 (part 2) — rewrite endpoint.

POST /api/rewrite (SSE)
    Input: { transcript, style, emotion?, license_key, device_fingerprint }
    Flow: Forward to cloud /claude/rewrite, stream SSE bytes back to caller.
"""
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from services import cloud_proxy_service

router = APIRouter(prefix="/rewrite", tags=["rewrite"])


class RewriteRequest(BaseModel):
    transcript: str = Field(..., min_length=1)
    style: str = "自然流畅"
    emotion: str | None = None
    license_key: str
    device_fingerprint: str


async def _relay(req: RewriteRequest):
    try:
        async for line in cloud_proxy_service.stream_rewrite(
            transcript=req.transcript,
            style=req.style,
            emotion=req.emotion,
            license_key=req.license_key,
            device_fingerprint=req.device_fingerprint,
        ):
            yield (line + "\n").encode("utf-8")
    except cloud_proxy_service.CloudProxyError as e:
        yield f"event: error\ndata: {str(e)}\n\n".encode("utf-8")


@router.post("")
async def rewrite(req: RewriteRequest):
    return StreamingResponse(
        _relay(req),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
