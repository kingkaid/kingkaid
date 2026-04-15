"""Job CRUD helpers."""
import json
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from .models import Job


def create_job(db: Session, kind: str, payload: dict[str, Any] | None = None) -> Job:
    job = Job(
        id=str(uuid.uuid4()),
        kind=kind,
        status="queued",
        progress=0,
        payload=json.dumps(payload or {}, ensure_ascii=False),
        result="{}",
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def get_job(db: Session, job_id: str) -> Job | None:
    return db.query(Job).filter(Job.id == job_id).first()


def update_job(
    db: Session,
    job_id: str,
    *,
    status: str | None = None,
    progress: int | None = None,
    result: dict[str, Any] | None = None,
    error: str | None = None,
) -> Job | None:
    job = get_job(db, job_id)
    if job is None:
        return None
    if status is not None:
        job.status = status
    if progress is not None:
        job.progress = progress
    if result is not None:
        job.result = json.dumps(result, ensure_ascii=False)
    if error is not None:
        job.error = error
    job.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(job)
    return job


def job_to_dict(job: Job) -> dict[str, Any]:
    return {
        "job_id": job.id,
        "kind": job.kind,
        "status": job.status,
        "progress": job.progress,
        "payload": json.loads(job.payload or "{}"),
        "result": json.loads(job.result or "{}"),
        "error": job.error,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "updated_at": job.updated_at.isoformat() if job.updated_at else None,
    }
