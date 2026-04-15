from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class License(Base):
    __tablename__ = "licenses"

    key = Column(String, primary_key=True)
    status = Column(String, default="inactive")  # inactive / active / banned
    max_devices = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)  # NULL = perpetual (buyout)
    monthly_limit = Column(Integer, default=100)
    note = Column(String, default="")

    activations = relationship(
        "Activation", back_populates="license", cascade="all, delete-orphan"
    )


class Activation(Base):
    __tablename__ = "activations"

    license_key = Column(String, ForeignKey("licenses.key"), primary_key=True)
    device_fingerprint = Column(String, primary_key=True)
    activated_at = Column(DateTime, default=datetime.utcnow)
    last_seen = Column(DateTime, default=datetime.utcnow)

    license = relationship("License", back_populates="activations")


class Usage(Base):
    __tablename__ = "usage"

    license_key = Column(String, primary_key=True)
    year_month = Column(String, primary_key=True)  # "2026-04"
    claude_calls = Column(Integer, default=0)
