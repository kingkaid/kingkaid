"""Cloud proxy client — forwards Claude requests through the platform's
license-gated SSE endpoint.
"""
from typing import AsyncIterator

import httpx

from config import settings


class CloudProxyError(Exception):
    pass


async def validate_license(license_key: str, device_fingerprint: str) -> dict:
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.post(
            f"{settings.cloud_base_url}/license/validate",
            json={"license_key": license_key, "device_fingerprint": device_fingerprint},
        )
        if r.status_code != 200:
            raise CloudProxyError(f"validate failed: {r.status_code} {r.text}")
        return r.json()


async def activate_license(license_key: str, device_fingerprint: str) -> dict:
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.post(
            f"{settings.cloud_base_url}/license/activate",
            json={"license_key": license_key, "device_fingerprint": device_fingerprint},
        )
        if r.status_code != 200:
            raise CloudProxyError(f"activate failed: {r.status_code} {r.text}")
        return r.json()


async def stream_rewrite(
    transcript: str,
    style: str,
    emotion: str | None,
    license_key: str,
    device_fingerprint: str,
) -> AsyncIterator[str]:
    """Stream SSE chunks from the cloud /claude/rewrite endpoint."""
    payload = {
        "transcript": transcript,
        "style": style,
        "emotion": emotion,
        "license_key": license_key,
        "device_fingerprint": device_fingerprint,
    }
    async with httpx.AsyncClient(timeout=None) as client:
        async with client.stream(
            "POST",
            f"{settings.cloud_base_url}/claude/rewrite",
            json=payload,
        ) as r:
            if r.status_code != 200:
                body = await r.aread()
                raise CloudProxyError(f"rewrite failed: {r.status_code} {body.decode()}")
            async for line in r.aiter_lines():
                if line:
                    yield line


async def stream_title(
    transcript: str,
    count: int,
    license_key: str,
    device_fingerprint: str,
) -> AsyncIterator[str]:
    payload = {
        "transcript": transcript,
        "count": count,
        "license_key": license_key,
        "device_fingerprint": device_fingerprint,
    }
    async with httpx.AsyncClient(timeout=None) as client:
        async with client.stream(
            "POST",
            f"{settings.cloud_base_url}/claude/title",
            json=payload,
        ) as r:
            if r.status_code != 200:
                body = await r.aread()
                raise CloudProxyError(f"title failed: {r.status_code} {body.decode()}")
            async for line in r.aiter_lines():
                if line:
                    yield line
