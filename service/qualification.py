"""Local-only test fixtures. Invoked by an operator CLI, never exposed as an API route."""
import json
import secrets
import sys
from datetime import timedelta
from pathlib import Path

from sqlalchemy import delete, select, text

from service import storage
from service.config import settings
from service.db import Entity, Job, LoginSession, digest, identifier, now, transaction
from service.domain import identify
from service.policies import baseline


def main():
    if settings().app_env != "local":
        raise RuntimeError("Qualification fixture generation is restricted to APP_ENV=local")
    action = sys.argv[1]
    tenants = [settings().default_tenant_id, "00000000-0000-0000-0000-000000000002"]
    if action == "sessions":
        sessions = []
        with transaction() as db:
            for index in range(100):
                token, csrf = secrets.token_urlsafe(40), secrets.token_urlsafe(32)
                tenant = tenants[index % 2]
                db.add(LoginSession(id=digest(token), tenant_id=tenant, expires_at=now() + timedelta(hours=4), data={
                    "subject": "qualification-" + str(index), "name": "Qualification workload", "username": "qualification",
                    "roles": ["viewer", "auditor", "admin", "reviewer"], "csrf": csrf}))
                sessions.append({"cookie": token, "csrf": csrf, "tenant": tenant})
        print(json.dumps(sessions))
    elif action == "rls":
        entity_id = identifier()
        with transaction(tenants[0]) as db:
            db.add(Entity(id=entity_id, tenant_id=tenants[0], kind="probe", data={}))
        with transaction(tenants[1]) as db:
            assert db.get(Entity, entity_id) is None
        with transaction() as db:
            assert db.get(Entity, entity_id) is None
        with transaction(tenants[0]) as db:
            assert db.get(Entity, entity_id) is not None
            db.execute(delete(Entity).where(Entity.id == entity_id))
        denied = False
        try:
            with transaction(tenants[0]) as db:
                db.execute(text("UPDATE events SET action='forbidden' WHERE false"))
        except Exception:
            denied = True
        assert denied, "Application role must not update audit history"
        print(json.dumps({"rls_cross_tenant": True, "no_context_denied": True, "event_update_denied": True}))
    elif action == "seed":
        count = int(sys.argv[2]) if len(sys.argv) > 2 else 10
        padding = int(sys.argv[3]) if len(sys.argv) > 3 else 0
        source = Path("fixtures/ios-review.cfg").read_text()
        if padding:
            source += "\n" + "".join(f"interface Ethernet{index}\n description synthetic port {index}\n switchport access vlan 100\n!\n"
                                       for index in range(max(0, (padding - len(source)) // 100)))
        results = []
        for tenant in tenants:
            device_id = identifier()
            artifact = storage.put(tenant, device_id + "/config", source.encode())
            device = {"name": "Synthetic qualification device", "filename": "qualification.cfg", **identify(source),
                      "artifact": artifact, "complete": True, "synthetic": True, "source": "Synthetic qualification fixture"}
            with transaction(tenant) as db:
                db.add(Entity(id=device_id, tenant_id=tenant, kind="device", data=device))
                for _ in range(count):
                    audit_id = identifier()
                    db.add(Entity(id=audit_id, tenant_id=tenant, kind="audit", data={"name": device["name"], "device_id": device_id,
                        "status": "queued", "vendor": device["vendor"], "synthetic": True, "policy": baseline().model_dump(),
                        "mapping_snapshot": [], "input_sha256": artifact["sha256"], "progress": "Qualification audit queued"}))
                    db.add(Job(tenant_id=tenant, audit_id=audit_id))
                    results.append({"id": audit_id, "tenant": tenant, "device_id": device_id, "bytes": len(source.encode())})
        print(json.dumps(results))
    elif action == "states":
        result = []
        for tenant in tenants:
            with transaction(tenant) as db:
                result.extend({"id": row.id, "status": row.data.get("status"), "report": bool(row.data.get("report"))}
                              for row in db.scalars(select(Entity).where(Entity.kind == "audit")))
        print(json.dumps(result))
    elif action == "claim-state":
        with transaction() as db:
            print(json.dumps([{"id": job.id, "audit_id": job.audit_id, "fence": job.fence, "state": job.state,
                               "attempts": job.attempts, "lease": job.lease_until.isoformat() if job.lease_until else None}
                              for job in db.scalars(select(Job).where(Job.state == "running"))]))
    elif action == "cleanup-sessions":
        with transaction() as db:
            for row in db.scalars(select(LoginSession)):
                if row.data.get("username") == "qualification":
                    db.delete(row)
        print("Qualification sessions revoked")
    else:
        raise ValueError("Unknown qualification operation")


if __name__ == "__main__":
    main()
