from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from service.db import Base, Entity


def test_audit_list_tracks_committed_results_without_exposing_full_evidence():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        audit = Entity(id="audit", tenant_id="local", kind="audit", data={
            "name": "device", "status": "queued", "normalization": {"lines": ["private evidence"]},
            "policy": {"version": "v1", "rules": [{"id": "SSH"}]}})
        db.add(audit)
        db.commit()
        assert audit.list_data == {"name": "device", "status": "queued", "policy": {"version": "v1"}}
        audit.data = {**audit.data, "status": "complete", "counts": {"pass": 1}}
        db.flush()
        assert audit.list_data["counts"] == {"pass": 1}
        db.rollback()
    with Session(engine) as db:
        saved = db.get(Entity, "audit")
        assert saved.data["status"] == saved.list_data["status"] == "queued"
        assert saved.data["normalization"]["lines"] == ["private evidence"]
