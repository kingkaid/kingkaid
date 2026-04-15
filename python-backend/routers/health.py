from fastapi import APIRouter
from pydantic import BaseModel

from services import heygem_service, sensevoice_service

router = APIRouter()


class LicenseStatus(BaseModel):
    valid: bool = False
    remaining_calls: int = 0


class HealthResponse(BaseModel):
    sidecar: str = "ok"
    sensevoice: str
    heygem: str
    license: LicenseStatus


@router.get("/health", response_model=HealthResponse)
async def health():
    heygem_running = await heygem_service.health_check()
    return HealthResponse(
        sidecar="ok",
        sensevoice=sensevoice_service.get_status(),
        heygem="running" if heygem_running else "down",
        license=LicenseStatus(),
    )
