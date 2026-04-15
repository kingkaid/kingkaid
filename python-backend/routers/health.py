from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class HealthResponse(BaseModel):
    sidecar: str = "ok"
    sensevoice: str = "not-loaded"
    heygem: str = "down"
    license: dict = {"valid": False, "remaining_calls": 0}


@router.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse()
