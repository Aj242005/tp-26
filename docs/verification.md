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

The final **one-hour soak passed**: 180,000 metadata reads in 3,600.02 seconds at 50 requests/second, all HTTP 200, no network errors, p50 16 ms, **p95 32 ms**, and **p99 47 ms**. A new synthetic audit was submitted each minute: all 60 were accepted and completed with PDF reports; the slowest client-observed audit completion was 4.44 seconds. The server's idempotency records matched all 60 client acceptance IDs, and every resulting PDF was subsequently downloaded successfully through authorization, decryption and integrity verification. See `runtime/soak-final.json` and `runtime/soak-final-reconciliation.json`.

All 11 running containers retained their start times, with zero restarts and no OOM events. Twelve five-minute resource samples included every container. No builds, scans, recordings or failure injection overlapped this run. The same Windows/Docker machine and 100 synthetic authenticated sessions across two tenants were used; OIDC and Gemini were verified separately. This measures local metadata reads and deterministic audit stability, not 50 simultaneous new sign-ins/second or Gemini throughput.

After reconciliation, all temporary qualification sessions were revoked (zero remained in the database). Explicitly labelled synthetic qualification records are retained for inspection. The main local application remains running; optional observability and isolated restore containers are stopped.

| Service | First sampled memory | Last sampled memory | Sampled peak |
| --- | ---: | ---: | ---: |
| API replica 1 | 114.90 MiB | 119.40 MiB | 119.60 MiB |
| API replica 2 | 112.10 MiB | 116.60 MiB | 129.40 MiB |
| Worker 1 | 153.00 MiB | 117.60 MiB | 153.00 MiB |
| Worker 2 | 111.90 MiB | 117.80 MiB | 117.80 MiB |
| PostgreSQL | 76.58 MiB | 79.94 MiB | 80.78 MiB |
| SeaweedFS | 188.00 MiB | 204.20 MiB | 204.20 MiB |
| Maintenance | 96.52 MiB | 103.60 MiB | 103.60 MiB |
| Keycloak | 564.40 MiB | 566.60 MiB | 567.40 MiB |

The two workers and object store were nearly flat in the second half. Maintenance increased by 7.08 MiB as the dataset grew; this bounded one-hour observation is not proof against slow leaks or substantially larger datasets. Resource samples are not continuous peaks. Full samples and summaries are retained in `runtime/soak-final-resources.json`, with container state snapshots in the corresponding `-containers-before/after.json` files.

The clean final short metadata measurement completed **3,000 requests in 59.98 seconds**, all HTTP 200, at 50 requests/second. Observed p95 was **125 ms** and p99 **297 ms**, meeting the 500 ms/1 second targets. This run did not sample Docker resource counters concurrently; see `runtime/load-result.json`.

An initial long-run attempt overlapped demo recording and a large scanner database download. It recorded client timeouts and arrival lag and was deliberately stopped. Its progress is retained in `runtime/soak-contended-progress.json`; it is not presented as a passed soak. Final qualification uses a separate `soak-final` result without simultaneous builds, scans, recordings or failure injection.

The preliminary HTTP load results above are diagnostic runs, not valid constant-arrival 50-RPS baselines: the driver started its arrival clock before Docker discovery, causing an unintended startup burst, and Windows localhost resolution incurred IPv6 fallback delay. The final driver starts timing after setup and uses IPv4 loopback through the same gateway. No speedup factor is inferred from those confounded preliminary runs.

## Dependency evidence

Runtime Python and JavaScript dependency audits reported no known vulnerabilities. Ten images were scanned and received CycloneDX SBOMs. NGINX/web/Valkey scans were clean, but other images retain findings, including critical library occurrences in Keycloak and the PostgreSQL `gosu` helper. The core Keycloak account-takeover finding was removed by upgrading to 26.7.4. See the [dependency review](dependency-review.md) for exact counts, open issues, reachability assessments and reproduction. Those assessments are not a substitute for upstream fixes. External hosting is not qualified by this local release.

Final lint and Compose validation passed. The publishable-source secret scan checked 108 files without finding known credential patterns; `.env` and runtime artifacts remain excluded. The architecture PDF was rendered and checked at two pages with no text outside page bounds. The presentation package has five slides, valid ZIP integrity and no shapes outside slide bounds; PowerPoint rendering itself was not automated. The recorded demo is 114 seconds with eight scenes and no recorded authentication. See `runtime/deliverables-final.json`.

## Content and comparison limits

Five distributable fixtures and their mutations are team-authored synthetic material. Built-in content contains 20 technical checks with candidate framework crosswalks. There is no independently supplied dataset, independently labelled vendor corpus, full licensed CIS/STIG pack or ISO certification claim. See [coverage](coverage.md).

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
## Evidence console interface revision â€” 28 September 2026

The premium technical UI replaces the original light-only register with a graphite evidence console and a persisted light theme. It adds grouped navigation, Ctrl/Cmd+K destination search, real-data coverage and queue context, an adjacent finding/value/source inspector, and distinguishable mapping versions. Existing API routes, role gates, review steps and synthetic labels are retained. Only the gateway image was replaced; no cloud services were deployed.

- TypeScript/Vite production build and Docker gateway build passed.
- The authenticated browser review covers all eight workspace views at 1600px and 390px, additional overview checks at 1280px and 320px, plus login, light-theme overview/evidence, command navigation, upload and mapping forms. Checks include zero page exceptions or document overflow, theme persistence, search filtering, arrow selection, Enter, Escape, focus restoration, and first-viewport source visibility on desktop. The overview's hidden table heading originally extended the mobile page; making the table scroller its positioning container corrected the overflow.
- Both existing workflow tests passed: real identity, encrypted upload, deterministic audits, mapping activation/retirement, tenant/role isolation, navigation and protected metrics. The live Gemini investigation test initially stopped at an identity-service sign-in rejection; an isolated rerun with the same configured credentials passed. No identity policy or provider configuration was changed.
- A single Impeccable detector pass reported only font-popularity warnings for Geist and Geist Mono. The selected operational typography was retained. The separate finish review requested earlier source visibility, a mobile assessment summary before the register, and mapping IDs/dates; all three were implemented.
- Local artifacts: `runtime/ui-after/` contains reviewed captures and `checks.json`; `runtime/ui-design-detector.json` contains the one detector report. Reproduce the UI pass with `cd web` then `node scripts/review-ui.mjs after`. It reads local credentials without printing them and does not submit configuration or mapping forms.

The earlier load and recovery measurements describe backend qualification; they were not repeated for this frontend revision. The design is documented in `DESIGN.md` and `.impeccable/surfaces/web-src-app-tsx.md`.

## Interactive 3D audit trail â€” 28 September 2026

The approved pipeline is implemented in the audit detail's **3D audit trail** tab. Seven selectable stages expose preserved hashes, pinned policy rules, captured mapping versions, facts and source lines, verdicts, PDF metadata, and saved Gemini tool responses. Orbit, zoom/reset, guided replay, stage stepping, keyboard selection and a flat equivalent are available. The existing deterministic report remains visible after an investigation failure. The review gate never presents agent output as approved.

- The final TypeScript/Vite and Docker gateway builds passed. The gateway is running and healthy locally on port 8185.
- `node scripts/check-trail-model.mts` passed the queued, completed-with-gaps, failed/retried investigation, human-review and ambiguous-cancellation checks.
- `node scripts/review-trail.mjs` passed against the final Docker gateway through real OIDC. It checked rendering, orbit/reset, replay/pause, keyboard selection, finding/source navigation, stored tool responses, light/dark themes, 1600px/1280px/390px layouts, non-overlapping mobile markers, and mobile inspector focus. Browser-only queued/failure fixtures caused no database or provider mutations.
- Forced WebGL context loss switched to the complete flat stage list; selecting stages still worked, and retry created one new canvas. A browser with WebGL deliberately unavailable also fell back successfully. Reduced-motion mode was exercised. Instrumented WebGL draw calls stayed unchanged during the idle check. There were no page exceptions or CSP violations.
- Visual iteration corrected overlapping mobile labels with a portrait camera and numbered markers, stacked the inspector earlier on laptops, and fixed a clipped source-count label in tool responses. Final desktop, laptop, mobile, light-theme, investigation, queued, failure and fallback screenshots were reviewed.
- Both existing Playwright workflow tests passed again (2/2, 51.4 seconds), covering real identity, encrypted upload, deterministic audits, mapping activation/retirement, tenant/role isolation and navigation. No live Gemini request was needed for this visual revision.
- The single Impeccable detector pass reported four instances of the existing Geist Mono font-popularity warning and no other findings. The established technical-data typography was retained.

The renderer is loaded separately when 3D is requested: 591.37 kB minified / 151.63 kB gzip. The trail UI is 22.93 kB / 7.03 kB gzip, with 14.08 kB / 3.13 kB gzip CSS. Vite's 500 kB renderer-chunk warning remains visible; this is an intentional lazy-loaded graphics dependency. No remote geometry or textures are fetched. Render resolution is capped and GPU resources are disposed when the view closes.

Qualification limits: Chromium software WebGL and responsive viewport emulation were used on this host; physical phone/Chromebook frame rates were not measured. The trail reconstructs stored artifact dependencies, not a full per-attempt event history or measured execution timeline. Earlier backend soak/recovery results were not repeated. No cloud deployment or provider configuration change occurred.

Reproduce from `web` with `node scripts/check-trail-model.mts`, `node scripts/review-trail.mjs`, and `pnpm exec playwright test tests/workflow.spec.ts`. The read-only visual review needs an existing synthetic IOS audit and uses local credentials without printing them. Local screenshots, checks and the detector report are in ignored `runtime/audit-trail/`.

## Rich interface and micro-interactions â€” 28 September 2026

The user asked for a more distinctive and enjoyable interface throughout the application and explicitly asked us to use our judgment. This pass amplifies the existing Evidence Console with an inset collapsible navigation dock, animated destination marker, an interactive overview control spectrum, pinned finding previews and direct links to a specific finding or 3D trail. The shared interface adds press/selection feedback, native layout/theme transitions, motion preferences, copy confirmation, drag/drop feedback and removable file chips. No animation library or backend endpoint was added. Sixty-nine obsolete overview CSS rules were removed.

- The final TypeScript/Vite and Docker gateway build passed; the updated gateway is running locally on port 8185.
- The authenticated review passed all eight workspace views at 1600px and 390px, plus overview checks at 1280px and 320px. There was no document overflow, page exception or CSP violation. Reviewed captures include the workbench, light theme, narrow-screen layout, focus mode, training, evidence, command search and upload form.
- Interaction checks cover hover preview and pinning, exact finding deep links, switching audits, opening 3D directly, clipboard content/confirmation, focus-mode persistence, in-app and OS reduced motion, theme persistence, search filtering/arrows/Enter/Escape/focus restoration, file removal, and drag/drop selection without submission. The final visual review paces GET requests at 550ms intervals to stay within the real 120/minute user quota.
- Both existing Playwright workflow tests passed in the sequential final run (2/2, 30.1 seconds): real identity, encrypted upload, deterministic audits, mapping activation/retirement, tenant/role isolation, navigation and protected metrics.
- The final 3D regression review also passed: orbit/reset, replay/keyboard controls, finding/source drill-down, saved tool responses, mobile markers, reduced motion, idle rendering, context loss/recreation, unavailable WebGL, and queued/failed fixtures. It reported no page errors or CSP violations. The updated finding-tab assertion waits for router navigation to complete. The fully loaded light-theme workbench capture is `runtime/audit-trail/overview-light.png`.
- Earlier unpaced/concurrent attempts encountered the per-user request limit, and one sign-in was temporarily blocked by Keycloak's brute-force protection. Screenshots showed the application error state and logs recorded `user_temporarily_disabled`. Limits and identity settings were preserved. Pacing the read-only review and running the workflow suite sequentially completed the checks.
- The single Impeccable detector pass reported six existing Geist font-popularity warnings and two layout-animation warnings. The two layout transitions were corrected: the navigation marker no longer animates width, and the control marker uses transform scaling instead of height. The established typefaces were retained; no second detector was run.

The final main JavaScript is 377.50 kB minified / 115.90 kB gzip, with 62.41 kB / 12.47 kB gzip shared CSS. The 3D renderer stays lazy-loaded at 591.92 kB / 151.84 kB gzip, with the existing Vite chunk-size warning. Its new 220ms selection lift is bounded and respects reduced motion; no ambient render loop was introduced. Physical-device frame rates were not measured, and the earlier backend load/recovery qualification was not repeated for this UI change.

Reproduce with `cd web`, `node scripts/review-ui.mjs rich-final`, and `pnpm exec playwright test tests/workflow.spec.ts`. Run them sequentially using the shared local demo account. Current captures/checks are in ignored `runtime/ui-rich-final/`, the single detector report is `runtime/rich-ui-detector.json`, and the build log is `runtime/rich-build-final.log`.
# Prooflane branding, sign-in and HTTPS revision

The product now uses Prooflane in the application, browser title, README, generated reports and technical handover artifacts. Persistent database/bucket/realm/Compose identifiers retain the original problem ID to preserve compatibility. Existing evidence artifacts are not rewritten.

- Backend: 17 tests passed, including social-provider gating, PKCE/state/nonce/browser binding and safe broker defaults; Ruff passed.
- Browser workflow: both real identity/upload/audit/review/isolation tests passed. The eight-section UI review produced 28 captures with no overflow, browser exceptions or CSP violations at tested desktop/mobile sizes (`runtime/ui-prooflane`).
- A separate browser check passed for disabled/enabled social providers, exact provider links, pending-access messaging, setup disclosure, 390px layout and metadata endpoint failure recovery.
- Frontend production build passed. The existing lazy Three.js chunk still exceeds Vite's default size advisory.
- One Impeccable detector pass on the changed UI sources returned no findings (`runtime/prooflane-detector.json`); rendered inspection also completed.
- Caddy 2.11.2 is digest-pinned. Syntax validation passed. `uv run python scripts/check_caddy.py` verifies nine real local routes/statuses, including blocked metrics/admin paths. It uses temporary loopback HTTP and requests no public certificate. Explicit route ordering prevents broader proxy handlers taking precedence over the private-path rejection.
- Keycloak configuration sync ran against the existing realm, preserving users/roles and registering the administrator-only tenant attribute.
- The architecture PDF, five-slide presentation, synthetic example report and 91-second demo were regenerated with Prooflane branding.
- Real Google/GitHub sign-in requires provider registration and credentials. Local tests do not establish external provider availability, public certificate issuance, or an uptime SLA.
- Google OAuth registration and credential storage are complete. A live Google callback verified the owner identity and showed access pending before an explicit workspace assignment; the account-switch path clears any previous application cookie. GitHub's app is registered; its secret remains gated by the owner's account verification.
- After the owner assignment/profile completion, the real Google login opened Workspace overview with the owner's name and existing assessments. Credentials remained in `.env`; no authentication codes, secrets or tokens were added to handover artifacts.
