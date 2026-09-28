import asyncio
import csv
import hashlib
import io
import json
import logging
import socket
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import urlsplit

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.responses import RedirectResponse, JSONResponse, Response
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Gauge, Histogram, generate_latest
from pydantic import BaseModel, Field
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from starlette.middleware.trustedhost import TrustedHostMiddleware

from service import auth, storage
from service.config import settings
from service.db import Entity, Event, Idempotency, Job, LoginSession, digest, event, identifier, now, transaction, view
from service.domain import MappingSpec, identify, redact, test_mapping
from service.limits import cache, limit
from service.policies import Policy, baseline
from service.telemetry import configure

LOG = logging.getLogger("sih")
REQUESTS = Counter("sih_requests_total", "HTTP requests", ["route", "status"])
LATENCY = Histogram("sih_request_seconds", "HTTP duration", ["route"])
JOBS = Gauge("sih_jobs", "Durable jobs across the local workspaces", ["state"])
QUEUE_AGE = Gauge("sih_queue_oldest_seconds", "Age of oldest waiting job")


@asynccontextmanager
async def lifespan(app):
    cfg = settings()
    if len(cfg.app_secret_key) < 32 or not cfg.data_encryption_key:
        raise RuntimeError("Run scripts/bootstrap.py to configure local secrets")
    storage.cipher()
    if cfg.llm_enabled and not cfg.ai_ready:
        raise RuntimeError("LLM_ENABLED requires GEMINI_API_KEY and GEMINI_MODEL")
    for attempt in range(30):
        try:
            if not any(item["Name"] == cfg.s3_bucket for item in storage.client().list_buckets()["Buckets"]):
                storage.client().create_bucket(Bucket=cfg.s3_bucket)
            break
        except Exception:
            if attempt == 29:
                raise RuntimeError("Local object storage did not become ready") from None
            await asyncio.sleep(2)
    yield


app = FastAPI(title="Prooflane Evidence Auditor", version="0.1.0", lifespan=lifespan,
              docs_url=None, redoc_url=None, openapi_url=None)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["localhost", "127.0.0.1", "api",
    urlsplit(settings().app_origin).hostname, *socket.gethostbyname_ex(socket.gethostname())[2]])
configure("api", app)


@app.middleware("http")
async def operational_boundary(request: Request, call_next):
    started = time.monotonic()
    request_id = str(uuid.uuid4())
    try:
        if request.method in ("POST", "PUT", "PATCH"):
            length = request.headers.get("content-length")
            maximum = 100 * 1024 * 1024 if request.url.path == "/api/devices" else 2 * 1024 * 1024
            if length and (not length.isdigit() or int(length) > maximum):
                raise HTTPException(413, "Request exceeds the permitted size")
        if request.url.path.startswith("/api/") and not request.url.path.startswith(("/api/health", "/api/auth", "/api/metrics")):
            user = await asyncio.to_thread(auth.current_user, request)
            rate, burst = (120, 30) if request.method == "GET" else (30, 10)
            await asyncio.to_thread(limit, f"user:{user['tenant_id']}:{user['subject']}:{request.method}", rate, burst,
                                    allow_read_fallback=request.method == "GET")
        response = await call_next(request)
    except HTTPException as exc:
        response = JSONResponse({"detail": exc.detail, "request_id": request_id}, exc.status_code, headers=exc.headers)
    except Exception as exc:
        LOG.error("request_failed type=%s request_id=%s", type(exc).__name__, request_id)
        response = JSONResponse({"detail": "The operation could not be completed. Retry or check service health",
                                 "request_id": request_id}, 503)
    response.headers["X-Request-ID"] = request_id
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    route = getattr(request.scope.get("route"), "path", "unmatched")
    REQUESTS.labels(route, str(response.status_code)).inc()
    LATENCY.labels(route).observe(time.monotonic() - started)
    return response


@app.exception_handler(RequestValidationError)
async def validation_error(request, exc):
    return JSONResponse({"detail": "Invalid input. Check the field types, lengths and required values",
                         "fields": [".".join(str(x) for x in error["loc"]) for error in exc.errors()]}, 422)


def get_entity(db, tenant, entity_id, kind, lock=False):
    query = select(Entity).where(Entity.id == entity_id, Entity.tenant_id == tenant, Entity.kind == kind)
    row = db.scalar(query.with_for_update() if lock else query)
    if row is None:
        raise HTTPException(404, "This record was not found in your workspace")
    if row.data.get("pending_delete") and not lock:
        raise HTTPException(410, "This record is pending permanent deletion")
    return row


def summary(row):
    data = view(row)
    if row.kind == "audit":
        for key in ("findings", "normalization", "mapping_snapshot", "agent_checkpoint", "investigation", "clarification_answers"):
            data.pop(key, None)
        if data.get("policy"):
            data["policy"] = {key: value for key, value in data["policy"].items() if key != "rules"}
    return data


def record_query(kind):
    data = Entity.list_data if kind == "audit" else Entity.data
    return select(Entity.id, Entity.kind, Entity.created_at, Entity.updated_at, data.label("data"))


@app.get("/api/health/live")
def live():
    return {"status": "alive"}


@app.get("/api/health/ready")
def ready():
    with transaction() as db:
        db.execute(text("SELECT 1"))
    cache().ping()
    storage.client().head_bucket(Bucket=settings().s3_bucket)
    return {"status": "ready"}


@app.get("/api/metrics")
def metrics():
    counts, oldest = {}, 0
    for tenant in (settings().default_tenant_id, "00000000-0000-0000-0000-000000000002"):
        with transaction(tenant) as db:
            for state, count in db.execute(select(Job.state, func.count()).where(Job.tenant_id == tenant).group_by(Job.state)):
                counts[state] = counts.get(state, 0) + count
            first = db.scalar(select(func.min(Job.created_at)).where(Job.tenant_id == tenant, Job.state.in_(("queued", "retry"))))
            if first:
                oldest = max(oldest, (now() - first).total_seconds())
    for state in ("queued", "running", "retry", "complete", "failed", "cancelled"):
        JOBS.labels(state).set(counts.get(state, 0))
    QUEUE_AGE.set(oldest)
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.get("/api/auth/providers")
def auth_providers():
    return {"providers": auth.providers()}


@app.get("/api/auth/account")
def identity_account():
    return RedirectResponse(settings().oidc_issuer_url + "/account/", status_code=302)


@app.get("/api/auth/login")
async def login(request: Request):
    await asyncio.to_thread(limit, "login:" + (request.headers.get("x-forwarded-for") or request.client.host), 10, 5)
    return await auth.login(request)


@app.get("/api/auth/callback")
async def callback(request: Request):
    return await auth.callback(request)


@app.post("/api/auth/logout")
def logout(request: Request):
    user = auth.require(request)
    with transaction(user["tenant_id"]) as db:
        row = db.get(LoginSession, user["session_id"])
        if row:
            db.delete(row)
        event(db, user["tenant_id"], user["subject"], "session.revoked", "workspace")
    response = JSONResponse({"ok": True})
    response.delete_cookie("sih_session", path="/")
    return response


@app.get("/api/me")
def me(request: Request):
    user = auth.require(request)
    cfg = settings()
    return {key: value for key, value in user.items() if key != "session_id"} | {
        "ai": {"enabled": cfg.llm_enabled, "configured": cfg.ai_ready,
               "model": cfg.gemini_model or None, "provider": "Vertex AI Express" if cfg.gemini_backend == "vertex_express" else "Gemini Developer API"},
        "workspace": ("Prooflane workspace" if cfg.app_env == "production" else "Local workspace") if user["tenant_id"] == cfg.default_tenant_id else "Separate workspace"}


@app.get("/api/schema")
def schema(request: Request):
    auth.require(request)
    return app.openapi()


@app.get("/api/overview")
def overview(request: Request):
    user = auth.require(request)
    tenant = user["tenant_id"]
    with transaction(tenant) as db:
        counts = dict(db.execute(select(Entity.kind, func.count()).where(Entity.tenant_id == tenant).group_by(Entity.kind)).all())
        jobs = dict(db.execute(select(Job.state, func.count()).where(Job.tenant_id == tenant).group_by(Job.state)).all())
        recent = db.execute(record_query("audit").where(Entity.tenant_id == tenant, Entity.kind == "audit")
                            .order_by(Entity.created_at.desc()).limit(8)).all()
        return {"counts": counts, "jobs": jobs, "recent": [summary(row) for row in recent]}


@app.get("/api/records")
def records(request: Request, kind: str = "audit", offset: int = 0, page_size: int = 30):
    user = auth.require(request)
    if kind not in {"audit", "device", "mapping", "source", "policy"} or offset < 0 or not 1 <= page_size <= 100:
        raise HTTPException(422, "Invalid record type or page")
    with transaction(user["tenant_id"]) as db:
        query = record_query(kind).where(Entity.tenant_id == user["tenant_id"], Entity.kind == kind)
        total = db.scalar(select(func.count()).select_from(Entity).where(
            Entity.tenant_id == user["tenant_id"], Entity.kind == kind))
        rows = db.execute(query.order_by(Entity.created_at.desc()).offset(offset).limit(page_size)).all()
        return {"items": [summary(row) for row in rows], "total": total, "offset": offset}


def save_device(user, filename, content, complete, vendor="", firmware="", synthetic=False):
    if not content or len(content) > 10 * 1024 * 1024 or b"\x00" in content:
        raise HTTPException(422, "Configuration must be nonempty text up to 10 MiB")
    try:
        body = content.decode("utf-8-sig")
    except UnicodeError as exc:
        raise HTTPException(422, "Save the configuration as UTF-8 text") from exc
    identity = identify(body)
    if vendor:
        identity["vendor"] = vendor[:60]
        identity["vendor_source"] = "user"
    if firmware:
        identity["firmware"] = firmware[:120]
    device_id = identifier()
    artifact = storage.put(user["tenant_id"], device_id + "/config", content)
    data = {"name": identity.get("hostname") or Path(filename).name[:150], "filename": Path(filename).name[:150],
            **identity, "artifact": artifact, "complete": complete, "synthetic": synthetic,
            "source": "Team-authored synthetic fixture" if synthetic else "User upload"}
    with transaction(user["tenant_id"]) as db:
        row = Entity(id=device_id, tenant_id=user["tenant_id"], kind="device", data=data)
        db.add(row)
        event(db, user["tenant_id"], user["subject"], "device.uploaded", device_id)
        db.flush()
        return view(row)


@app.post("/api/devices", status_code=201)
def upload(request: Request, files: list[UploadFile] = File(...), complete: bool = Form(False),
           vendor: str = Form(""), firmware: str = Form("")):
    user = auth.require(request, "auditor")
    limit("uploads:" + user["tenant_id"], 5, 2)
    if not 1 <= len(files) <= 100:
        raise HTTPException(422, "Upload between 1 and 100 configurations")
    prepared, total = [], 0
    for file in files:
        if Path(file.filename or "config").suffix.lower() not in (".txt", ".cfg", ".conf", ".config", ".json", ".xml", ""):
            raise HTTPException(422, "Supported uploads: text, CFG, CONF, JSON and XML")
        content = file.file.read(10 * 1024 * 1024 + 1)
        total += len(content)
        if len(content) > 10 * 1024 * 1024 or total > 100 * 1024 * 1024:
            raise HTTPException(413, "Upload exceeds file or batch size limit")
        if not content or b"\x00" in content:
            raise HTTPException(422, "Every configuration must be nonempty UTF-8 text")
        try:
            content.decode("utf-8-sig")
        except UnicodeError:
            raise HTTPException(422, "Save every configuration as UTF-8 text") from None
        prepared.append((file.filename or "configuration.txt", content))
    return {"items": [save_device(user, name, content, complete, vendor, firmware) for name, content in prepared]}


@app.post("/api/examples", status_code=201)
def examples(request: Request):
    user = auth.require(request, "auditor")
    limit("uploads:" + user["tenant_id"], 5, 2)
    return {"items": [save_device(user, path.name, path.read_bytes(), True, synthetic=True)
                       for path in sorted(Path("fixtures").glob("*.cfg"))]}


@app.get("/api/devices/{device_id}/configuration")
def configuration(device_id: str, request: Request, original: bool = False):
    user = auth.require(request, "auditor")
    with transaction(user["tenant_id"]) as db:
        device = get_entity(db, user["tenant_id"], device_id, "device")
        if not device.data.get("artifact") or device.data.get("pending_delete"):
            raise HTTPException(410, "The source snapshot has expired or been deleted under the retention policy")
        content = storage.get(user["tenant_id"], device.data["artifact"]).decode("utf-8-sig")
        event(db, user["tenant_id"], user["subject"], "configuration.original" if original else "configuration.redacted", device_id)
    return {"text": content if original else redact(content), "redacted": not original}


class AuditInput(BaseModel):
    device_id: str
    framework: str = "Baseline"
    policy_id: str | None = None


@app.get("/api/policies")
def policies(request: Request):
    auth.require(request)
    return {"items": [baseline(name).model_dump() for name in ("Baseline", "CIS", "NIST", "STIG", "ISO")]}


@app.post("/api/audits", status_code=202)
def create_audit(payload: AuditInput, request: Request):
    user = auth.require(request, "auditor")
    tenant = user["tenant_id"]
    limit("audit-create:" + tenant, settings().audit_jobs_per_minute, 10)
    key = request.headers.get("Idempotency-Key", "")
    if not 8 <= len(key) <= 128:
        raise HTTPException(422, "An Idempotency-Key header of 8–128 characters is required")
    if payload.framework not in ("Baseline", "CIS", "NIST", "STIG", "ISO"):
        raise HTTPException(422, "Unknown framework")
    request_hash = digest(payload.model_dump_json())
    try:
        with transaction(tenant) as db:
            db.execute(text("SELECT pg_advisory_xact_lock(hashtext(:tenant))"), {"tenant": tenant})
            previous = db.get(Idempotency, (tenant, key))
            if previous:
                if previous.request_hash != request_hash:
                    raise HTTPException(409, "This idempotency key belongs to a different request")
                return {"id": previous.audit_id, "replayed": True}
            device = get_entity(db, tenant, payload.device_id, "device", lock=True)
            if not device.data.get("artifact") or device.data.get("pending_delete"):
                raise HTTPException(410, "Upload a new snapshot; this source has expired or is being deleted")
            outstanding = db.scalar(select(func.count()).select_from(Job).where(Job.tenant_id == tenant,
                                    Job.state.in_(("queued", "running", "retry"))))
            if outstanding >= 200:
                raise HTTPException(429, "Workspace queue is full. Wait for existing audits to finish",
                                    headers={"Retry-After": "30"})
            policy = baseline(payload.framework)
            if payload.policy_id:
                saved = get_entity(db, tenant, payload.policy_id, "policy")
                if saved.data.get("status") != "approved":
                    raise HTTPException(409, "The selected policy has not been approved")
                policy = Policy.model_validate(saved.data["spec"])
            mapping_rows = db.scalars(select(Entity).where(Entity.tenant_id == tenant, Entity.kind == "mapping",
                Entity.data["status"].as_string() == "approved",
                Entity.data["spec"]["vendor"].as_string() == device.data["vendor"],
                Entity.data["spec"]["firmware"].as_string() == device.data.get("firmware", "unknown"))).all()
            mappings = [{"id": row.id, "version": row.data["version"],
                         "spec": {key: value for key, value in row.data["spec"].items() if key != "cases"}}
                        for row in mapping_rows]
            audit_id = identifier()
            data = {"name": device.data["name"], "device_id": device.id, "status": "queued",
                    "vendor": device.data["vendor"], "synthetic": device.data["synthetic"],
                    "policy": policy.model_dump(), "policy_id": payload.policy_id, "mapping_snapshot": mappings,
                    "input_sha256": device.data["artifact"]["sha256"], "progress": "Waiting for a worker"}
            db.add(Entity(id=audit_id, tenant_id=tenant, kind="audit", data=data))
            db.add(Job(tenant_id=tenant, audit_id=audit_id))
            db.add(Idempotency(tenant_id=tenant, key=key, request_hash=request_hash, audit_id=audit_id))
            event(db, tenant, user["subject"], "audit.created", audit_id)
            return {"id": audit_id}
    except IntegrityError:
        with transaction(tenant) as db:
            previous = db.get(Idempotency, (tenant, key))
            if previous and previous.request_hash == request_hash:
                return {"id": previous.audit_id, "replayed": True}
        raise HTTPException(409, "Concurrent request conflict. Retry with the same key") from None


@app.get("/api/audits/{audit_id}")
def audit_detail(audit_id: str, request: Request):
    user = auth.require(request)
    with transaction(user["tenant_id"]) as db:
        return view(get_entity(db, user["tenant_id"], audit_id, "audit"))


@app.post("/api/audits/{audit_id}/{action}")
def audit_action(audit_id: str, action: str, request: Request):
    user = auth.require(request, "auditor")
    if action not in ("retry", "cancel", "investigate"):
        raise HTTPException(404, "Unknown audit action")
    if action == "investigate" and not settings().ai_ready:
        raise HTTPException(409, "Configure GEMINI_API_KEY and GEMINI_MODEL, enable LLM_ENABLED, then restart the API and worker")
    with transaction(user["tenant_id"]) as db:
        audit = get_entity(db, user["tenant_id"], audit_id, "audit", lock=True)
        jobs = db.scalars(select(Job).where(Job.audit_id == audit_id, Job.tenant_id == user["tenant_id"]).with_for_update()).all()
        if action == "cancel":
            if not any(job.state in ("queued", "running", "retry") for job in jobs):
                raise HTTPException(409, "There is no active work to cancel")
            for job in jobs:
                if job.state in ("queued", "running", "retry"):
                    job.state, job.fence = "cancelled", job.fence + 1
            audit.data = {**audit.data, "status": "cancelled", "progress": "Cancelled by an auditor"}
        elif any(job.state in ("queued", "running", "retry") for job in jobs):
            raise HTTPException(409, "This audit already has active work")
        else:
            if action == "retry" and audit.data.get("status") not in ("failed", "cancelled"):
                raise HTTPException(409, "Only failed or cancelled work can be retried; create a new audit instead")
            stage = "learn" if action == "investigate" else (audit.data.get("failed_stage") or "audit")
            db.add(Job(tenant_id=user["tenant_id"], audit_id=audit_id, stage=stage))
            audit.data = {**audit.data, "status": "queued", "error": None, "progress": "Waiting for " + stage}
        event(db, user["tenant_id"], user["subject"], "audit." + action, audit_id)
    return {"ok": True}


@app.get("/api/audits/{audit_id}/export/{format}")
def export(audit_id: str, format: str, request: Request):
    user = auth.require(request)
    with transaction(user["tenant_id"]) as db:
        audit = get_entity(db, user["tenant_id"], audit_id, "audit")
        data = audit.data
        event(db, user["tenant_id"], user["subject"], "audit.export." + format, audit_id)
    if format == "pdf":
        if not data.get("report"):
            raise HTTPException(409, "The report is not ready yet")
        body, media = storage.get(user["tenant_id"], data["report"]), "application/pdf"
    elif format == "json":
        body, media = json.dumps({"id": audit_id, **data}, indent=2).encode(), "application/json"
    elif format == "csv":
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(["Control", "Title", "Verdict", "Severity", "Observed", "Source"])
        for finding in data.get("findings", []):
            cells = [finding[key] for key in ("id", "title", "verdict", "severity", "observed", "source")]
            writer.writerow(["'" + str(value) if str(value).lstrip().startswith(("=", "+", "-", "@")) else value for value in cells])
        body, media = buffer.getvalue().encode(), "text/csv"
    else:
        raise HTTPException(404, "Unknown export format")
    return Response(body, media_type=media, headers={"Content-Disposition": f'attachment; filename="audit-{audit_id}.{format}"'})


@app.post("/api/mappings", status_code=201)
def create_mapping(spec: MappingSpec, request: Request):
    user = auth.require(request, "auditor")
    spec = spec.model_copy(update={"cases": [case.model_copy(update={"text": redact(case.text)}) for case in spec.cases]})
    with transaction(user["tenant_id"]) as db:
        row = Entity(tenant_id=user["tenant_id"], kind="mapping", data={"name": spec.name, "spec": spec.model_dump(),
                     "status": "draft", "tests": test_mapping(spec), "version": digest(spec.model_dump_json())[:12]})
        db.add(row)
        db.flush()
        event(db, user["tenant_id"], user["subject"], "mapping.proposed", row.id)
        return view(row)


@app.post("/api/mappings/{mapping_id}/{action}")
def mapping_action(mapping_id: str, action: str, request: Request):
    user = auth.require(request, "auditor" if action == "test" else "reviewer")
    with transaction(user["tenant_id"]) as db:
        row = get_entity(db, user["tenant_id"], mapping_id, "mapping")
        spec = MappingSpec.model_validate(row.data["spec"])
        result = test_mapping(spec)
        if action == "activate":
            if not result["passed"]:
                raise HTTPException(409, "Approval requires at least three distinct passing cases, including a non-match")
            status = "approved"
        elif action == "retire":
            status = "retired"
        elif action == "test":
            status = row.data["status"]
        else:
            raise HTTPException(404, "Unknown mapping action")
        row.data = {**row.data, "status": status, "tests": result, "reviewed_by": user["subject"] if action != "test" else row.data.get("reviewed_by")}
        event(db, user["tenant_id"], user["subject"], "mapping." + action, mapping_id)
        return view(row)


class SourceInput(BaseModel):
    name: str = Field(min_length=3, max_length=150)
    authority: str = Field(min_length=2, max_length=150)
    url: str = Field(default="", max_length=1000)
    version: str = Field(min_length=1, max_length=100)
    permission: str = Field(min_length=3, max_length=500)
    content: str = Field(min_length=10, max_length=200000)


class ClarificationInput(BaseModel):
    answer: str = Field(min_length=3, max_length=4000)


@app.post("/api/clarifications/{audit_id}", status_code=202)
def clarification(audit_id: str, payload: ClarificationInput, request: Request):
    user = auth.require(request, "auditor")
    if not settings().ai_ready:
        raise HTTPException(409, "Configure and enable Gemini to resume investigation")
    with transaction(user["tenant_id"]) as db:
        audit = get_entity(db, user["tenant_id"], audit_id, "audit", lock=True)
        running = db.scalar(select(Job).where(Job.audit_id == audit_id, Job.state.in_(("queued", "running", "retry"))))
        if running:
            raise HTTPException(409, "An investigation is already active")
        answers = audit.data.get("clarification_answers", [])[-9:] + [redact(payload.answer)]
        audit.data = {**audit.data, "clarification_answers": answers, "status": "queued", "progress": "Clarification saved; investigation queued"}
        db.add(Job(tenant_id=user["tenant_id"], audit_id=audit_id, stage="learn"))
        event(db, user["tenant_id"], user["subject"], "clarification.answered", audit_id)
    return {"ok": True}


@app.post("/api/sources", status_code=201)
def source_add(payload: SourceInput, request: Request):
    user = auth.require(request, "reviewer")
    data = payload.model_dump()
    data["content"] = redact(data["content"])
    data.update(status="approved", sha256=hashlib.sha256(data["content"].encode()).hexdigest())
    with transaction(user["tenant_id"]) as db:
        row = Entity(tenant_id=user["tenant_id"], kind="source", data=data)
        db.add(row)
        db.flush()
        event(db, user["tenant_id"], user["subject"], "source.imported", row.id)
        return view(row)


@app.post("/api/policies", status_code=201)
def policy_add(spec: Policy, request: Request):
    user = auth.require(request, "reviewer")
    if len({rule.id for rule in spec.rules}) != len(spec.rules):
        raise HTTPException(422, "Control identifiers must be unique within a policy")
    with transaction(user["tenant_id"]) as db:
        row = Entity(tenant_id=user["tenant_id"], kind="policy", data={"name": spec.name,
                     "spec": spec.model_dump(), "status": "approved", "reviewed_by": user["subject"]})
        db.add(row)
        db.flush()
        event(db, user["tenant_id"], user["subject"], "policy.imported", row.id)
        return view(row)


@app.get("/api/events")
def events(request: Request):
    user = auth.require(request, "admin")
    with transaction(user["tenant_id"]) as db:
        rows = db.scalars(select(Event).where(Event.tenant_id == user["tenant_id"])
                           .order_by(Event.created_at.desc()).limit(100)).all()
        return {"items": [{"id": row.id, "actor": row.actor, "action": row.action,
                           "target": row.target, "at": row.created_at.isoformat()} for row in rows]}


class RetentionInput(BaseModel):
    raw_days: int = Field(default=30, ge=1, le=3650)
    report_days: int = Field(default=365, ge=1, le=3650)


@app.get("/api/settings")
def workspace_settings(request: Request):
    user = auth.require(request, "admin")
    with transaction(user["tenant_id"]) as db:
        row = db.get(Entity, user["tenant_id"])
        return row.data if row else {"raw_days": settings().retention_days, "report_days": 365}


@app.post("/api/settings")
def update_settings(payload: RetentionInput, request: Request):
    user = auth.require(request, "admin")
    with transaction(user["tenant_id"]) as db:
        row = db.get(Entity, user["tenant_id"], with_for_update=True)
        if row:
            row.data = payload.model_dump()
        else:
            db.add(Entity(id=user["tenant_id"], tenant_id=user["tenant_id"], kind="settings", data=payload.model_dump()))
        event(db, user["tenant_id"], user["subject"], "retention.updated", "workspace")
    return payload.model_dump()


@app.delete("/api/devices/{device_id}", status_code=202)
def delete_device(device_id: str, request: Request):
    user = auth.require(request, "admin")
    with transaction(user["tenant_id"]) as db:
        device = get_entity(db, user["tenant_id"], device_id, "device", lock=True)
        device.data = {**device.data, "pending_delete": True}
        audits = db.scalars(select(Entity).where(Entity.tenant_id == user["tenant_id"], Entity.kind == "audit").with_for_update()).all()
        for audit in audits:
            if audit.data.get("device_id") != device_id:
                continue
            for job in db.scalars(select(Job).where(Job.audit_id == audit.id).with_for_update()):
                if job.state in ("queued", "running", "retry"):
                    job.state, job.fence = "cancelled", job.fence + 1
            audit.data = {**audit.data, "status": "deleting", "pending_delete": True}
        event(db, user["tenant_id"], user["subject"], "device.deletion_requested", device_id)
    return {"ok": True, "status": "deleting"}
