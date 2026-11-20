from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import ForeignKey, String, Integer, DateTime, Text, JSON, UniqueConstraint

from sqlalchemy.orm import Mapped, mapped_column, relationship
from .db import Base

def uid():
    return str(uuid4())

def utcnow():
    return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    email: Mapped[str] = mapped_column(String(250), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(100))
    role: Mapped[str] = mapped_column(String(20))
    password_hash: Mapped[str] = mapped_column(String(300))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

class HousingApplication(Base):
    __tablename__ = "housing_applications"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    applicant_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    full_name: Mapped[str] = mapped_column(String(100))
    monthly_income: Mapped[int] = mapped_column(Integer)
    household_members: Mapped[int] = mapped_column(Integer)
    province: Mapped[str] = mapped_column(String(60))
    notes: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(30), default="SUBMITTED")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

class AuditEvent(Base):
    __tablename__ = "audit_events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    application_id: Mapped[str] = mapped_column(String(36), ForeignKey("housing_applications.id"), index=True)
    actor_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(50))
    details: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class BlockchainOutbox(Base):
    """
    Tracks application proofs waiting to be
    registered or updated on Avalanche.
    """

    __tablename__ = "blockchain_outbox"

    __table_args__ = (
        UniqueConstraint(
            "application_id",
            "commitment",
            name="uq_blockchain_application_commitment",
        ),
    )

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=uid,
    )

    application_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("housing_applications.id"),
        index=True,
    )

    proof_application_id: Mapped[str] = mapped_column(
        String(66),
    )

    commitment: Mapped[str] = mapped_column(
        String(66),
    )

    operation: Mapped[str] = mapped_column(
        String(20),
    )

    state: Mapped[str] = mapped_column(
        String(20),
        default="PENDING",
    )

    transaction_hash: Mapped[str | None] = mapped_column(
        String(66),
        nullable=True,
    )

    attempts: Mapped[int] = mapped_column(
        Integer,
        default=0,
    )

    last_error: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
    )
