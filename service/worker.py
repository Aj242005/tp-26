import json
import logging
import random
import signal
import subprocess
import sys
import threading
from datetime import timedelta
from pathlib import Path

from sqlalchemy import and_, func, or_, select, text

from service import storage
from service.agent import AgentUnavailable, investigate
from service.config import settings
from service.db import Entity, Job, digest, event, identifier, now, transaction
from service.domain import MappingSpec, apply_mapping, test_mapping
from service.policies import Policy, evaluate
from service.report import pdf_report
from service.telemetry import configure

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
LOG = logging.getLogger("worker")
STOP = threading.Event()
TRACER = configure("worker")


def claim():
    eligible = or_(and_(Job.state.in_(("queued", "retry")), Job.available_at <= now()),
                   and_(Job.state == "running", Job.lease_until < now()))
    with transaction() as db:
        tenants = db.scalars(select(Job.tenant_id).where(eligible).group_by(Job.tenant_id)
                             .order_by(func.min(Job.created_at)).limit(100)).all()
        for tenant in tenants:
            locked = db.scalar(text("SELECT pg_try_advisory_xact_lock(hashtext(:tenant))"), {"tenant": tenant})
            if not locked:
                continue
            running = db.scalar(select(func.count()).select_from(Job).where(Job.tenant_id == tenant,
                                Job.state == "running", Job.lease_until > now()))
            if running >= 2:
                continue
            job = db.scalar(select(Job).where(eligible, Job.tenant_id == tenant).order_by(Job.created_at)
                             .with_for_update(skip_locked=True).limit(1))
            if job:
                job.state, job.fence, job.attempts = "running", job.fence + 1, job.attempts + 1
                job.lease_until = now() + timedelta(seconds=settings().job_lease_seconds)
                return {"id": job.id, "tenant": tenant, "audit_id": job.audit_id,
                        "fence": job.fence, "stage": job.stage, "attempt": job.attempts}
    return None


def heartbeat(work, done):
    while not done.wait(15):
        try:
            with transaction() as db:
                job = db.scalar(select(Job).where(Job.id == work["id"], Job.fence == work["fence"], Job.state == "running").with_for_update())
                if not job:
                    return
                job.lease_until = now() + timedelta(seconds=settings().job_lease_seconds)
            Path("/tmp/worker-heartbeat").touch()
        except Exception:
            LOG.warning("heartbeat_unavailable job=%s", work["id"])


def execute(work):
    tenant = work["tenant"]
    with transaction(tenant) as db:
        audit = db.get(Entity, work["audit_id"], with_for_update=True)
        if audit is None:
            raise ValueError("Audit does not exist")
        job = db.scalar(select(Job).where(Job.id == work["id"], Job.fence == work["fence"], Job.state == "running").with_for_update())
        if job is None:
            return
        device = db.get(Entity, audit.data["device_id"])
        if device is None:
            raise ValueError("Device does not exist")
        data, device_data = dict(audit.data), dict(device.data)
        audit.data = {**data, "status": "running", "error": None, "progress": {"learn": "Investigating with Gemini", "report": "Generating device report", "audit": "Normalizing configuration"}[work["stage"]]}
    content = "" if work["stage"] == "report" else storage.get(tenant, device_data["artifact"]).decode("utf-8-sig")
    proposals = []
    if work["stage"] == "report":
        result = {**data, "status": "complete", "error": None, "failed_stage": None,
                  "progress": "Audit and report are ready", "completed_at": now().isoformat()}
        report = pdf_report(work["audit_id"], result, device_data)
        result["report"] = storage.put(tenant, f"{work['audit_id']}/{work['id']}-{work['fence']}.pdf", report)
    elif work["stage"] == "learn":
        with transaction(tenant) as db:
            sources = [{"id": row.id, **row.data} for row in db.scalars(select(Entity).where(
                Entity.tenant_id == tenant, Entity.kind == "source").limit(100)).all()]
        def checkpoint(state):
            with transaction(tenant) as db:
                current = db.get(Entity, work["audit_id"], with_for_update=True)
                job = db.scalar(select(Job).where(Job.id == work["id"], Job.fence == work["fence"], Job.state == "running"))
                if current is None or job is None:
                    raise AgentUnavailable("Investigation cancelled or reclaimed", transient=False)
                current.data = {**current.data, "agent_checkpoint": state, "progress": "Investigation evidence saved; tool step " + str(len(state["trace"]))}
        open_controls = [{key: row[key] for key in ("id", "title", "fact", "expected", "severity")}
                         for row in data.get("findings", []) if row["verdict"] == "insufficient_evidence"]
        learned = investigate(tenant, content, device_data["vendor"], device_data.get("firmware", "unknown"),
                              sources, data.get("clarification_answers"), open_controls, checkpoint, data.get("agent_checkpoint"))
        proposals = learned.pop("drafts")
        result = {**data, "status": "waiting_review", "progress": "Review proposed mappings and clarification questions", "investigation": learned}
    else:
        payload = {"text": content, "vendor": device_data["vendor"], "complete": device_data.get("complete", False)}
        parsed = subprocess.run([sys.executable, "-m", "service.parse"], input=json.dumps(payload), text=True,
                                capture_output=True, timeout=25, check=True)
        normalized = json.loads(parsed.stdout)
        for mapping in data.get("mapping_snapshot", []):
            spec = MappingSpec.model_validate(mapping["spec"])
            if spec.vendor != device_data["vendor"] or spec.firmware != device_data.get("firmware", "unknown"):
                continue
            mapped = apply_mapping(spec, content)
            if mapped:
                mapped["origin"] = mapping["id"]
                previous = normalized["facts"].get(spec.fact)
                if previous and previous["value"] != mapped["value"]:
                    normalized["facts"][spec.fact] = {**mapped, "value": None, "reason": "Approved mappings disagree; review required"}
                else:
                    normalized["facts"][spec.fact] = mapped
        evaluated = evaluate(Policy.model_validate(data["policy"]), normalized["facts"], device_data["vendor"])
        result = {**data, **evaluated, "normalization": normalized, "status": "report_pending", "error": None,
                  "progress": "Evaluation saved; device report queued", "evaluated_at": now().isoformat()}
    with transaction(tenant) as db:
        audit = db.get(Entity, work["audit_id"], with_for_update=True)
        job = db.scalar(select(Job).where(Job.id == work["id"], Job.fence == work["fence"], Job.state == "running").with_for_update())
        if job is None or audit is None:
            LOG.info("discarded_stale_result job=%s", work["id"])
            return
        audit.data = result
        if work["stage"] == "audit":
            db.add(Job(tenant_id=tenant, audit_id=audit.id, stage="report"))
        for proposed in proposals:
            spec = MappingSpec.model_validate(proposed)
            db.add(Entity(id=identifier(), tenant_id=tenant, kind="mapping",
                          data={"name": spec.name, "spec": spec.model_dump(), "status": "draft",
                                "tests": test_mapping(spec), "version": digest(spec.model_dump_json())[:12],
                                "source_audit": audit.id, "label_status": "AI proposed; human validation required"}))
        job.state, job.lease_until, job.error = "complete", None, None
        event(db, tenant, "worker", "audit." + work["stage"] + ".completed", audit.id)


def failed(work, exc):
    with transaction(work["tenant"]) as db:
        audit = db.get(Entity, work["audit_id"], with_for_update=True)
        job = db.scalar(select(Job).where(Job.id == work["id"], Job.fence == work["fence"], Job.state == "running").with_for_update())
        if not job:
            return
        permanent = isinstance(exc, (ValueError, subprocess.CalledProcessError, subprocess.TimeoutExpired)) or isinstance(exc, AgentUnavailable) and not exc.transient
        job.state = "failed" if permanent or work["attempt"] >= 3 else "retry"
        job.lease_until = None
        job.available_at = now() + timedelta(seconds=min(60, 5 * 2 ** work["attempt"]) + random.random())
        job.error = "Operation did not complete: " + type(exc).__name__
        if audit:
            audit.data = {**audit.data, "status": job.state, "progress": job.error, "failed_stage": work["stage"],
                          "error": str(exc) if isinstance(exc, AgentUnavailable) else "Review configuration and service health, then retry. Original evidence is preserved."}
        LOG.warning("job_failed job=%s type=%s retry=%s", job.id, type(exc).__name__, job.state)


def main():
    for sig in (signal.SIGINT, signal.SIGTERM):
        signal.signal(sig, lambda *_: STOP.set())
    while not STOP.is_set():
        Path("/tmp/worker-heartbeat").touch()
        try:
            work = claim()
            if not work:
                STOP.wait(settings().worker_poll_seconds)
                continue
            done = threading.Event()
            thread = threading.Thread(target=heartbeat, args=(work, done), daemon=True)
            thread.start()
            try:
                with TRACER.start_as_current_span("job." + work["stage"], attributes={"job.id": work["id"], "job.attempt": work["attempt"]}):
                    execute(work)
            except Exception as exc:
                failed(work, exc)
            finally:
                done.set()
                thread.join(timeout=3)
        except Exception as exc:
            LOG.warning("worker_dependency_unavailable type=%s", type(exc).__name__)
            STOP.wait(3)


if __name__ == "__main__":
    main()
