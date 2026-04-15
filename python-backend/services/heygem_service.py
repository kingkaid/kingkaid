"""HeyGem (Duix.Avatar) REST client — TTS + lip sync."""
import httpx

from config import settings


async def health_check() -> bool:
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            r = await client.get(f"{settings.heygem_tts_url}/health")
            return r.status_code == 200
    except httpx.HTTPError:
        return False


async def register_voice(video_path: str) -> str:
    """Upload a reference video/audio file; return voice_id."""
    async with httpx.AsyncClient(timeout=300.0) as client:
        with open(video_path, "rb") as f:
            files = {"file": (video_path, f, "video/mp4")}
            r = await client.post(
                f"{settings.heygem_tts_url}/v1/preprocess_and_tran",
                files=files,
            )
        r.raise_for_status()
        return r.json()["voice_id"]


async def synthesize_audio(text: str, voice_id: str) -> str:
    """Synthesize audio from text + voice_id; return URL to generated mp3."""
    async with httpx.AsyncClient(timeout=120.0) as client:
        r = await client.post(
            f"{settings.heygem_tts_url}/v1/invoke",
            json={"text": text, "voice_id": voice_id},
        )
        r.raise_for_status()
        return r.json()["audio_url"]


async def submit_video_task(audio_url: str, voice_id: str) -> str:
    """Submit a video synthesis task; return task_code for polling."""
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.post(
            f"{settings.heygem_video_url}/easy/submit",
            json={"audio_url": audio_url, "voice_id": voice_id},
        )
        r.raise_for_status()
        return r.json()["code"]


async def query_video_task(code: str) -> dict:
    """Poll for task status. Returns dict with status/percent/url."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.get(
            f"{settings.heygem_video_url}/easy/query",
            params={"code": code},
        )
        r.raise_for_status()
        return r.json()
