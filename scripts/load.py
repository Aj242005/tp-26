"""Bounded local qualification traffic; reports measured latency and every status."""
import argparse
import asyncio
import json
import platform
import statistics
import subprocess
import time
from collections import Counter
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]


async def main(seconds, rps, output, audits=False, resources_enabled=False):
    if not (1 <= seconds <= 7200 and 1 <= rps <= 100):
        raise ValueError("Use 1–7200 seconds and 1–100 requests/second for the local test")
    sessions = json.loads((ROOT / "runtime" / "qualification-sessions.json").read_text())
    started, latencies, statuses = time.monotonic(), [], Counter()
    routes = ["/api/overview", "/api/records?kind=audit&page_size=10", "/api/records?kind=device&page_size=10", "/api/policies"]
    hardware = subprocess.run(["docker", "info", "--format", "{{.NCPU}} CPUs / {{.MemTotal}} bytes Docker memory"], capture_output=True, text=True).stdout.strip()
    pending = set()
    snapshots = []
    resources = []
    audit_results = []
    container_ids = subprocess.run(["docker", "compose", "ps", "-q"], cwd=ROOT,
                                   capture_output=True, text=True, check=True).stdout.split()
    async def sample_resources():
        while True:
            try:
                sample = await asyncio.to_thread(subprocess.run,
                    ["docker", "stats", "--no-stream", "--format", "{{json .}}", *container_ids], capture_output=True, text=True, timeout=15)
                resources.append({"second": round(time.monotonic() - started),
                                  "containers": [json.loads(line) for line in sample.stdout.splitlines() if line.startswith("{")]})
            except subprocess.TimeoutExpired:
                resources.append({"second": round(time.monotonic() - started), "error": "Docker resource sampling timed out"})
            await asyncio.sleep(300)
    async with httpx.AsyncClient(base_url="http://127.0.0.1:8185", timeout=10, limits=httpx.Limits(max_connections=100)) as client:
        # Start the arrival clock only after hardware/Docker discovery and client initialization.
        started = time.monotonic()
        sampler = asyncio.create_task(sample_resources()) if resources_enabled else None
        async def submit_audits():
            for index in range((seconds + 59) // 60):
                await asyncio.sleep(max(0, started + index * 60 - time.monotonic()))
                user = sessions[index % 2]
                cookies = {"sih_session": user["cookie"]}
                began = time.monotonic()
                entry = {"minute": index, "accepted": False, "complete_with_pdf": False}
                try:
                    devices = await client.get("/api/records?kind=device&page_size=100", cookies=cookies)
                    devices.raise_for_status()
                    device = next(row for row in devices.json()["items"] if row.get("synthetic") and row.get("filename") == "qualification.cfg")
                    response = await client.post("/api/audits", json={"device_id": device["id"]}, cookies=cookies,
                                                 headers={"X-CSRF-Token": user["csrf"], "Idempotency-Key": f"{output}-{time.time_ns()}"})
                    entry["status"] = response.status_code
                    response.raise_for_status()
                    entry.update(id=response.json()["id"], accepted=True)
                    for _ in range(25):
                        await asyncio.sleep(2)
                        detail = await client.get("/api/audits/" + entry["id"], cookies=cookies)
                        detail.raise_for_status()
                        row = detail.json()
                        if row.get("status") == "complete" and row.get("report"):
                            entry["complete_with_pdf"] = True
                            break
                except (httpx.HTTPError, KeyError, StopIteration) as exc:
                    entry["error_type"] = type(exc).__name__
                entry["seconds"] = round(time.monotonic() - began, 2)
                audit_results.append(entry)
        audit_task = asyncio.create_task(submit_audits()) if audits else None
        async def request(index):
            user = sessions[index % len(sessions)]
            began = time.monotonic()
            try:
                response = await client.get(routes[index % len(routes)], cookies={"sih_session": user["cookie"]})
                statuses[str(response.status_code)] += 1
            except httpx.HTTPError:
                statuses["network_error"] += 1
            latencies.append((time.monotonic() - began) * 1000)
        for index in range(seconds * rps):
            scheduled = started + index / rps
            await asyncio.sleep(max(0, scheduled - time.monotonic()))
            if len(pending) >= 150:
                await asyncio.wait(pending, return_when=asyncio.FIRST_COMPLETED)
            task = asyncio.create_task(request(index))
            pending.add(task)
            task.add_done_callback(pending.discard)
            if index and index % (rps * 60) == 0:
                snapshots.append({"second": round(time.monotonic() - started), "requests": len(latencies), "statuses": dict(statuses)})
                (ROOT / "runtime" / (output + "-progress.json")).write_text(json.dumps(snapshots[-1]), encoding="utf-8")
        if pending:
            await asyncio.gather(*pending)
        if audit_task:
            await audit_task
    if sampler:
        sampler.cancel()
        await asyncio.gather(sampler, return_exceptions=True)
    latencies.sort()
    result = {"duration_seconds": round(time.monotonic() - started, 2), "scheduled_rps": rps, "requests": len(latencies),
              "statuses": dict(statuses), "p50_ms": round(statistics.median(latencies), 2),
              "p95_ms": round(latencies[int((len(latencies) - 1) * .95)], 2),
              "p99_ms": round(latencies[int((len(latencies) - 1) * .99)], 2), "host": platform.platform(),
              "docker": hardware, "identity": "100 synthetic authenticated sessions, two tenants; OIDC login tested separately",
              "transport": "IPv4 loopback through the same NGINX gateway; avoids Windows localhost IPv6 fallback",
              "resource_sampling": resources_enabled,
              "snapshots": snapshots, "resources": resources, "audits": audit_results}
    (ROOT / "runtime" / (output + ".json")).write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps({key: value for key, value in result.items() if key not in ("snapshots", "resources", "audits")}))
    if audits:
        print(json.dumps({"audits_accepted": sum(item["accepted"] for item in audit_results),
                          "audits_complete_with_pdf": sum(item["complete_with_pdf"] for item in audit_results)}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--seconds", type=int, default=60)
    parser.add_argument("--rps", type=int, default=50)
    parser.add_argument("--output", default="load-result")
    parser.add_argument("--audits", action="store_true", help="Submit one real synthetic audit per minute and verify its PDF stage")
    parser.add_argument("--resources", action="store_true", help="Sample only this project's containers every five minutes")
    args = parser.parse_args()
    asyncio.run(main(args.seconds, args.rps, args.output, args.audits, args.resources))
