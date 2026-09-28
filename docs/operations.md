# Local operations

## Runtime

NGINX serves the frontend and distributes API requests. API and workers scale independently. PostgreSQL owns accepted jobs, sessions, policy versions and metadata. Valkey owns shared limits/provider permits; AOF preserves counters across ordinary restarts. SeaweedFS stores application-encrypted artifacts. Keycloak runs in production server mode behind the gateway. A dedicated NGINX egress service forwards only to the Google inference hosts; API/worker networks have no general outbound route.

Default address: http://localhost:8185. Port 8080 was occupied on the development workstation. Change APP_PORT and APP_ORIGIN together; regenerate bootstrap files and synchronize an existing identity client's redirects with `docker compose exec -T api python scripts/sync_identity.py`. NGINX forwarded-port settings must also match. Realm imports preserve existing users.

```powershell
docker compose ps
docker compose logs --tail 50 api worker maintenance
docker compose -f compose.yaml -f compose.scale.yaml up -d
```

Liveness checks the process. `/api/health/ready` checks PostgreSQL, Valkey and S3. Compose does not automatically restart an unhealthy process; restart policies cover exited containers. Identity readiness blocks initial gateway startup.

Accepted work is durable before the response. Claims use SKIP LOCKED, a 75-second lease, 15-second heartbeat and fencing. Tenant concurrency is two jobs, with separate Gemini permits. New-audit queue admission is capped at 200 per tenant. Evaluation commits before its PDF stage, so PDF failures can be retried independently. Processing is at least once; stale workers cannot publish newer results. Unreferenced artifacts are removed after a 24-hour grace period.

## Failure runbooks

| Failure | Expected behavior and action |
| --- | --- |
| Valkey | Restore cache. New mutations/provider calls fail closed. Authenticated reads use a restrictive local fallback: 10/minute, burst 3 per identity/replica. Accepted jobs remain durable. |
| Worker | Restart worker. Expired leases are reclaimed. Inspect retry/error state and queue age. |
| PostgreSQL | Restore connectivity. New operations remain unavailable; there is no pretend-success queue. |
| S3 | Restore object-store. Upload acceptance pauses. Metadata remains readable; input/PDF reads fail visibly and workers retry. |
| Gemini | Check the safe error, model/key/quota and retry the investigation. Deterministic findings remain independent. Invalid credentials/model require correction. |
| Growing queue | Inspect worker health, input complexity and provider limits before adding replicas. |
| Keycloak | Restore identity. Existing application sessions remain usable until expiry/revocation; new sign-ins require identity. |

One laptop remains one failure domain. This release claims no host redundancy, monthly uptime SLA or zero-downtime database maintenance.

## Backup and restoration

```powershell
uv run python scripts/backup.py create
uv run python scripts/backup.py restore --file runtime/backups/<timestamp>.sihbackup --project sih26155-restore-check
```

Backup pauses gateway/API/workers/maintenance/identity, dumps both databases, copies encrypted objects, verifies referenced plaintext hashes and encrypts the archive using the data key. Writers restart in a finally block. This tool serves small local installations, with a maximum 1 GiB compressed backup; larger installations need streaming backup infrastructure.

Keep a separate protected copy of `.env`, especially DATA_ENCRYPTION_KEY and database/identity secrets. The archive deliberately excludes keys. Losing the data key prevents both artifact and backup recovery. Keep secrets/runtime material out of shared exports and general file synchronization.

Restore refuses an existing target project or a name outside `sih26155-restore...`. It creates fresh volumes, restores the application/identity databases and objects, and verifies record counts and all referenced artifact hashes/decryption. It leaves the restored stack quiescent. Replay deletion requests recorded after the backup before opening access; run maintenance, then start restored services with their own origin/port and synchronize restored identity redirects. Never target the primary volumes for a rehearsal.

Recovery point is the last successful consistent backup. Backup retention is operator-managed. Keep deletion records until older backups expire: deletion in the live application cannot erase an offline backup.

## Rotation and migrations

Gemini settings take effect after recreating API and worker containers. App-secret rotation invalidates pending login exchanges; existing sessions need separate revocation. Database/Keycloak/S3 passwords must change in service state and `.env` together. Editing `.env` alone is not credential rotation.

Artifact format SIH1 has one active AES-GCM key. Preserve the old key and a verified backup before any key change. With writers stopped, decrypt/re-encrypt all referenced artifacts, verify their hashes, then switch the configured key. Automatic multi-key rotation is not implemented; never replace DATA_ENCRYPTION_KEY while old objects remain encrypted under it.

Compose runs Alembic once under a migration role; failures block startup. Runtime users cannot alter schema. The initial destructive downgrade is refused. Use a verified backup for rollback; test future compatible migrations against a restored copy first.

## Local TLS

```powershell
uv run python scripts/tls.py
docker compose -f compose.yaml -f compose.tls.yaml up -d
docker compose -f compose.yaml -f compose.tls.yaml exec -T api python scripts/sync_identity.py
```

Open https://localhost:8443. The self-signed localhost certificate expires in 90 days; the script installs no trusted root. This profile enables Secure cookies and redirects HTTP. Returning to HTTP requires recreating from the base Compose file and resynchronizing identity redirects. Certificate validation remains enabled on actual provider traffic; only the local gateway health probe accepts this self-signed certificate.

## Observability

```powershell
docker compose -f compose.yaml -f compose.scale.yaml -f compose.observability.yaml up -d
```

Prometheus: http://localhost:9095. Grafana: http://localhost:3005, admin with LOCAL_ADMIN_PASSWORD. The provisioned dashboard shows rate, p95 latency, queue size/age, server errors and memory. Alerts cover API loss, stale queues and error ratios. No external notification receiver is configured. Public application routing denies metrics.

Optional OTLP spans are written to rotating collector files. Authentication paths, bodies and headers are excluded. Job/request identifiers support correlation; keys and configuration contents do not belong in logs. Backup freshness is recorded in runtime/latest-backup.json and must be checked operationally.

## Qualification and future hosting

Qualification scripts use synthetic sessions created by an operator-only local CLI, never a public authentication bypass. Revoke them afterwards with `docker compose exec -T api python -m service.qualification cleanup-sessions`. Real OIDC and roles are verified separately with Playwright. Load, benchmark and resilience scripts record their measured results under runtime; run failure injection only on this local test workspace.

Before future external hosting: replace local accounts/tenant provisioning, use trusted TLS and prompt revocation, independent backups and host redundancy, set provider data-handling/spend policies, qualify real vendor evidence, and rerun security/recovery/load checks on the intended topology. No cloud resources or Kubernetes manifests are created here.
