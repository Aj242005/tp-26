# Prooflane: the pitch and the complete walkthrough

**Prooflane — trace the finding, trust the evidence.**

## Explain it to a five-year-old

Imagine a school with lots of doors. Each door has instructions saying who can open it and how it should lock. But different doors use different instruction books.

Prooflane is a careful helper. You give it a copy of a door's instructions. It checks them against a safety checklist. It says, “This looks right,” “This needs fixing,” or “I need more information.” It points to the exact instruction that made it say that.

If it finds a word it does not understand, an AI helper investigates. A person checks the new explanation before the helper can use it next time. You can follow the whole journey on an interactive 3D trail.

In the real world, the “doors” are routers and firewalls, the “instructions” are configuration files, and the “safety checklist” is a versioned security policy. Prooflane reads copies; it does not open the doors or change the devices.

## A thirty-second pitch

“Companies use network equipment from many vendors, each with its own configuration language. That makes security reviews slow and easy to get wrong. Prooflane checks saved configurations against versioned security rules and ties each supported finding to its source evidence. When a format is unfamiliar, its AI assistant investigates and proposes interpretations that must pass tests and human review. The result is an explainable audit, a repeatable report and a clear view of what we still don't know.”

The distinctive contribution is **reviewed learning of unfamiliar formats with traceable evidence**, rather than an AI answer that cannot be checked. The 3D view makes that process easier to inspect; it is not the security engine itself.

## First five minutes

1. Open **http://localhost:8185** and sign in. Local demo accounts still work. Google/GitHub require the one-time [provider setup](identity-and-https.md).
2. On **Overview**, add the synthetic examples if the workspace is empty, or open **Devices → Add configurations** to upload your own export.
3. In **Devices**, select **Baseline** in **Audit policy**, then click **Run audit** beside a device.
4. Wait for the audit to complete. Open **Findings & evidence** and select a failing or unknown check.
5. Follow a cited source line, inspect **Observed** versus **Expected**, then click **Explore in 3D**. Export the device PDF when available.

For a pitch, show a failing check first, then an unknown one. Explain that “we don't know yet” is safer than a false pass. Only show investigation or a mapping approval as completed if it actually happened.

## The navigation and controls

The left navigation groups auditing, knowledge and workspace settings. **Ctrl/Cmd+K** opens destination search. The top bar lets you collapse the navigation, switch light/dark themes, reduce interface motion and sign out. Theme, focus mode and motion preferences persist in the browser. Your name identifies the current user; the organization boundary controls which records you can see.

The sidebar's Gemini status is based on configured settings. It is not a live provider health check. **Integration settings** at the bottom of the sidebar opens **Activity & settings**, where the Gemini and sign-in panels live. On narrow screens, use the main **Activity & settings** navigation item instead.

## Overview: the workspace's front desk

Overview brings recent assessments, device/mapping counts and work in progress together. The counters link to the relevant sections. It is a summary of stored records, not a live network traffic monitor.

- **Assessment browser:** choose a recent audit to inspect in the central workbench.
- **Control spectrum:** each small control represents a real finding in that assessment. Hover to preview it; select it to keep its details visible. The preview shows the verdict and available comparison. Open the finding to inspect its evidence.
- **Coverage / results:** show how much the declared checks could evaluate and what passed, failed or needs evidence. A high pass percentage with low coverage is not a clean bill of health.
- **Explore in 3D:** opens the selected audit's trail directly.
- **Recent assessments / processing state:** show recorded audits and job progress. They do not measure network availability or guarantee uptime.
- **Synthetic examples:** create clearly labelled test configurations for exploration. They are team-authored examples, not externally supplied data or real enterprise devices.

## Devices: the configuration filing cabinet

A device record represents an uploaded snapshot. It does not establish a live SSH connection or continuously discover network equipment. Upload a later snapshot as a new record when the underlying configuration changes.

Click **Add configurations**, drag files onto the upload area or use **Choose files**, and review the selected file chips. Remove an unwanted file with its remove button before uploading.

| Upload field | What to provide |
| --- | --- |
| Configuration files | UTF-8 `.txt`, `.cfg`, `.conf`, `.config`, `.json` or `.xml` files. Up to 100 files, 10 MiB per file, 100 MiB total. Unsupported JSON/XML semantics need a reviewed mapping. |
| Vendor / format | Prefer **Detect from evidence** when identifiable. Otherwise choose IOS/IOS-XE, Junos set format, FortiOS or unfamiliar format. A label alone does not make an unsupported command understood. |
| Firmware version | The exact exported device version if known. Leave it unknown rather than guessing. Mapping scope depends on this information. |
| Complete configuration snapshot | Select only when the export contains every relevant scope. A snippet must remain incomplete. Absence of a command in a snippet cannot prove a device-wide setting. |
| Upload configurations | Preserves the snapshot and its metadata. Uploading alone does not run an audit. |

The inventory shows the device name, vendor/version, upload or synthetic source, date and available actions. Its search filters the currently loaded page; pagination accesses other records. **Audit policy** selects the included baseline/framework pack or an imported reviewed version for the next audit. Deleting a device also removes its assessments and exports; treat the confirmation as a destructive action.

### What should the configuration contain?

Supply the device's existing configuration export, not application source code, an API key file, a screenshot or a description of what you wish the device did. Useful context includes the hostname, firmware and relevant management, authentication, logging, time synchronization, SNMP and network settings. Keep surrounding sections: a command's meaning can depend on its scope.

Native coverage is a declared subset of Cisco IOS/IOS-XE, **Junos `set` format**, and FortiOS. Junos brace-style exports are not equivalent to the supported set format. JSON/XML imports need matching reviewed selectors when the native parser does not cover their meaning. See [coverage](coverage.md) for the actual limits.

For a harmless first upload, save the following as `branch-demo.cfg`:

```text
hostname branch-demo
version 15.2
ip ssh version 1
```

Choose Cisco IOS, firmware `15.2`, and **leave Complete configuration snapshot unchecked**. This is a deliberately incomplete synthetic example with an obsolete SSH setting. An audit can identify supported evidence while many other checks remain unknown. Do not apply this example to real equipment. The repository's `fixtures` directory has fuller synthetic cases.

Original uploads are encrypted in storage. The browser/source tools use redacted text. Redaction has a defined coverage and is not a guarantee that every possible vendor secret is recognized; use sanitized demo exports and authorized operational data.

## Run audit: what happens after the click?

An **audit** is a saved assessment: “For this exact snapshot, using this policy and these mapping versions, what can we establish?”

1. Prooflane authorizes the action and queues a durable job. Repeated submission of the same request uses an idempotency key to avoid duplicate work.
2. It records the input hash, selected policy and approved mapping versions. This fixes the evidence context for that run.
3. A worker reads the snapshot and extracts supported facts, such as the SSH version. Facts retain source lines and interpretation details.
4. The deterministic evaluator compares facts with the typed policy rules. It produces pass, fail, insufficient-evidence or not-applicable results where appropriate.
5. It saves findings and generates the report. Queued, running, retry, report-pending, complete, cancelled and failed states describe this processing.

**Run audit does not automatically call Gemini or change a router.** Gemini investigation is a separate, explicit action. Cancelling stops eligible work; retrying resumes failed work. **New audit with current mappings** creates a fresh assessment so a newer interpretation does not rewrite the old result.

## Audits: the assessment register

Use this page to locate recorded assessments, compare their dates, policies, statuses and results, and open a detailed assessment. The stored result describes a particular configuration at a particular time; it cannot certify what the live device is doing now.

Inside an audit:

| Section or field | Meaning |
| --- | --- |
| Status / progress | What the worker has actually recorded. Queued is waiting; complete means the run finished, not that all controls passed. |
| Evaluated coverage | The share of applicable checks for which the evaluator had enough evidence. |
| Passing / failing / need evidence | Counts of supported matches, supported mismatches and unresolved checks. |
| Findings & evidence | Filter all/pass/fail/need-evidence results and select a control to investigate. |
| Control ID / severity | Stable rule identifier and the policy's assigned seriousness. Severity is not an automatically measured probability of attack. |
| Observed | The fact extracted from this snapshot. “Unknown” means the evidence does not establish it. |
| Expected | The value or condition required by this policy rule. |
| Configuration evidence | Supporting interpretation, cited source lines and redacted surrounding text. Select a line to jump to it. |
| Rule source | The recorded basis for the check. A citation should be reviewed against the exact edition and platform scope. |
| Proposed remediation | Suggested commands or guidance for a human to review. Copying a suggestion does not execute it. The app never pushes changes to a device. |
| Configuration | The preserved, redacted snapshot with line navigation. Raw source access requires an auditor role. |
| Device PDF / JSON / CSV | Exportable evidence and assessment data. Existing exported reports are historical artifacts; their hashes and contents are not rewritten by a branding change. |

### The 3D audit trail

Open **Explore in 3D** or the **3D audit trail** tab. The trail presents seven stages: **input → policy → normalization → evaluation → report → investigation → review**.

Select a stage to inspect its actual recorded evidence. Orbit and zoom the scene, reset the camera, or step/replay the stages. Source and finding links return to their relevant detail panes. Mobile/reduced-capability devices have a flat alternative; the accessible inspector remains useful without WebGL.

The trail is a visualization of audit provenance. It is **not** a map of the real network, a packet trace, or a replay with invented execution timings. Investigation/review stages only show recorded work; animation does not perform an audit, call Gemini, approve a mapping or fix a device.

### Investigation: the AI research assistant

This section shows unrecognized configuration context, any recorded investigation summary, clarification questions and tool activity. Starting an investigation uses the configured Gemini provider and bounded tools to inspect allowed evidence, search registered reference passages, test a proposed interpretation and create reviewable drafts where supported.

The tool trace shows which steps were actually taken. Clarification asks for missing context rather than guessing it. The AI cannot approve its own mapping, alter the policy result in place, or execute remediation on network equipment. Model availability, quotas and evidence quality can limit what an investigation resolves. Deterministic audits continue to work when inference is disabled.

## Training & review: teach a language, then check the lesson

“Training” here means adding a **mapping**: a small, explicit rule that translates a configuration pattern into a fact. It is not neural-network training or Gemini fine-tuning.

For example, a vendor might write `secure-shell-version 2`. A mapping can interpret that as the fact `ssh_version = 2`, within an exact vendor and firmware scope.

| Mapping field | Meaning |
| --- | --- |
| Mapping name | A human-readable description of what the mapping understands. |
| Baseline fact | The evaluator fact to populate, such as `ssh_version`. It must be supported by the policy/evaluator. |
| Vendor / format identifier | The format this interpretation applies to. |
| Exact firmware scope | The firmware version whose semantics were reviewed; it prevents assuming all versions behave identically. |
| Selector type | A command prefix, JSON object path or XML element path. |
| Selector | The actual prefix/path to find in the source. This is declarative data, not executable Python or shell code. |
| Value type | Integer, Boolean or text, matching the fact's expected meaning. |
| Value extraction | Use the last command token, the selected structured value, or a constant when the selector's presence establishes a fact. |
| Constant value | Used only for constant extraction; it supplies the interpreted value. |
| Command scope prefix | Optional enclosing context that constrains command interpretation. |
| Evidence and interpretation | Explain the source, version-specific meaning and limits. |
| Validation cases | Source examples plus expected JSON values: `2`, `true`, `"text"`, or `null` for no match. Include at least three distinct cases including a non-match. |

**Test and save draft** stores the proposed mapping and its test results. **Run tests** rechecks that declared case set. A reviewer inspects the evidence and cases, then uses **Review complete — activate** when eligible. Passing a small synthetic test set alone is not proof that a mapping is correct in every situation. Use independent cases and vendor documentation.

**Edit as new version** preserves history. **Retire mapping** prevents that version from being selected for future audits. Existing assessments keep their original snapshot. Run a new audit to see the effect of an approved mapping. Auditor accounts can draft/test; reviewers approve.

## Policy library: the checklist

A **policy** defines what the device should satisfy. A **mapping** defines how to read what the device says. A **reference** explains why that interpretation or requirement is justified.

The included Baseline/CIS/NIST/STIG/ISO views show team-authored technical checks and illustrative framework crosswalks. The shipped baseline contains **20 checks**. These are not official full benchmark releases, licensed standards reproductions or a certification engine.

Each policy has a name, framework label, version, scope and typed rules. The table shows the control ID, technical check, expected fact and severity. A reviewer can use **Import reviewed policy**, edit the JSON and submit an exact reviewed version. Its rules include identifiers, typed comparisons, expected values, source references and any supported vendor-specific remediation. Importing is a reviewer approval action, not an automatic proof of official compliance. Imported versions appear below and become selectable in Devices.

## Reference sources: the evidence bookshelf

These are versioned passages the team has permission to use, supporting rule interpretation and AI investigation. The reference library may include authorized standards and vendor documentation. Included configurations are synthetic examples.

**Register reference** requires a reviewer:

| Field | Meaning |
| --- | --- |
| Document title | Which document/passage this is. |
| Authority / vendor | Who published it. |
| Edition / release | The exact version being relied on. |
| Source URL | Optional provenance link. The app records it; it does not automatically fetch it. |
| Permission or licensing basis | Why the team may store/use the supplied text. |
| Authorized reference text | The actual relevant passages, preserving control identifiers and platform/version context. |

Registering records the text, version and content hash. Expand a saved reference to read it or follow its source link. A source is supporting material; registering one does not automatically add policy rules or activate mappings.

## Activity & settings: access, connections and history

| Panel / field | What it does |
| --- | --- |
| Workspace access: Signed in as | Identifies the current user. |
| Organization | The workspace boundary for records and API access. |
| Assigned roles | What the identity administrator permits this user to do. These are not editable by the user in this page. |
| Gemini: Selected model | The exact configured provider model identifier. A configured string does not prove the provider offers it. |
| Gemini: Inference | Whether AI investigation is enabled. Ordinary rule evaluation does not depend on it. |
| Gemini: Configured badge | Presence of required configuration with inference enabled; not a live connectivity guarantee. |
| Sign-in connections | Shows configuration presence for Google/GitHub. **Manage connected accounts** opens Keycloak account management. |
| Raw configuration retention | Days before encrypted raw input artifacts expire. Administrator-only. |
| PDF retention | Separate lifetime of PDF artifacts. Findings, policies and events remain for review. |
| Save retention policy | Applies the retention schedule. Shortening it can permanently remove existing artifacts on the next maintenance run. |
| Recent workspace activity | The latest 100 recorded events, visible to administrators. **Action** says what happened; **Record** is the target ID; **Actor** is the user's subject ID; **Time** is when it was recorded. |

Activity is an audit log, not a task assignment board, chat, SIEM or live network traffic feed. Role/user administration takes place in Keycloak, not by editing the displayed role text. Backups have a separate operator-managed retention policy.

### Integration settings in `.env`

Open **Activity & settings** or the sidebar's **Integration settings** link to see configuration status. Enter secrets only in the root `.env`, then recreate the affected services. `docker compose restart` alone does not apply changed environment values; use `docker compose up -d api worker maintenance`.

| Environment variable | Meaning |
| --- | --- |
| `GEMINI_BACKEND` | `vertex_express` for a Vertex Express key; `developer` for the Gemini Developer API. |
| `GEMINI_API_KEY` | Private provider key. Never enter it as a model name or in the browser. |
| `GEMINI_MODEL` | Exact identifier available to your provider account. You choose it. |
| `LLM_ENABLED` | Explicit switch for AI investigation. |
| `LLM_GLOBAL_CONCURRENCY` | Maximum simultaneous investigations across the application. |
| `LLM_TENANT_CONCURRENCY` | Maximum simultaneous investigations in one organization. |
| `LLM_REQUESTS_PER_MINUTE` | Provider request budget enforced by the application. |
| `LLM_DAILY_TOKEN_BUDGET` | Application token budget to bound daily model usage. |
| `LLM_MAX_TOOL_STEPS` | How many tool steps an investigation may take. |
| `LLM_REQUEST_TIMEOUT_SECONDS` | How long a model request may wait. |
| `LLM_MAX_OUTPUT_TOKENS` | Limit on model response size. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Credentials for the Google OAuth application you register. |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | Credentials for the GitHub OAuth application you register. |
| `APP_ORIGIN`, `APP_PORT` | Public browser origin and loopback port. Origin controls redirects, CSRF checks and Secure cookies. |
| `PUBLIC_DOMAIN`, `ACME_EMAIL` | Optional Caddy certificate hostname and certificate-account email. Neither creates DNS records. |
| `AUDIT_JOBS_PER_MINUTE` | Audit submission budget. |
| `RETENTION_DAYS` | Default artifact retention before per-workspace values are set. |
| `JOB_LEASE_SECONDS` | How long a worker lease lasts before abandoned work can be recovered. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Optional tracing collector endpoint for the observability setup. |

Database passwords, storage credentials, `APP_SECRET_KEY`, `DATA_ENCRYPTION_KEY`, `OIDC_CLIENT_SECRET`, `KEYCLOAK_ADMIN_PASSWORD` and `LOCAL_*_PASSWORD` are generated infrastructure/access secrets. Preserve them; replacing an encryption key casually can make stored evidence unreadable. They are not fields to fill into a device configuration. Internal database, bucket, realm and Compose identifiers still contain `prooflane` to preserve the existing installation.

## What to claim honestly in a pitch

Claim traceable configuration assessment, declared vendor coverage, tested/reviewed mappings, bounded agent investigation, interactive provenance, role-scoped access and exportable reports. Describe Docker, shared rate limiting, proxying and worker recovery as implemented mechanisms.

Do not promise complete framework certification, support for every firmware, perfect secret redaction, automatic remediation, guaranteed uptime or an unbeatable implementation. Public deployment and provider sign-in require the configured services and external checks described in [identity and HTTPS setup](identity-and-https.md). Existing qualification results and their limits are in [verification](verification.md).
