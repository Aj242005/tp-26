"""Local failure-injection checks. Each stopped service is restarted in a finally block."""
import json
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]


def docker(*args, content=None):
    result = subprocess.run(["docker", *args], cwd=ROOT, input=content, capture_output=True)
    if result.returncode:
        raise RuntimeError("Docker test operation failed: " + " ".join(args[:4]))
    return result.stdout


def compose(*args, content=None):
    return docker("compose", *args, content=content)


def states(ids):
    values = json.loads(compose("exec", "-T", "api", "python", "-m", "service.qualification", "states"))
    return {row["id"]: row for row in values if row["id"] in ids}


def main():
    users = json.loads((ROOT / "runtime" / "qualification-sessions.json").read_text())
    result = {}
    with httpx.Client(base_url="http://localhost:8185", timeout=12, cookies={"sih_session": users[0]["cookie"]}) as client:
        # More requests than the shared burst must be rejected even with two API replicas.
        burst_started = time.monotonic()
        with ThreadPoolExecutor(max_workers=12) as pool:
            statuses = list(pool.map(lambda _: client.get("/api/overview").status_code, range(55)))
        result["distributed_limit"] = {"accepted": statuses.count(200), "rejected": statuses.count(429), "other": [code for code in statuses if code not in (200, 429)]}
        assert 0 < statuses.count(200) <= 31 + (time.monotonic() - burst_started) * 2 and statuses.count(429) > 0 and not result["distributed_limit"]["other"]
        # A different workload identity avoids reusing an exhausted bucket.
        client.cookies.set("sih_session", users[2]["cookie"])
        compose("stop", "cache")
        try:
            result["cache_outage"] = {"read": client.get("/api/overview").status_code,
                "write": client.post("/api/examples", headers={"X-CSRF-Token": users[2]["csrf"]}).status_code}
            assert result["cache_outage"] == {"read": 200, "write": 503}
        finally:
            compose("start", "cache")
        apis = compose("ps", "-q", "api").decode().splitlines()
        assert len(apis) >= 2
        docker("stop", apis[0])
        try:
            time.sleep(6)
            client.cookies.set("sih_session", users[4]["cookie"])
            result["api_loss"] = [client.get("/api/overview").status_code for _ in range(8)]
            assert all(code == 200 for code in result["api_loss"])
        finally:
            docker("start", apis[0])
    # Claim work in a disposable worker process, then leave that process abruptly.
    # The durable lease is real and the regular workers must reclaim it.
    compose("stop", "worker")
    try:
        seeded = json.loads(compose("exec", "-T", "api", "python", "-m", "service.qualification", "seed", "1", "250000"))
        claim_code = b"import json, os\nfrom service.worker import claim\nprint(json.dumps(claim()),flush=True)\nos._exit(137)\n"
        command = ["docker", "compose", "run", "--rm", "--no-deps", "-T", "worker", "python", "-"]
        claimed_process = subprocess.run(command, cwd=ROOT, input=claim_code, capture_output=True)
        assert claimed_process.returncode == 137
        work = json.loads(claimed_process.stdout)
        assert work and work["fence"] == 1
        began = time.monotonic()
    finally:
        compose("start", "worker")
    ids = {row["id"] for row in seeded}
    while time.monotonic() - began < 110:
        current = states(ids)
        if len(current) == len(ids) and all(row["status"] == "complete" and row["report"] for row in current.values()):
            break
        time.sleep(3)
    else:
        raise AssertionError("Leased work was not recovered")
    result["worker_recovery"] = {"seconds": round(time.monotonic() - began, 2), "accepted": len(ids), "completed": len(current)}
    assert result["worker_recovery"]["seconds"] <= 90
    result["passed"] = True
    (ROOT / "runtime" / "resilience-result.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result))


if __name__ == "__main__":
    main()
