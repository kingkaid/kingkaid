"""管理 API — 需要管理员 Token

列出许可证、查看用量、封禁/解封账号。
"""
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from config import settings
from db.session import get_db
from db.models import License, Activation, Usage

router = APIRouter(prefix="/admin", tags=["admin"])


def require_admin(x_admin_token: str = Header(...)) -> None:
    if x_admin_token != settings.admin_token:
        raise HTTPException(status_code=401, detail="Invalid admin token")


class LicenseInfo(BaseModel):
    key: str
    status: str
    max_devices: int
    monthly_limit: int
    active_devices: int
    calls_this_month: int
    note: str

    class Config:
        from_attributes = True


@router.get("/licenses", response_model=list[LicenseInfo], dependencies=[Depends(require_admin)])
def list_licenses(db: Session = Depends(get_db)):
    from datetime import datetime

    year_month = datetime.utcnow().strftime("%Y-%m")
    out: list[LicenseInfo] = []
    for lic in db.query(License).all():
        active_devices = (
            db.query(Activation).filter(Activation.license_key == lic.key).count()
        )
        usage = (
            db.query(Usage)
            .filter(Usage.license_key == lic.key, Usage.year_month == year_month)
            .first()
        )
        calls = usage.claude_calls if usage else 0
        out.append(
            LicenseInfo(
                key=lic.key,
                status=lic.status,
                max_devices=lic.max_devices,
                monthly_limit=lic.monthly_limit,
                active_devices=active_devices,
                calls_this_month=calls,
                note=lic.note or "",
            )
        )
    return out


@router.post("/licenses/{key}/ban", dependencies=[Depends(require_admin)])
def ban_license(key: str, db: Session = Depends(get_db)):
    lic = db.query(License).filter(License.key == key).first()
    if lic is None:
        raise HTTPException(status_code=404, detail="License not found")
    lic.status = "banned"
    db.commit()
    return {"success": True}


@router.post("/licenses/{key}/unban", dependencies=[Depends(require_admin)])
def unban_license(key: str, db: Session = Depends(get_db)):
    lic = db.query(License).filter(License.key == key).first()
    if lic is None:
        raise HTTPException(status_code=404, detail="License not found")
    lic.status = "active"
    db.commit()
    return {"success": True}
