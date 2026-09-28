"""Local S3/provider outage qualification; restore each dependency in finally."""
import json
import subprocess
import time
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]


def compose(*args, content=None):
    call = subprocess.run(["docker", "compose", *args], cwd=ROOT, input=content, capture_output=True)
    if call.returncode:
        raise RuntimeError("Local outage-check operation failed: " + " ".join(args[:3]))
    return call.stdout


user = json.loads((ROOT / "runtime/qualification-sessions.json").read_text())[30]
headers = {"X-CSRF-Token": user["csrf"]}
result = {}
with httpx.Client(base_url="http://localhost:8185", cookies={"sih_session": user["cookie"]}, timeout=45) as client:
    audits = client.get("/api/records?kind=audit&page_size=100").json()["items"]
    audit = next(row for row in audits if row.get("status") == "complete" and row.get("report"))
    path = f"/api/audits/{audit['id']}/export/pdf"
    compose("stop", "object-store")
    try:
        result["storage_outage"] = {
            "metadata": client.get("/api/overview").status_code,
            "pdf": client.get(path).status_code,
            "upload": client.post("/api/devices", headers=headers, files={"files": ("outage.cfg", b"hostname synthetic-outage")}).status_code,
        }
        assert result["storage_outage"] == {"metadata": 200, "pdf": 503, "upload": 503}
    finally:
        compose("start", "object-store")
    for _ in range(30):
        if client.get("/api/health/ready").status_code == 200:
            break
        time.sleep(2)
    assert client.get(path).content.startswith(b"%PDF-")
    compose("stop", "gemini-egress")
    try:
        probe = b'''import json
from service.agent import investigate, AgentUnavailable
from service.config import settings
settings().llm_request_timeout_seconds=3
try:
    investigate(settings().default_tenant_id, "synthetic-probe 1", "unknown", "unknown", [])
except AgentUnavailable as exc:
    assert exc.transient
    print(json.dumps({"transient_failure": True}))
else:
    raise AssertionError("The stopped egress service must prevent inference")
'''
        result["provider_outage"] = json.loads(compose("exec", "-T", "worker", "python", "-", content=probe))
        result["provider_outage"]["completed_pdf"] = client.get(path).status_code
        created = client.post("/api/audits", headers={**headers, "Idempotency-Key": str(time.time_ns())}, json={"device_id": audit["device_id"]})
        assert created.status_code == 202
        for _ in range(30):
            row = client.get("/api/audits/" + created.json()["id"]).json()
            if row.get("status") == "complete" and row.get("report"):
                break
            time.sleep(2)
        assert row.get("status") == "complete" and row.get("report")
        result["provider_outage"]["deterministic_audit_completed"] = True
    finally:
        compose("start", "gemini-egress")
(ROOT / "runtime/outages-result.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
print(json.dumps(result))
