"""MiniMax 代理路由 — 平台代付 MiniMax API，按许可证配额计费

流式 SSE 转发 MiniMax Messages API（Anthropic 兼容接口）至本地 Sidecar。
"""
from datetime import datetime
from typing import AsyncIterator

import anthropic
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from config import settings
from db.session import get_db
from db.models import License, Activation, Usage

router = APIRouter(prefix="/claude", tags=["claude"])


REWRITE_SYSTEM_PROMPT = """你是专业的短视频口播文案改写专家。将以下脚本改写，保留核心观点和信息，
改变表达方式和句式结构，使其更加自然流畅，适合口播。
若提供了原视频情绪标签（如"激动"/"平静"），需在改写中保持相应情感色彩。
改写时保持原文长度相近，不添加无关内容。"""


TITLE_SYSTEM_PROMPT = """你是抖音爆款标题专家。根据以下口播文案，生成 {count} 条标题，每条标题不超过 30 字，
附带 3-5 个相关话题标签（#格式）。标题要有吸引力、制造好奇心或情绪共鸣。
每条标题单独一行，格式为：`1. 标题内容 #标签1 #标签2 #标签3`"""


class RewriteRequest(BaseModel):
    transcript: str = Field(..., min_length=1)
    style: str = "自然流畅"
    emotion: str | None = None
    license_key: str
    device_fingerprint: str


class TitleRequest(BaseModel):
    transcript: str = Field(..., min_length=1)
    count: int = Field(default=10, ge=1, le=20)
    license_key: str
    device_fingerprint: str


def _check_license_and_quota(
    db: Session, license_key: str, device_fingerprint: str
) -> tuple[License, Usage]:
    """验证许可证 + 设备绑定 + 月度配额。失败直接抛 HTTPException。"""
    lic = db.query(License).filter(License.key == license_key).first()
    if lic is None or lic.status == "banned":
        raise HTTPException(status_code=401, detail="Invalid license")

    if lic.expires_at and lic.expires_at < datetime.utcnow():
        raise HTTPException(status_code=403, detail="License expired")

    activation = (
        db.query(Activation)
        .filter(
            Activation.license_key == license_key,
            Activation.device_fingerprint == device_fingerprint,
        )
        .first()
    )
    if activation is None:
        raise HTTPException(status_code=401, detail="Device not activated")

    year_month = datetime.utcnow().strftime("%Y-%m")
    usage = (
        db.query(Usage)
        .filter(Usage.license_key == license_key, Usage.year_month == year_month)
        .first()
    )
    if usage is None:
        usage = Usage(license_key=license_key, year_month=year_month, claude_calls=0)
        db.add(usage)
        db.commit()
        db.refresh(usage)

    if usage.claude_calls >= lic.monthly_limit:
        raise HTTPException(status_code=429, detail="Monthly quota exhausted")

    return lic, usage


async def _stream_claude(
    system_prompt: str,
    user_content: str,
    db: Session,
    usage: Usage,
) -> AsyncIterator[bytes]:
    """调用 MiniMax API（Anthropic 兼容接口）并以 SSE 格式转发到客户端。"""
    client = anthropic.AsyncAnthropic(
        api_key=settings.minimax_api_key,
        base_url=settings.minimax_base_url,
    )

    try:
        async with client.messages.stream(
            model=settings.minimax_model,
            max_tokens=2048,
            temperature=1.0,
            system=system_prompt,
            messages=[{"role": "user", "content": user_content}],
        ) as stream:
            async for text in stream.text_stream:
                safe = text.replace("\n", "\\n")
                yield f"data: {safe}\n\n".encode("utf-8")

        # Only increment usage on successful completion
        usage.claude_calls += 1
        db.commit()

        yield b"event: done\ndata: [DONE]\n\n"
    except anthropic.APIError as e:
        yield f"event: error\ndata: {str(e)}\n\n".encode("utf-8")


@router.post("/rewrite")
async def rewrite(req: RewriteRequest, db: Session = Depends(get_db)):
    _, usage = _check_license_and_quota(db, req.license_key, req.device_fingerprint)

    user_content = f"【风格】{req.style}\n"
    if req.emotion:
        user_content += f"【原情绪】{req.emotion}\n"
    user_content += f"\n【原文】\n{req.transcript}"

    return StreamingResponse(
        _stream_claude(REWRITE_SYSTEM_PROMPT, user_content, db, usage),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.post("/title")
async def generate_title(req: TitleRequest, db: Session = Depends(get_db)):
    _, usage = _check_license_and_quota(db, req.license_key, req.device_fingerprint)

    system = TITLE_SYSTEM_PROMPT.format(count=req.count)
    return StreamingResponse(
        _stream_claude(system, req.transcript, db, usage),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
