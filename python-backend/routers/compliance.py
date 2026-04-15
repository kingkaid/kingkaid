"""Module 11 — Violation word detection."""
from fastapi import APIRouter
from pydantic import BaseModel, Field

from services import compliance_service

router = APIRouter(prefix="/compliance", tags=["compliance"])


class CheckRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=10000)


class FlaggedWordDTO(BaseModel):
    word: str
    category: str
    start: int
    end: int


class CheckResponse(BaseModel):
    risk_level: str  # safe | warning | high
    flagged_words: list[FlaggedWordDTO]
    suggestion: str
    total_categories: list[str]


@router.post("/check", response_model=CheckResponse)
def check(req: CheckRequest):
    return compliance_service.check_text(req.text)
