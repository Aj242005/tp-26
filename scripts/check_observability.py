"""Verify local metrics, the provisioned dashboard and actual exported spans."""
import json
import time
from pathlib import Path

import httpx
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[1]
cfg = dotenv_values(ROOT / ".env")
result = {}
with httpx.Client(timeout=15) as client:
    for attempt in range(12):
        targets = client.get("http://localhost:9095/api/v1/targets").json()["data"]["activeTargets"]
        if len(targets) == 2 and all(target["health"] == "up" for target in targets):
            break
        time.sleep(5)
    assert len(targets) == 2 and all(target["health"] == "up" for target in targets), "Both API scrape targets must be healthy"
    result["healthy_api_targets"] = len(targets)
    dashboard = client.get("http://localhost:3005/api/dashboards/uid/prooflane", auth=("admin", cfg["LOCAL_ADMIN_PASSWORD"]))
    dashboard.raise_for_status()
    result["dashboard_panels"] = len(dashboard.json()["dashboard"]["panels"])
    datasource = client.get("http://localhost:3005/api/datasources/uid/local-prometheus/health", auth=("admin", cfg["LOCAL_ADMIN_PASSWORD"]))
    datasource.raise_for_status()
    result["grafana_datasource"] = datasource.json()["status"]
time.sleep(6)
trace_file = ROOT / "runtime" / "traces" / "traces.json"
spans = []
for line in trace_file.read_text(encoding="utf-8").splitlines():
    for resource in json.loads(line).get("resourceSpans", []):
        for scope in resource.get("scopeSpans", []):
            spans.extend(scope.get("spans", []))
assert spans, "Actual request spans must reach the collector"
result["exported_spans"] = len(spans)
result["passed"] = True
(ROOT / "runtime" / "observability-result.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
print(json.dumps(result))
