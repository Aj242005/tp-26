"""Measure accepted deterministic audits through actual workers and PDF storage."""
import json
import subprocess
import time
from pathlib import Path

root = Path(__file__).resolve().parents[1]


def run(*args):
    completed = subprocess.run(["docker", "compose", "exec", "-T", "api", "python", "-m", "service.qualification", *args],
                               cwd=root, capture_output=True, check=True)
    return json.loads(completed.stdout)


started = time.monotonic()
seeded = run("seed", "25", "256000")
accepted_at = time.monotonic()
ids = {row["id"] for row in seeded}
while time.monotonic() - started < 300:
    rows = [row for row in run("states") if row["id"] in ids]
    if len(rows) == len(ids) and all(row["status"] == "complete" and row["report"] for row in rows):
        break
    time.sleep(2)
else:
    raise RuntimeError("Benchmark did not complete within five minutes")
elapsed = time.monotonic() - started
result = {"audits": len(ids), "complete_with_pdf": len(rows), "seconds_including_ingestion": round(elapsed, 2),
          "enqueue_seconds": round(accepted_at - started, 2), "configs_per_minute": round(len(ids) * 60 / elapsed, 2),
          "input_bytes": seeded[0]["bytes"], "controls": 20, "tenants": 2, "workers": 2, "ai_used": False,
          "corpus": "Team synthetic IOS fixture with distinct interface stanzas; same template, no accuracy claim"}
(root / "runtime" / "benchmark-result.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
print(json.dumps(result))
