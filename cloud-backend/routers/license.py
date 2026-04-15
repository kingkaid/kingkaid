from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from db.session import get_db
from db.models import License, Activation, Usage
from utils.jwt_util import create_token

router = APIRouter(prefix="/license", tags=["license"])


class ActivateRequest(BaseModel):
    license_key: str = Field(..., min_length=10)
    device_fingerprint: str = Field(..., min_length=8)


class ActivateResponse(BaseModel):
    success: bool
    token: str
    remaining_calls: int


class ValidateRequest(BaseModel):
    license_key: str
    device_fingerprint: str


class ValidateResponse(BaseModel):
    valid: bool
    remaining_calls: int
    monthly_limit: int
    expires_at: datetime | None = None


def _get_usage(db: Session, license_key: str) -> Usage:
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
    return usage


@router.post("/activate", response_model=ActivateResponse)
def activate(req: ActivateRequest, db: Session = Depends(get_db)):
    lic = db.query(License).filter(License.key == req.license_key).first()
    if lic is None:
        raise HTTPException(status_code=404, detail="License key not found")

    if lic.status == "banned":
        raise HTTPException(status_code=403, detail="License has been banned")

    if lic.expires_at and lic.expires_at < datetime.utcnow():
        raise HTTPException(status_code=403, detail="License has expired")

    # Check if this device is already activated
    existing = (
        db.query(Activation)
        .filter(
            Activation.license_key == req.license_key,
            Activation.device_fingerprint == req.device_fingerprint,
        )
        .first()
    )

    if existing is None:
        # New device — enforce device limit
        current_device_count = (
            db.query(Activation).filter(Activation.license_key == req.license_key).count()
        )
        if current_device_count >= lic.max_devices:
            raise HTTPException(
                status_code=409,
                detail=f"License already bound to {lic.max_devices} device(s)",
            )
        activation = Activation(
            license_key=req.license_key,
            device_fingerprint=req.device_fingerprint,
            activated_at=datetime.utcnow(),
            last_seen=datetime.utcnow(),
        )
        db.add(activation)
        if lic.status == "inactive":
            lic.status = "active"
    else:
        existing.last_seen = datetime.utcnow()

    db.commit()

    usage = _get_usage(db, lic.key)
    remaining = max(0, lic.monthly_limit - usage.claude_calls)

    token = create_token(lic.key, req.device_fingerprint)
    return ActivateResponse(success=True, token=token, remaining_calls=remaining)


@router.post("/validate", response_model=ValidateResponse)
def validate(req: ValidateRequest, db: Session = Depends(get_db)):
    lic = db.query(License).filter(License.key == req.license_key).first()
    if lic is None or lic.status == "banned":
        return ValidateResponse(valid=False, remaining_calls=0, monthly_limit=0)

    if lic.expires_at and lic.expires_at < datetime.utcnow():
        return ValidateResponse(valid=False, remaining_calls=0, monthly_limit=lic.monthly_limit)

    activation = (
        db.query(Activation)
        .filter(
            Activation.license_key == req.license_key,
            Activation.device_fingerprint == req.device_fingerprint,
        )
        .first()
    )
    if activation is None:
        return ValidateResponse(valid=False, remaining_calls=0, monthly_limit=lic.monthly_limit)

    activation.last_seen = datetime.utcnow()
    db.commit()

    usage = _get_usage(db, lic.key)
    remaining = max(0, lic.monthly_limit - usage.claude_calls)
    return ValidateResponse(
        valid=True,
        remaining_calls=remaining,
        monthly_limit=lic.monthly_limit,
        expires_at=lic.expires_at,
    )
