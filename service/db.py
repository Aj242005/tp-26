import hashlib
import os
import uuid
from contextlib import contextmanager
from datetime import UTC, datetime
from functools import lru_cache

from sqlalchemy import JSON, DateTime, Index, Integer, String, create_engine, text
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column

from service.config import settings


def now():
    return datetime.now(UTC)


def identifier():
    return str(uuid.uuid4())


def digest(value: str):
    return hashlib.sha256(value.encode()).hexdigest()


class Base(DeclarativeBase):
    pass


class Entity(Base):
    __tablename__ = "entities"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    tenant_id: Mapped[str] = mapped_column(String(36), index=True)
    kind: Mapped[str] = mapped_column(String(32))
    data: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)
    __table_args__ = (Index("ix_entity_tenant_kind_created", "tenant_id", "kind", "created_at"),)


class LoginState(Base):
    __tablename__ = "login_states"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    data: Mapped[dict] = mapped_column(JSON)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class LoginSession(Base):
    __tablename__ = "login_sessions"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(36))
    data: Mapped[dict] = mapped_column(JSON)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class Job(Base):
    __tablename__ = "jobs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    tenant_id: Mapped[str] = mapped_column(String(36), index=True)
    audit_id: Mapped[str] = mapped_column(String(36), index=True)
    state: Mapped[str] = mapped_column(String(24), default="queued")
    stage: Mapped[str] = mapped_column(String(24), default="audit")
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    fence: Mapped[int] = mapped_column(Integer, default=0)
    lease_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    available_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    error: Mapped[str | None] = mapped_column(String(300))
    __table_args__ = (Index("ix_jobs_claim", "state", "available_at", "created_at"),)


class Idempotency(Base):
    __tablename__ = "idempotency"
    tenant_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    key: Mapped[str] = mapped_column(String(128), primary_key=True)
    request_hash: Mapped[str] = mapped_column(String(64))
    audit_id: Mapped[str] = mapped_column(String(36))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Event(Base):
    __tablename__ = "events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    tenant_id: Mapped[str] = mapped_column(String(36), index=True)
    actor: Mapped[str] = mapped_column(String(200))
    action: Mapped[str] = mapped_column(String(100))
    target: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


@lru_cache
def engine():
    cfg = settings()
    url = cfg.worker_database_url if os.getenv("SERVICE_ROLE") == "worker" else cfg.database_url
    return create_engine(url or cfg.database_url, pool_pre_ping=True, pool_size=5, max_overflow=5)


@contextmanager
def transaction(tenant_id=None):
    with Session(engine(), expire_on_commit=False) as db, db.begin():
        if tenant_id and engine().dialect.name == "postgresql":
            db.execute(text("SELECT set_config('app.tenant_id', :tenant, true)"), {"tenant": tenant_id})
        yield db


def event(db, tenant, actor, action, target):
    db.add(Event(tenant_id=tenant, actor=actor, action=action, target=target))


def view(entity):
    return {"id": entity.id, "kind": entity.kind, "created_at": entity.created_at.isoformat(),
            "updated_at": entity.updated_at.isoformat(), **entity.data}
