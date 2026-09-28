"""Abruptly terminate real evaluation after source decryption; verify lease/fence recovery."""
import json
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def compose(*args, content=None, expected=0):
    result = subprocess.run(["docker", "compose", *args], cwd=ROOT, input=content, capture_output=True)
    assert result.returncode == expected, "Worker recovery command did not finish as expected"
    return result.stdout


compose("stop", "worker")
try:
    seeded = json.loads(compose("exec", "-T", "api", "python", "-m", "service.qualification", "seed", "1", "1500000"))
    probe = b'''import json, os, threading
from service import storage
from service.worker import claim, execute
original_get=storage.get
def interrupted_get(*args):
    content=original_get(*args)
    print(json.dumps({"source_decrypted": True}),flush=True)
    threading.Timer(0.1, lambda: os._exit(137)).start()
    return content
storage.get=interrupted_get
work=claim()
assert work
print(json.dumps(work),flush=True)
execute(work)
threading.Event().wait(1)
'''
    output = compose("run", "--rm", "--no-deps", "-T", "worker", "python", "-", content=probe, expected=137)
    rows = [json.loads(line) for line in output.decode().splitlines() if line.startswith("{")]
    work = rows[0]
    assert rows[1]["source_decrypted"]
    began = time.monotonic()
finally:
    compose("start", "worker")
ids = {row["id"] for row in seeded}
while time.monotonic() - began < 110:
    states = json.loads(compose("exec", "-T", "api", "python", "-m", "service.qualification", "states"))
    completed = [row for row in states if row["id"] in ids and row["status"] == "complete" and row["report"]]
    if len(completed) == len(ids):
        break
    time.sleep(3)
else:
    raise AssertionError("Interrupted evaluation did not recover")
seconds = round(time.monotonic() - began, 2)
stale = ('''import json
from service.db import Entity, transaction
from service.worker import execute
work=json.loads(%r)
with transaction(work["tenant"]) as db:
    before=db.get(Entity,work["audit_id"]).updated_at
execute(work)
with transaction(work["tenant"]) as db:
    assert before == db.get(Entity,work["audit_id"]).updated_at
print(json.dumps({"stale_worker_cannot_publish": True}))
''' % json.dumps(work)).encode()
fence = json.loads(compose("exec", "-T", "worker", "python", "-", content=stale))
result = {"accepted": len(ids), "completed_with_pdf": len(completed), "recovery_seconds": seconds,
          "fault": "Process exits 137 during real evaluation, 100 ms after encrypted input is read/decrypted", **fence}
(ROOT / "runtime/worker-recovery-result.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
print(json.dumps(result))
assert seconds <= 90, "The measured recovery exceeded the 90-second target"
