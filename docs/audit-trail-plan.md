# Interactive audit trail

The user approved the 3D pipeline direction on 28 September 2026. It is implemented as a spatial debugger in each audit, extending the existing Evidence Console.

## Implemented behavior

The 3D audit trail tab links recorded artifacts and decisions. Selecting a stage updates an adjacent inspector; source and finding actions return to the existing evidence screens. A guided replay advances through the logical evidence sequence. This is artifact lineage, not elapsed execution time. Keyboard stage controls and an equivalent flat view are available.

## Recorded stages and relationships

| Stage | Existing evidence | Relationships |
| --- | --- | --- |
| Input snapshot | Device ID, name, vendor, input SHA-256, audit creation time | Supplies normalization; audit configuration pins the policy |
| Policy snapshot | Exact policy name, framework, version and rules | Supplies evaluation |
| Normalization | Native version, declared snapshot scope, facts and source lines, unrecognized count, captured approved mapping versions | Supplies evaluation |
| Evaluation | Stored verdicts, observed/expected values, evidence origins, coverage, evaluated_at | Produces report; unresolved semantics can be investigated |
| Device report | Stored SHA-256, size and completed_at | Opens authenticated PDF download |
| Gemini investigation | Saved checkpoint or completed trace, actual tool results, references, tests, questions and model | Produces material for human review |
| Human review | Recorded questions/proposals and waiting-review state | Approval remains an explicit action in Training & review; it must never be implied by a completed agent call |

Pending or optional nodes remain explicitly labelled. A failed worker stage marks only that stage; successful earlier artifacts remain inspectable. No fabricated traffic, network topology, confidence scores, durations or approval events.

## Debugging interactions

- Orbit, zoom, reset and select a node; keep labels legible outside the 3D geometry.
- Inspect failures and missing evidence, then open an exact finding or cited source line.
- Inspect stored tool results, including unsuccessful reference searches and rejected mapping tests.
- Inspect captured mapping versions rather than current editable versions.
- Replay/pause/step controls, with automatic pause when the page is hidden.
- Flat view and semantic stage controls when WebGL is unavailable or unwanted.

## Implementation boundaries

Keep geometry local and procedural; use no remote model, image or font service. Load the renderer only when the trail tab opens. Cap render resolution, render on demand, dispose GPU resources on exit, and honor reduced motion. Retain the existing CSP, role checks, API contracts and Gemini configuration.

The current snapshot lacks a complete per-attempt execution clock. Worker-attempt history is not part of this view; a future expansion must read stored job events instead of estimating them from animation. Existing tenant-scoped audit responses supply the current implementation. Viewing or replaying the trail does not run a new audit or call Gemini.

The renderer is a lazy Three.js chunk, using procedural geometry and on-demand drawing. It caps pixel ratio at 1.75, stops drawing offscreen or in a hidden tab, and releases contexts, materials and geometry on exit. No animation starts automatically. Phones default to flat view; optional 3D uses a portrait camera and numbered markers. Below 1320px the inspector moves under the graph, with a direct evidence shortcut.

## Verification

Check deterministic-complete, unfamiliar-format investigation, queued and failed states. Verify selection, orbit/reset, replay/pause, finding/source links, keyboard use, light/dark themes, narrow screens, WebGL fallback and cleanup. Confirm no new browser errors or CSP violations. Rendered screenshots must be reviewed before completion.
