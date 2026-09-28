"""Reconcile retention and orphaned objects. Safe to restart after partial deletion."""
import logging
import signal
import threading
from datetime import timedelta
from pathlib import Path

from sqlalchemy import delete, select

from service import storage
from service.config import settings
from service.db import Entity, Idempotency, Job, LoginSession, LoginState, event, now, transaction

STOP = threading.Event()
LOG = logging.getLogger("maintenance")


def sweep(tenant):
    with transaction(tenant) as db:
        saved = db.get(Entity, tenant)
        policy = saved.data if saved else {"raw_days": settings().retention_days, "report_days": 365}
        rows = db.scalars(select(Entity).where(Entity.tenant_id == tenant, Entity.kind.in_(("device", "audit")))
                          .order_by(Entity.id).with_for_update()).all()
        active = set(db.scalars(select(Job.audit_id).where(Job.tenant_id == tenant,
                                  Job.state.in_(("queued", "running", "retry")))).all())
        active_devices = {row.data.get("device_id") for row in rows if row.id in active}
        for row in rows:
            if row.id in active or row.id in active_devices:
                continue
            deleting = row.data.get("pending_delete", False)
            field = "artifact" if row.kind == "device" else "report"
            days = policy["raw_days" if row.kind == "device" else "report_days"]
            if not deleting and row.created_at > now() - timedelta(days=days):
                continue
            if row.data.get(field):
                storage.delete(tenant, row.data[field]["key"])
            if deleting:
                if row.kind == "audit":
                    db.execute(delete(Job).where(Job.tenant_id == tenant, Job.audit_id == row.id))
                    db.execute(delete(Idempotency).where(Idempotency.tenant_id == tenant, Idempotency.audit_id == row.id))
                db.delete(row)
                event(db, tenant, "maintenance", "record.deleted", row.id)
            elif row.data.get(field):
                row.data = {**row.data, field: None, field + "_expired_at": now().isoformat()}
                event(db, tenant, "maintenance", field + ".expired", row.id)
        db.flush()
        refs = {row.data[field]["key"] for row in db.scalars(select(Entity).where(Entity.tenant_id == tenant))
                for field in ("artifact", "report") if row.data.get(field)}
    # Uncommitted uploads/stale fenced reports receive a 24-hour grace period.
    paginator = storage.client().get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=settings().s3_bucket, Prefix=tenant + "/"):
        for item in page.get("Contents", []):
            if item["Key"] not in refs and item["LastModified"] < now() - timedelta(hours=24):
                storage.delete(tenant, item["Key"])


def run_once():
    for tenant in (settings().default_tenant_id, "00000000-0000-0000-0000-000000000002"):
        sweep(tenant)
    with transaction() as db:
        db.execute(delete(LoginState).where(LoginState.expires_at < now()))
        db.execute(delete(LoginSession).where(LoginSession.expires_at < now()))
    Path("/tmp/maintenance-heartbeat").touch()


def main():
    logging.basicConfig(level=logging.INFO)
    for sig in (signal.SIGTERM, signal.SIGINT):
        signal.signal(sig, lambda *_: STOP.set())
    while not STOP.is_set():
        try:
            run_once()
        except Exception as exc:
            LOG.warning("maintenance_retry type=%s", type(exc).__name__)
        STOP.wait(60)


if __name__ == "__main__":
    main()
