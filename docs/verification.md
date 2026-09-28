# Local verification record

Run date: 28 September 2026. Machine: Windows 11, Docker Desktop Linux engine with 12 logical CPUs and 8,136,110,080 bytes memory. This exceeds the plan's reference four-CPU budget; results do not establish performance on four CPUs.

## Functional and security evidence

| Check | Observed result | Evidence |
| --- | --- | --- |
| Python domain suite | 15 passing tests: syntax, conflicts, scope, unknown evidence, mappings, unsafe XML, redaction and PDF output | `uv run pytest -q` |
| Browser workflows | Both upload/audit/PDF and mapping/tenant/role workflows passed after the Keycloak 26.7.4 upgrade. The live Gemini case passed separately after a transient sign-in timeout in an earlier combined run. | `runtime/browser-workflows-final.json`, `runtime/browser-agent-final.json` |
| Configured model | `gemini-3.8-flash`, Vertex AI Express; actual function calls and persisted investigation through restricted egress | `runtime/provider-check.json`, browser agent test |
| Database isolation | Cross-tenant and missing-context reads denied; audit-event UPDATE denied under runtime role | `runtime/rls-result.json` |
| Policy and lifecycle | Imported rule executed, PDF generated, retention persisted; deletion revoked access immediately, then maintenance removed records | `runtime/lifecycle-result.json` |
| Shared limiter | 30 accepted and 25 rejected across two API replicas | `runtime/resilience-result.json` |
| Valkey outage | Authenticated read 200; mutation 503 | Same resilience record |
| API replica loss | Eight consecutive reads returned 200 | Same resilience record |
| Claimed worker loss | Two accepted jobs recovered and completed in 79.44 seconds after a claiming worker exited 137 | Same resilience record |
| Backup restoration | Clean separate project restored in 31.27 seconds; 24 records and 22 encrypted artifacts verified | `runtime/restore-result.json` |
| Restored identity | Both databases contained four users, 14 clients and 85 roles | `runtime/identity-restore-result.json` |
| Mid-evaluation worker loss | Both jobs/PDFs recovered in 66.42 seconds; a stale worker could not publish | `runtime/worker-recovery-result.json` |
| Storage/provider outages | Storage loss: metadata 200, unavailable PDF/upload 503. With Gemini blocked, completed PDF 200 and a new deterministic audit completed | `runtime/outages-result.json` |
| Observability | Both API scrape targets healthy, six dashboard panels, datasource OK, real request/job spans exported | `runtime/observability-result.json` |
| Migration rehearsal | Revision 002 applied to the isolated restored database; eight existing audits received list metadata | `runtime/migration-restore-result.json` |
| Local TLS | Real OIDC over HTTPS, Secure/HttpOnly session cookie and HTTP redirect verified | `runtime/tls-result.json` |

The second worker drill exits the process 100 ms after source decryption during actual evaluation, then verifies recovered output and rejection of the stale worker. An initial run with the 75-second default lease observed completion after 90.05 seconds, just above target. The configured local lease was reduced to 60 seconds with the same 15-second heartbeat; the repeat completed in 66.42 seconds. This exercises specific failure paths, not every possible interleaving. Restoration verifies identity records and artifact decryption/hashes; a new login against isolated restored identity was not exercised. Rehearsal containers are stopped; primary data is preserved.

## Capacity

Fifty synthetic IOS audits, including PDF generation/storage, completed in 25.94 seconds: **115.66 configurations/minute**, two tenants, two workers, 217,951 bytes per input and 20 controls. The operator CLI seeds the durable queue; this measures worker ingestion/processing, not browser upload throughput. No Gemini calls are included. See `runtime/benchmark-result.json`.

A preceding run during concurrent AI investigation and image scanning measured 32.14 configurations/minute (`runtime/benchmark-contended.json`). The two-worker profile shares capacity between investigation and deterministic processing. These are performance measurements on synthetic templates, not real-vendor accuracy measurements.

The first 50-request/second metadata run completed 3,000 requests without failures, but p95 was 3,969 ms and p99 was 5,359 ms. It exposed full audit payload deserialization in list queries. SQL projection removed configuration/findings/investigation detail before list results left PostgreSQL, but still spent too long processing large JSON records. A second run completed 3,000 requests in 92.23 seconds (p95 5,125 ms) after larger recovery fixtures were added. Migration 002 now backfills lightweight audit list metadata; an ORM persistence hook updates it atomically with every audit change. List queries read that small column and avoid reading evidence payloads. Both preliminary measurements are retained. The original result is retained in `runtime/load-before-projection.json`.

Final metadata, observability and one-hour stability measurements are recorded during release qualification in corresponding runtime result files. An absent or pending result is not a passed gate.

The clean final short metadata measurement completed **3,000 requests in 59.98 seconds**, all HTTP 200, at 50 requests/second. Observed p95 was **125 ms** and p99 **297 ms**, meeting the 500 ms/1 second targets. This run did not sample Docker resource counters concurrently; see `runtime/load-result.json`.

An initial long-run attempt overlapped demo recording and a large scanner database download. It recorded client timeouts and arrival lag and was deliberately stopped. Its progress is retained in `runtime/soak-contended-progress.json`; it is not presented as a passed soak. Final qualification uses a separate `soak-final` result without simultaneous builds, scans, recordings or failure injection.

The preliminary HTTP load results above are diagnostic runs, not valid constant-arrival 50-RPS baselines: the driver started its arrival clock before Docker discovery, causing an unintended startup burst, and Windows localhost resolution incurred IPv6 fallback delay. The final driver starts timing after setup and uses IPv4 loopback through the same gateway. No speedup factor is inferred from those confounded preliminary runs.

## Dependency evidence

Runtime Python and JavaScript dependency audits reported no known vulnerabilities. Ten images were scanned and received CycloneDX SBOMs. NGINX/web/Valkey scans were clean, but other images retain findings, including critical library occurrences in Keycloak and the PostgreSQL `gosu` helper. The core Keycloak account-takeover finding was removed by upgrading to 26.7.4. See the [dependency review](dependency-review.md) for exact counts, open issues, reachability assessments and reproduction. Those assessments are not a substitute for upstream fixes. External hosting is not qualified by this local release.

## Content and comparison limits

Five distributable fixtures and their mutations are team-authored synthetic material. Built-in content contains 20 technical checks with candidate framework crosswalks. There is no organizer dataset, independently labelled vendor corpus, full licensed CIS/STIG pack or ISO certification claim. See [coverage](coverage.md).

The browser test proves an unfamiliar-format mapping can change future evaluated coverage from 0% to 5%, then return to 0% on retirement while preserving prior results. It does not prove superiority over another auditor, universal vendor support or independent truth of AI-generated examples. Equal-budget direct-model comparisons, held-out real firmware evaluation, ablations and independent operational validation require suitable evidence and remain unclaimed.

## Reproduction

Start the scale profile before capacity/failure checks. Qualification sessions are operator-generated local fixtures, not a public authentication bypass. `service.qualification sessions` emits credentials; write its output directly to ignored `runtime/qualification-sessions.json`, never to a terminal or shared report. Real OIDC is tested separately.

Prepare the temporary traffic identities in PowerShell without printing them (valid for four hours):

```powershell
$qualificationJson = docker compose exec -T api python -m service.qualification sessions
if ($LASTEXITCODE -ne 0) { throw 'Qualification session creation failed' }
[IO.File]::WriteAllText("$PWD/runtime/qualification-sessions.json", ($qualificationJson -join "`n"))
```

Run the benchmark once before a soak with `--audits`; it supplies the explicitly synthetic `qualification.cfg` device for both tenants. Use a new `--output` prefix for each soak so server-side idempotency records can be reconciled unambiguously.

```powershell
uv run pytest -q
pnpm --dir web test:e2e
uv run python scripts/benchmark.py
uv run python scripts/load.py --seconds 60 --rps 50 --output load-result
uv run python scripts/load.py --seconds 3600 --rps 50 --audits --resources --output soak-final
uv run python scripts/resilience.py
uv run python scripts/check_lifecycle.py
```

Failure injection interrupts local services; run it separately from load measurements. Revoke synthetic sessions afterwards with `docker compose exec -T api python -m service.qualification cleanup-sessions`. Raw reports are ignored under `runtime`; publish only reviewed non-sensitive summaries.
