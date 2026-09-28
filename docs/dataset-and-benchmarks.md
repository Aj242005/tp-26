# SIH26155 data, benchmark and evaluation plan

Implementation note (28 September 2026): the sections below preserve the approved corpus plan. The delivered corpus is five team-authored synthetic fixtures plus labelled test mutations; see [actual coverage](coverage.md) and [verification](verification.md). No official dataset or licensed benchmark archive was obtained. The implemented importers accept explicit authorized reference text and reviewed policy JSON; ZIP/PDF/SCAP package import is not implemented. Bounded lexical passage search supports the agent. Exact-model live Vertex AI Express calls have now passed. Independent vendor labels and fair comparative evaluations remain external evidence work.

Prepared: 28 September 2026. Status: implementation design, pending approval with the main plan.

## 1. What the organizer supplied

The user provided the full statement, preserved unchanged in [problem-statement-user-provided.txt](problem-statement-user-provided.txt), and this reference from the portal's data-links field:

> Check nciipc.gov.in, helpdesk1@nciipc.gov.in — CIS Benchmarks, NIST SP 800-53, DISA STIGs, ISO/IEC 27001; Vendor-specific CLI configuration samples.

The user explicitly clarified that this is a list of authorities and reference material, **not an official downloadable dataset or labelled vendor-configuration collection**. We will therefore build a traceable corpus rather than assume organizer-provided files, benchmark labels or permission to redistribute documents. The earlier [JSON capture](problem-statement.json) remains unchanged as a historical snapshot; this document records the additional context supplied afterward.

The email address is recorded as a reference contact. No email has been sent, and contacting the helpdesk is not required to implement the application.

## 2. Source register and verification status

| Source | Intended use | Status at this revision |
| --- | --- | --- |
| [NCIIPC](https://nciipc.gov.in/) | Organizer-specified authority/reference starting point | Both the bare and `www` HTTPS hostnames timed out. No site content, dataset or benchmark download was obtained |
| CIS Benchmarks | Vendor/version-specific hardening references | Named by the organizer. Exact editions, usable files and redistribution terms must be established when acquiring content |
| [NIST SP 800-53 reference page](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final) | Security-control catalog and reviewed control crosswalks | Direct fetch returned `FETCH_BLOCKED`; no catalog was downloaded or interpreted in this revision |
| DISA STIGs | Applicable device/version technical guidance; structured content where available | Named by the organizer. Select and verify exact releases during source acquisition |
| ISO/IEC 27001 | Management-system/control context and explicit crosswalks | Named by the organizer. Do not assume that organizational requirements can be tested from device configuration alone |
| Vendor documentation and examples | CLI syntax, defaults, scope/inheritance and firmware semantics | Acquire official/appropriately licensed examples for the selected validation cohort; none is represented as an organizer dataset |
| Team-authored configurations | Edge cases, controlled deviations, failure cases and demonstrations | Planned. They must be labelled synthetic and retain the source rules used to construct expected outcomes |

A reference name is not an imported policy pack. Acquiring and validating the exact content is implementation work. Website unavailability must not be converted into a claim that the referenced material does not exist.

## 3. Source acquisition and local storage

For every source, record its authority, original URL or user-provided origin, document title, edition/release, vendor/OS applicability, retrieval date, SHA-256, access/licensing notes and review status. Record the source passage/page/control identifier that supports a rule or semantic interpretation.

Prioritize original standards and vendor documentation, followed by clearly licensed examples. Preserve the retrieved version used for a decision; a later webpage update must not silently alter historical audits. Source import is a controlled administrative operation. Audit workers retrieve from the approved local collection rather than depend on live authority websites during every audit.

Private imports belong under ignored runtime storage or `data/imports/` / `data/private/`, and do not enter Git or Docker image build contexts. Commit only examples and metadata that can legitimately be distributed. Record whether a corpus entry is public, user-provided or synthetic. Do not collect live customer configurations without authorization.

An administrator-only package importer can accept a bounded ZIP or multiple explicit files. Validate paths, extensions, encodings, entry counts, compressed/expanded size limits and hashes; reject traversal, absolute paths, links, nested archive expansion and executable content. Extract only into a fresh controlled directory. Benchmark packages may contain scripts or remote references: preserve them as untrusted reference text where relevant, never execute or automatically dereference them.

## 4. Build two related collections

**Reference/policy collection:** versioned framework documents, control identifiers, implementation notes, vendor documentation, reviewed rule definitions and source crosswalks. It supports retrieval and policy interpretation.

**Configuration/evaluation collection:** device snapshots and snippets, version declarations, expected normalized facts, expected control outcomes, ambiguity cases and independently reviewed labels. It supports correctness, adaptation and performance tests.

Keep these collections distinct. A benchmark describes expectations; it is not itself a sample configuration or an answer label for a particular device. Examples in documentation may omit context and cannot automatically be treated as complete compliant configurations.

## 5. From a benchmark to an executable rule

1. Select the exact framework edition and relevant device/firmware profile.
2. Import metadata and permitted reference text. For structured DISA material, preserve original control/profile identifiers and release versions; do not claim complete SCAP support merely because XML can be parsed. PDF/text extraction is a draft input requiring review.
3. Identify the technical assertion, prerequisites, parameter values and evidence needed. Distinguish directly testable settings from requirements needing external/organizational evidence.
4. Map the assertion to typed facts in the Security Baseline Model. Keep absent, disabled, inherited, unknown and unsupported states separate.
5. Implement a constrained deterministic predicate and applicability rules. Store rule version, severity rationale, source passage, expected evidence and remediation prerequisites.
6. Create meaningful passing, failing, insufficient-evidence and wrong-version cases where applicable. Review the expected answers against the source and configuration semantics.
7. Approve and activate the rule version. Re-evaluate new audits against it while preserving old audit versions and their evidence.

A Gemini-proposed rule or source crosswalk remains a draft until validated and reviewed. A generic NIST/ISO control identifier does not justify inventing a device command or a numeric hardening parameter. Shared technical findings may map to several frameworks, but that mapping requires a stated rationale and does not imply full framework equivalence or certification.

The policy UI and PDF must expose tested, unsupported, not-applicable and external-evidence requirements separately. A control awaiting organizational evidence cannot silently count as a technical pass.

## 6. Configuration corpus construction

Start with Cisco IOS/IOS-XE, Junos and FortiOS when suitable source material is available. Include hierarchical context, scoped command blocks and defaults. Add a structured family such as SONiC JSON or cloud security-group exports when references support its semantics. The architecture remains open to other families through the mapping interface.

Build a matrix of **control × configuration family × semantic condition**. Conditions include explicit secure/insecure values, missing context, inherited defaults, negation, nested scope, reordered input, unsupported firmware and malformed input. Corpus size follows meaningful coverage; generating many nearly identical files does not establish quality.

Each entry records:

- Origin and content hash; public, private or synthetic classification; parent/template lineage.
- Vendor, device family, OS/firmware version, format and whether the input is a complete snapshot or snippet.
- Source-document references for expected behavior and any assumptions about missing context.
- Expected normalized facts with source locations, applicable control verdicts and label-review status.
- Known limitations, allowed uses, redaction transformations and evaluation split.

Synthetic mutations are useful for testing, but a syntactically changed command is not automatically valid vendor syntax or an independently correct label. Mark unverified examples accordingly. Use documented examples and established analysis tools where coverage overlaps; report any human/expert review that has not occurred.

## 7. Adaptation evaluation and leakage prevention

Freeze development and evaluation versions. Hold out entire firmware branches or vendor families where feasible; keep related templates, renamed files and mutations in the same split. Keep answer labels out of the agent's documentation collection and retrieval results.

For a held-out format, allow the declared documentation and a fixed administrator-question budget. Record questions, answers, reviewer effort and mapping changes. Reset learned mappings between independent trials unless the trial explicitly tests accumulated learning. Evaluate accepted mappings on fresh cases rather than the same examples used to approve them.

Compare:

| Approach | What the comparison establishes |
| --- | --- |
| Fixed parser plus reviewed rules | Known-format performance and behavior when formats change |
| Same Gemini model with straightforward retrieval | Whether our learning/review/testing process improves over a strong direct-model baseline |
| Full adaptive workflow | Accuracy, useful coverage and reviewer effort from targeted clarification plus validated mappings |
| Workflow ablations | Contribution of question selection, mapping tests and version/regression gates |
| Batfish or another applicable established tool | Independent checks on precisely overlapping supported tasks, without implying universal vendor/control coverage |

Use equal model, documentation access, input scope and annotation budgets where relevant. Record the exact user-configured Gemini model and prompt/schema versions. Measure false compliant verdicts, false failures, useful coverage, reviewer effort, regressions, latency, provider usage and remediation outcomes. Report scope and sample counts; abstaining on every difficult case is not a win.

## 8. Implementation acceptance and limitations

Before a control is labelled verified, its applicability, evidence requirements and expected outcomes must be checked against its source. Every demonstrated mapping update must pass regression cases and be activated without backend code deployment. Public/synthetic/private provenance and label-review state must remain inspectable.

The complete application can be implemented and exercised locally using a declared source-backed corpus. Expanding vendor coverage or claiming expert-reviewed security correctness may require additional authorized examples and review. Those dependencies are reported as coverage limits rather than concealed behind an overall compliance score.

## 9. Research record for this revision

- **Commands:** `webcmd web fetch --url ...` against the NCIIPC hosts, NIST reference page and official Gemini documentation.
- **Gemini sources read:** [English function calling](https://ai.google.dev/gemini-api/docs/function-calling?hl=en) and [structured outputs](https://ai.google.dev/gemini-api/docs/structured-output). Relevant sections establish application-executed calls, structured schemas and a documented stateless function-calling mode. Model/account compatibility remains untested.
- **Failures/limits:** bare and `www` NCIIPC HTTPS connections timed out; NIST returned `FETCH_BLOCKED`; the initial Gemini function-calling URL returned a language redirect, resolved with `hl=en`. CLI extraction was bounded at its default length, and only relevant documentation sections were relied on. No benchmark corpus or authoritative control-pack download was obtained during this planning revision.
- **Browser fallback:** none. No email was sent and no authenticated Gemini call was made.

These results support the design and record what remains to acquire; they do not constitute a completed benchmark-content audit.
