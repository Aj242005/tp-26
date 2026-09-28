---
version: 1
slug: "web-src-audittrail-tsx"
primary_target: "web/src/AuditTrail.tsx"
related_targets: ["web/src/TrailScene.tsx","web/src/trail.css","web/src/trail-model.ts"]
---

# Spatial audit debugger

Mode: Operate.

The user requested an impressive, interactive 3D realization of the complete audit trail, useful for debugging. They approved the proposed 3D pipeline direction. This extends the existing graphite Evidence Console; it does not replace the shared visual world.

Seven distinct procedural objects represent preserved input, pinned policy, interpretation, evaluation, report, optional Gemini investigation and the human review gate. A matte board, directional light, readable stage labels and restrained semantic colors give the scene physical clarity. The inspector, not decorative telemetry, supplies the detail. Geist and Geist Mono follow the existing typography decision.

Users orbit, zoom, reset, select, replay, pause, step and follow real findings or source lines. The diagram describes artifact dependencies. Timestamps appear only where stored; no elapsed replay clock, guessed topology, invented tool response or implied approval is allowed. Existing roles, redaction and tenant isolation remain authoritative.

The scene loads lazily, renders on demand and releases GPU resources on exit. All work remains available through the flat stage list when WebGL fails. Mobile defaults to flat view; optional 3D uses a portrait camera and compact numbered markers. The inspector stacks below the graph under 1320px and has an explicit focus shortcut. No motion runs automatically.

Verification uses web/scripts/check-trail-model.mts and web/scripts/review-trail.mjs. The latter signs in through real local OIDC, inspects stored synthetic audits and uses browser-only queued/failure fixtures. Screenshots and check results remain under ignored runtime/audit-trail. Final results and qualification limits are recorded in docs/verification.md.
