"""Exercise policy imports, artifact retention and deletion against the running local API."""
import json
import time
import uuid
from pathlib import Path

import httpx

root = Path(__file__).resolve().parents[1]
user = json.loads((root / "runtime/qualification-sessions.json").read_text())[20]
headers = {"X-CSRF-Token": user["csrf"]}
with httpx.Client(base_url="http://localhost:8185", cookies={"sih_session": user["cookie"]}, timeout=20) as client:
    uploaded = client.post("/api/devices", headers=headers, files={"files": ("lifecycle.cfg", b"version 17.12\nhostname lifecycle\nip ssh version 2\n")}, data={"complete": "true"})
    uploaded.raise_for_status()
    device = uploaded.json()["items"][0]
    policy = {"name": "Synthetic lifecycle policy", "framework": "Baseline", "version": "qualification-v1",
              "scope": "Single synthetic control used to test imported policy execution", "rules": [
                  {"id": "TEST-SSH", "title": "Synthetic SSH version requirement", "fact": "ssh_version", "expected": 2,
                   "source": "Team synthetic test label", "rationale": "Workflow qualification only"}]}
    imported = client.post("/api/policies", headers=headers, json=policy)
    imported.raise_for_status()
    result = client.post("/api/audits", headers={**headers, "Idempotency-Key": str(uuid.uuid4())},
                         json={"device_id": device["id"], "policy_id": imported.json()["id"]})
    result.raise_for_status()
    audit_id = result.json()["id"]
    for _ in range(30):
        audit = client.get("/api/audits/" + audit_id).json()
        if audit.get("status") == "complete":
            break
        time.sleep(2)
    assert audit["status"] == "complete" and audit["counts"]["pass"] == 1 and len(audit["findings"]) == 1
    assert client.get(f"/api/audits/{audit_id}/export/pdf").content.startswith(b"%PDF-")
    before = client.get("/api/settings").json()
    changed = client.post("/api/settings", headers=headers, json={"raw_days": 31, "report_days": 366})
    changed.raise_for_status()
    assert client.get("/api/settings").json()["raw_days"] == 31
    client.post("/api/settings", headers=headers, json={key: before[key] for key in ("raw_days", "report_days")}).raise_for_status()
    response = client.delete("/api/devices/" + device["id"], headers=headers)
    assert response.status_code == 202
    assert client.get(f"/api/audits/{audit_id}/export/pdf").status_code == 410
    for _ in range(40):
        if client.get("/api/audits/" + audit_id).status_code == 404:
            break
        time.sleep(2)
    else:
        raise AssertionError("Maintenance did not complete deletion")
result = {"imported_policy_executed": True, "pdf_verified": True, "retention_persisted": True,
          "deletion_revokes_access": True, "deletion_completed": True}
(root / "runtime/lifecycle-result.json").write_text(json.dumps(result, indent=2))
print(json.dumps(result))
