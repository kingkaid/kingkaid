"""Module 9 — Voice cloning and synthesis (reuses HeyGem TTS).

POST /api/voice/upload      — upload a reference audio sample
POST /api/voice/clone       — register a voice profile with HeyGem → voice_id
POST /api/voice/synthesize  — synthesize audio from text + voice_id
GET  /api/voice/profiles    — list saved voice profiles
"""
import json
import uuid
from pathlib import Path

import aiofiles
import httpx
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from config import DATA_ROOT, OUTPUTS_DIR, UPLOADS_DIR
from services import heygem_service

router = APIRouter(prefix="/voice", tags=["voice"])

VOICE_UPLOADS = UPLOADS_DIR / "voice_samples"
VOICE_OUTPUTS = OUTPUTS_DIR / "voice_synth"
VOICE_PROFILES_DIR = DATA_ROOT / "assets" / "voice_profiles"

for d in [VOICE_UPLOADS, VOICE_OUTPUTS, VOICE_PROFILES_DIR]:
    d.mkdir(parents=True, exist_ok=True)


class UploadResponse(BaseModel):
    file_path: str
    filename: str
    size: int


class CloneRequest(BaseModel):
    audio_path: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1, max_length=40)


class VoiceProfile(BaseModel):
    name: str
    voice_id: str
    source_path: str


class SynthesizeRequest(BaseModel):
    voice_id: str = Field(..., min_length=1)
    text: str = Field(..., min_length=1, max_length=3000)


class SynthesizeResponse(BaseModel):
    output_path: str
    voice_id: str
    text_length: int


def _profile_file(name: str) -> Path:
    safe = "".join(c for c in name if c.isalnum() or c in "-_")
    return VOICE_PROFILES_DIR / f"{safe}.json"


@router.post("/upload", response_model=UploadResponse)
async def upload_sample(file: UploadFile = File(...)):
    safe_name = file.filename or f"sample-{uuid.uuid4().hex}.wav"
    dest = VOICE_UPLOADS / f"{uuid.uuid4().hex[:8]}_{safe_name}"
    size = 0
    async with aiofiles.open(dest, "wb") as out:
        while True:
            chunk = await file.read(1 << 20)
            if not chunk:
                break
            await out.write(chunk)
            size += len(chunk)
    return UploadResponse(file_path=str(dest), filename=safe_name, size=size)


@router.post("/clone", response_model=VoiceProfile)
async def clone_voice(req: CloneRequest):
    src = Path(req.audio_path)
    if not src.exists():
        raise HTTPException(status_code=404, detail="Audio sample not found")

    try:
        voice_id = await heygem_service.register_voice(str(src))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"HeyGem clone failed: {e}") from e

    profile = VoiceProfile(name=req.name, voice_id=voice_id, source_path=str(src))
    _profile_file(req.name).write_text(profile.model_dump_json(), encoding="utf-8")
    return profile


@router.post("/synthesize", response_model=SynthesizeResponse)
async def synthesize(req: SynthesizeRequest):
    try:
        audio_url = await heygem_service.synthesize_audio(req.text, req.voice_id)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"HeyGem synthesize failed: {e}") from e

    # Download the audio to our outputs directory (if it's a URL) or copy if local
    output_path = VOICE_OUTPUTS / f"synth-{uuid.uuid4().hex}.mp3"
    try:
        if audio_url.startswith("http"):
            async with httpx.AsyncClient(timeout=60.0) as client:
                r = await client.get(audio_url)
                r.raise_for_status()
                output_path.write_bytes(r.content)
        else:
            # Local path returned from HeyGem
            src = Path(audio_url)
            if src.exists():
                output_path.write_bytes(src.read_bytes())
            else:
                raise HTTPException(status_code=502, detail="Synth returned invalid path")
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Download failed: {e}") from e

    return SynthesizeResponse(
        output_path=str(output_path),
        voice_id=req.voice_id,
        text_length=len(req.text),
    )


@router.get("/profiles", response_model=list[VoiceProfile])
def list_profiles():
    out: list[VoiceProfile] = []
    for p in sorted(VOICE_PROFILES_DIR.glob("*.json")):
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
            out.append(VoiceProfile(**data))
        except Exception:  # noqa: BLE001
            continue
    return out


@router.delete("/profiles/{name}")
def delete_profile(name: str):
    pf = _profile_file(name)
    if not pf.exists():
        raise HTTPException(status_code=404, detail="Profile not found")
    pf.unlink()
    return {"success": True}
