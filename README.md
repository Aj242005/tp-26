# Prooflane

**Understand a configuration. Trace the evidence. Review the change.**

Prooflane is a workspace for teams reviewing network device configurations. It turns uploaded snapshots into inspectable findings, keeps uncertainty visible, and helps reviewers teach the system unfamiliar formats through tested, versioned mappings.

Every supported finding keeps the observed setting, expected value, source lines, rule version and proposed correction together. An interactive 3D audit trail lets you follow an assessment from input to report and inspect the artifacts behind each stage.

[Website walkthrough](docs/pitch-and-walkthrough.md) | [Architecture](docs/deliverables/architecture.pdf) | [Operations](docs/operations.md) | [Security](docs/security.md)

## How it works

1. **Bring a snapshot.** Upload configurations with device, firmware and completeness information.
2. **Run an assessment.** Versioned rules evaluate supported facts. Missing, conflicting and unsupported evidence stays unknown.
3. **Follow the finding.** Inspect source lines, assumptions, severity and a proposed correction, or explore the 3D trail.
4. **Investigate unfamiliar syntax.** Gemini consults approved references, proposes a bounded mapping and runs its cases. Suggestions stay drafts.
5. **Review and reuse.** A reviewer approves tested mappings for future assessments. Earlier results keep their original versions. Export PDF, JSON or CSV evidence.

The application does not modify live devices. Model responses do not establish compliance or approve their own mappings.

## Run locally

Install Docker with its Linux engine and [uv](https://docs.astral.sh/uv/). Node 24 and pnpm are needed for frontend development only. Allow at least 8 GB for the complete Docker stack.

```powershell
uv sync --frozen
uv run python scripts/bootstrap.py
docker compose up -d --build
docker compose exec -T api python scripts/sync_identity.py
```

Open **http://localhost:8185**. Sign in as `admin` with `LOCAL_ADMIN_PASSWORD` from your ignored `.env`. Local bootstrap also creates an `auditor` account and an `other` account in a separate test organization. Passwords are generated individually; none is published here.

The default gateway binds to loopback. Persistent volumes hold identity, records and encrypted artifacts. `docker compose stop` preserves them; `docker compose down -v` destroys them.

## Connect Gemini

Configure the backend `.env`, then recreate API and worker containers:

```dotenv
GEMINI_BACKEND=vertex_express
GEMINI_API_KEY=your_private_key
GEMINI_MODEL=your_exact_model_identifier
LLM_ENABLED=true
```

Choose `developer` for the Gemini Developer API. The model is never silently substituted. `uv run python -m scripts.check_provider` performs a small synthetic tool-call check. Deterministic assessments, manual mapping review and exports remain available with AI disabled. Never put provider or OAuth secrets in browser code or `VITE_*` variables.

## Inside the workspace

| Area | What it provides |
| --- | --- |
| Evidence console | Responsive dark/light workspace, keyboard navigation and linked findings |
| Audit trail | Interactive 3D stages with captured artifacts and an accessible flat view |
| Interpretation | Declared native formats plus constrained text, JSON and XML mappings |
| Review | Test cases, explicit approval, version pinning and mapping retirement |
| Identity | Keycloak, Google/GitHub connections, organizations and role checks |
| Processing | Durable jobs, leases, retries, shared rate limits and independent API/worker replicas |
| Storage | Encrypted artifacts, retention controls and verified backup tooling |

React/TypeScript, FastAPI, PostgreSQL, Valkey, SeaweedFS and Keycloak form the application. NGINX serves the frontend; optional Caddy provides public HTTPS. Docker Compose makes deployment reproducible. A single VM is one failure domain, with no regional redundancy or uptime SLA.

## Coverage and limits

The initial baseline has **20 team-authored technical checks**. Native interpretation covers a declared subset of Cisco IOS/IOS-XE, Junos `set` output and FortiOS. Included examples are synthetic. Framework views are candidate crosswalks over this baseline, not complete official benchmark implementations or certification.

Use authorized, versioned references and independently reviewed labels when extending coverage. See [coverage](docs/coverage.md), [reference and evaluation guidance](docs/dataset-and-benchmarks.md), [research hypotheses](docs/novelty-audit.md), [verification](docs/verification.md) and the [dependency review](docs/dependency-review.md) for measured scope and remaining findings.

## Documentation

- [Identity and HTTPS](docs/identity-and-https.md): social sign-in, callbacks and Caddy.
- [Vercel frontend](docs/vercel-frontend.md): frontend hosting and backend connection.
- [Operations](docs/operations.md): scaling, failure handling, backup and recovery.
- [Implementation plan](IMPLEMENTATION_PLAN.md) and [current status](IMPLEMENTATION_STATUS.md).
- [Presentation](docs/deliverables/technical-presentation.pptx), [recorded walkthrough](docs/deliverables/demo.webm) and [sample report](docs/deliverables/example-device-report.pdf), using synthetic examples.

## Development checks

```powershell
uv run pytest -q
uv run ruff check service migrations scripts tests
pnpm --dir web install --frozen-lockfile
pnpm --dir web build
pnpm --dir web exec playwright install chromium
pnpm --dir web test:e2e
```

Browser workflow tests use local Keycloak and generated credentials. Live agent tests require an enabled provider and use synthetic material. Credentials, uploads, private research, backups and runtime test output are excluded from Git.

Hosted pilot: [open Prooflane](https://prooflane-five.vercel.app). See [cloud operations](docs/cloud-deployment.md) for topology, backups and deployment limits.
