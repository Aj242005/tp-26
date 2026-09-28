# Cloud operations

This is a single-VM pilot with restart policies, durable jobs and persistent storage. It does not provide redundancy across machines or zones, and no uptime SLA is claimed.

## Running topology

| Component | Location |
| --- | --- |
| Frontend | https://prooflane-five.vercel.app |
| HTTPS API and identity gateway | https://proof-lane.akshitjain.space |
| VM | `prooflane-pilot`, Google Cloud `asia-south2-b` |
| Size | `e2-standard-2`: 2 vCPU, 8 GB RAM |
| Disk | 50 GB balanced persistent disk, retained on VM deletion |
| Application directory | `/opt/prooflane` |

The VM uses a dedicated VPC. Internet ingress permits TCP 80/443 and UDP 443; SSH is limited to the owner's laptop IP. No VM service account is attached. Database, cache, object storage, metrics and the identity administrator console are not published to the internet. SSH password and root login are disabled. Application secrets live in root-readable `.env`; generated realm/storage configuration files are readable only by their container service UID.

Compute, disk and public IPv4 were estimated at roughly US$65-80/month if continuously running, before transfer, snapshots and taxes. Check the billing console for actual regional rates and usage. Stopping the VM reduces compute charges but retains disk and address charges.

## Operate through SSH

The owner's laptop stores the private SSH key, pinned host key and connection details under ignored `runtime/cloud/`. Keep a separate secure backup of the private key and production `.env`. The production encryption key is needed to decrypt stored evidence and backups. Do not publish these files.

On the VM:

```sh
cd /opt/prooflane
sudo docker compose -f compose.yaml -f compose.caddy.yaml ps
sudo docker compose logs --tail 50 api worker
sudo docker compose exec -T api python scripts/sync_identity.py
```

For a new release, upload reviewed source without overwriting `.env` or `runtime`, then rebuild with `docker compose -f compose.yaml -f compose.caddy.yaml up -d --build`. Run migrations and check readiness before publishing a connected frontend. Preserve volumes; `down -v` destroys data.

On Linux, the generated `runtime/realm.json` must be readable by Keycloak UID 1000, and `runtime/s3.json` by SeaweedFS UID/GID 1000. Keep the directory restricted and grant service ownership with mode 640; making credentials world-readable is unnecessary.

## Backups and recovery

The disk has a daily snapshot schedule at 21:00 UTC with seven-day retention. Snapshots are encrypted by Google Cloud and survive deletion of the source disk. They are crash-consistent disk snapshots; they do not replace a tested application restore or protect against an attacker controlling the cloud account.

The application backup tool creates an encrypted export of both databases and stored evidence. It briefly stops writers to keep metadata and objects consistent:

```sh
cd /opt/prooflane
sudo python3 scripts/backup.py create
```

Run this before upgrades. Copy the resulting `runtime/backups/*.sihbackup` off the VM and retain the matching encryption key separately. The tool is limited to 1 GiB and loads the export in memory. Restore into a separate `prooflane-restore...` Compose project using `scripts/backup.py restore`; it checks metadata and artifact hashes before any traffic is enabled. Replay deletions made after the backup before granting access.

For VM loss, create a replacement disk from a snapshot, restore the restricted SSH/firewall configuration, attach the reserved address, and check API readiness, storage reads, identity and a fresh audit. The first release still needs a timed full-VM recovery rehearsal. Configure an independent uptime alert before relying on this pilot for unattended operations.

Deletion protection is enabled, and the disk is retained if the VM is deliberately deleted. Removing the application permanently also requires removing its reserved address, snapshots and snapshot schedule after preserving required data.

## Release qualification: 28 September 2026

The connected Vercel release passed real browser sign-in, secure/HTTP-only session cookies, configuration upload, durable audit execution, 3D rendering, PDF export, CSRF rejection, workspace navigation and a mobile overflow check, with no page errors. Public API readiness returned 200, unauthenticated identity returned 401, and metrics/admin routes returned 404. Public login throttling returned 429 with a Retry-After header after the configured burst. API and identity responses through Vercel were uncached.

The configured Vertex AI Express model completed a synthetic tool-call check from the VM. An encrypted application backup containing two records and two artifacts was restored into a separate Compose project in 14.58 seconds; metadata and evidence hashes matched. This measures a small application restore on the same VM, not recovery from a lost VM or a service-level objective. An encrypted copy was also retained on the owner's laptop.
