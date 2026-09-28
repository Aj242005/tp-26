# Implementation status

Revision 2 was approved on 28 September 2026. The local application is implemented; release qualification is in progress. No cloud deployment is involved. Vertex AI Express uses the user-selected `gemini-3.8-flash`; credentials remain in ignored `.env`.

## Delivered workflows

| Requirement | Implementation and evidence |
| --- | --- |
| Single/bulk ingestion | UTF-8 configuration inventory, explicit snapshot scope, native identification and encrypted source artifacts |
| Adaptive training | Bounded Gemini tools, approved reference retrieval, declarative text/JSON/XML mappings, editable cases, reviewer activation and retirement |
| Framework selection | 20 technical checks, candidate CIS/NIST/STIG/ISO crosswalk views and reviewed policy JSON imports; no full official benchmark claim |
| Device reports | Persisted evidence/coverage, device metadata when present, reviewable CLI proposals, per-device PDF/JSON/CSV |
| Scale/fault tolerance | Independent API/worker replicas, NGINX, shared Valkey limits, durable PostgreSQL jobs, leases/fencing, bounded retries and retention maintenance |
| Access/security | Local Keycloak OIDC/PKCE, roles, CSRF, database RLS, private encrypted objects, restricted Google egress |
| Operations | TLS and observability profiles, CI configuration, encrypted backup/restore, dependency/image qualification and runbooks |

See [verification](docs/verification.md) for actual results and outstanding measurements, [coverage](docs/coverage.md) for interpretation boundaries and [operations](docs/operations.md) for local startup/recovery.

## Reconciliation with the approved plan

- SeaweedFS supplies local S3-compatible storage in place of MinIO. The public artifact contract and application encryption remain the same.
- The UI uses ordinary CSS with shared design tokens; no Tailwind runtime/build dependency is needed.
- Vertex AI Express was selected by the user after approval; the SDK also supports the Gemini Developer API. No OpenAI API is used.
- Approved reference text uses bounded lexical passage search. PostgreSQL full-text indexing, ZIP/PDF/SCAP package ingestion and Batfish integration are not implemented.
- Downloads use an authenticated server session (eight-hour expiry), tenant checks and immediate revocation on deletion. No anonymous presigned download URL is issued.
- The load generator uses Python/httpx rather than k6. Real OIDC is tested separately; traffic uses 100 local operator-created sessions across two tenants.
- Migration 002 adds audit list metadata, maintained atomically with evidence changes, to keep list queries independent of configuration size.
- The configured local job lease is 60 seconds with 15-second heartbeats. The code default remains 75 seconds when this environment override is absent.
- Keycloak runs one local identity replica with a local cache. Identity clustering and host redundancy are outside this local topology.

## Evidence still requiring external inputs

Independent vendor/firmware labels, authorized exact benchmark editions, operational verification of remediation and controlled comparisons/ablations are not established by synthetic workflow tests. No claim of universal support, certification, comparative superiority or a monthly uptime SLA is made. Role provisioning is local; immediate membership revocation and automatic multi-key rotation require further work before external hosting.

Official handover artifacts are under `docs/deliverables`: architecture (maximum two pages), presentation (maximum five slides), and a demo recording (maximum two minutes) once final qualification completes. Source publication requires an actual destination; nothing has been uploaded externally.
