# SIH26155 · Configuration Auditor

Local, authenticated network configuration auditing with evidence-linked findings and reviewed adaptation to unfamiliar formats. The application runs in Docker; Gemini inference uses the configured Google API backend. No cloud deployment is required.

## Start

Prerequisites: Docker Desktop with its Linux engine running; `uv` for bootstrap and local Python checks. Node 24/pnpm are needed only for frontend development and browser tests. Allocate at least 8 GiB to Docker for the scale profile.

```powershell
uv sync --frozen
uv run python scripts/bootstrap.py
docker compose up -d --build
```

Open **http://localhost:8185**. Sign in as `admin` using `LOCAL_ADMIN_PASSWORD` from the ignored `.env` file. `auditor` has upload/audit access but cannot approve mappings. `other` belongs to a separate local organization. Bootstrap preserves existing credentials and provider configuration.

For two API replicas and two workers:

```powershell
docker compose -f compose.yaml -f compose.scale.yaml up -d --build
```

Only the gateway is exposed, bound to loopback. API, worker, PostgreSQL, Valkey, SeaweedFS S3 and Keycloak communicate on Docker networks. `docker compose stop` preserves all data. **Do not use `down -v` unless you intend to destroy the persistent database, identity and evidence stores.**

## Gemini configuration

Set these fields in `.env`, then recreate API and worker containers:

```dotenv
GEMINI_BACKEND=vertex_express
GEMINI_API_KEY=your_private_key
GEMINI_MODEL=your_exact_model_identifier
LLM_ENABLED=true
```

Use `developer` for a Gemini Developer API key. Vertex AI Express Mode uses the API key directly and requires no application deployment or service-account file. The selected model is never silently substituted. `uv run python -m scripts.check_provider` sends a small synthetic function-call check and records a redacted result. Disabling AI leaves deterministic audits, manual mapping review and exports usable.

## Use the application

1. Add UTF-8 configurations in **Devices**, or load explicitly labelled synthetic examples from Overview. Bulk uploads accept up to 100 files, 10 MiB per file and 100 MiB per batch. Mark a complete snapshot only when all relevant scopes are present.
2. Select a baseline or imported policy and run an audit. Open its findings to inspect observed/expected values, exact source lines, coverage and a reviewable command proposal.
3. For unfamiliar syntax, open **Investigation**. Gemini can search approved references, test a declarative mapping and ask a clarification. Its output stays a draft.
4. In **Training & review**, correct cases, test them, and have a reviewer activate the mapping. A new audit uses it immediately without a code deployment; retiring it rolls back future use. Existing assessments keep their pinned versions.
5. Download the per-device PDF, JSON or CSV. Administrators manage artifact retention and can delete a configuration with all its assessments and exports.

## What the checks establish

The initial content contains **20 team-authored technical checks**. Native interpretation covers a declared subset of Cisco IOS/IOS-XE, Junos **set** output and FortiOS. Bounded text/JSON/XML mappings extend interpretation. Missing evidence, unsupported effective inheritance and conflicting settings remain unknown.

The organizer supplied a reference list, **not a dataset**. Included examples are synthetic. CIS/NIST/STIG/ISO selections are candidate crosswalk views over the technical baseline, **not full official benchmark implementations or certification**. Authorized reference text and reviewed policy JSON can be imported. Command proposals require device/firmware and operational review; the application does not change live equipment.

Read [coverage and evidence](docs/coverage.md), [operations](docs/operations.md), [security boundaries](docs/security.md), and [verification results](docs/verification.md). The approved [implementation plan](IMPLEMENTATION_PLAN.md) is retained with an implementation reconciliation in [status](IMPLEMENTATION_STATUS.md).

## Development checks

```powershell
uv run pytest -q
uv run ruff check service migrations scripts tests
pnpm --dir web install --frozen-lockfile
pnpm --dir web build
pnpm --dir web exec playwright install chromium
pnpm --dir web test:e2e
```

Browser tests use the real local Keycloak service and generated local credentials. The live agent test runs only when `LLM_ENABLED=true` and uses synthetic material. Runtime test output, credentials, screenshots and backups are ignored by Git. Runtime deployment profiles and operational rehearsal commands are documented in [operations](docs/operations.md).
