# SIH 2026: novelty-led audit with the one-day constraint removed

**Single recommendation: SIH26155 — AI-Driven Multi-Vendor Network Security Compliance Auditor. Last observed count: 46/500, Software.**

The strongest direction is a configuration-learning agent whose new mappings must pass executable checks before they can support a compliance decision. Its competitive claim should concern learning unfamiliar configuration semantics efficiently and avoiding unsupported compliance verdicts. Multi-vendor auditing, AI-written reports, digital twins and pre-change verification are already established capabilities.

**Alternative from the original shortlist: SIH26164 — Enterprise Cryptographic Discovery & Analysis Tool, 55/500.** Its strongest version connects discovery to reproducible migration experiments, compatibility evidence and reviewable migration decisions.

**Ambitious research alternative: SIH26228 — Trustworthy Computer Vision Integrity Assurance for Data, Models and Inference Outputs in Multi-Contributor Pipelines, 35/500.** This was previously excluded for delivery difficulty. Removing the time limit makes it worth reconsidering, but its full offline requirement conflicts with the previously chosen hosted-API runtime. It is a conditional alternative, not a recommendation to ignore that constraint.

These counts come from the official snapshot captured on 28 September 2026 at 08:43:55 IST; SIH26155 was rechecked at approximately 08:55. They were not refreshed in this audit. The source is https://www.sih.gov.in/sih2026PS. The interface counts submitted ideas, not unique accounts or teams.

## What changed in the decision

The previous recommendation for the polar portal optimised completion of a coherent application and presentation within one day. That is no longer the objective. This audit prioritises:

1. A substantive technical contribution beyond established tools and common application patterns.
2. A clear way to demonstrate improvement against credible alternatives.
3. A central role for an agent in investigation, tool use, uncertainty resolution and constrained decision-making.
4. An implementation whose correctness and limitations can be inspected.
5. Low current participation, while recognising that count does not reveal competitor quality.

No statement makes an implementation unbeatable. The defensible aim is to outperform named baselines on a declared scope with reproducible evidence. The mechanisms proposed below are research and engineering hypotheses; they have not yet been implemented or demonstrated to outperform the baselines.

## Existing work changes what we can claim as novel

| Source inspected | Capability already documented | Implication for this team |
|---|---|---|
| [Batfish README](https://raw.githubusercontent.com/batfish/batfish/master/README.md) | Multi-vendor configuration analysis, compliance checks, pre-deployment change validation, reachability analysis and functional equivalence across configurations/vendors | A multi-vendor auditor, digital twin or safe-change preview alone is not a new contribution |
| [NetConfEval research repository](https://raw.githubusercontent.com/RedHatResearch/conext24-NetConfEval/main/README.md) | Benchmarks for LLM translation of requirements into formal specifications, API calls, routing functions and low-level configurations | LLM tool calling and natural-language network configuration are established research topics |
| [CBOMkit README](https://raw.githubusercontent.com/IBM/cbomkit/main/README.md) | Cryptographic inventory generation from repositories, visualisation, compliance policies, storage and APIs | A cryptographic scanner and quantum-risk dashboard would face a strong existing baseline |
| [Adversarial Robustness Toolbox README](https://raw.githubusercontent.com/Trusted-AI/adversarial-robustness-toolbox/main/README.md) | ML evaluation/defence tools for evasion, poisoning, extraction and inference, across frameworks and tasks | An AI-assurance app must add demonstrated value beyond packaging existing tests |

The NetConfEval repository identifies its associated 2024 paper, [Can LLMs Facilitate Network Configuration?](https://doi.org/10.1145/3656296). The repository documentation was inspected; the full paper and all related literature were not reviewed. These four sources are a targeted baseline audit, not an exhaustive product, academic or patent search. An absent feature in a README is not evidence that nobody has implemented it elsewhere.

## Audit of the original six recommendations

| Statement | Last observed ideas | Novelty-led decision | Reason |
|---|---:|---|---|
| **SIH26155 — Network compliance auditor** | **46** | **Select, with a focused technical contribution** | There is a measurable challenge in adapting to unfamiliar syntax/semantics without creating false assurance. The official brief explicitly requires interactive learning of unseen formats |
| **SIH26164 — Cryptographic discovery** | **55** | **Retain as the principal alternative** | Discovery alone is established; evidence-linked compatibility and migration experiments offer a stronger agentic direction |
| SIH26063 — Polar archive/outreach | 40 | Remove from the top novelty shortlist | Archive, retrieval, drafting and editorial review can form a good product, but its previous advantage was delivery completeness. The concept has a less distinctive technical centre |
| SIH26097 — Voice livelihood/skilling assistant | 48 | Remove from the top novelty shortlist | Voice interviews, recommendations and regional-language delivery are useful but familiar. Strong local opportunity data and measured outcomes could create differentiation, but neither is currently available to this team |
| SIH26035 — OIML R76 reporting | 55 | Keep only for metrology expertise | Low broad appeal is not the same as high novelty. Standards automation and accurate report generation are valuable engineering; a central new agentic mechanism is less evident |
| SIH26019 — Land-governance research platform | 58 | Remove from the top shortlist | A broad collection of research, GIS and policy features lacks a focused technical advantage. A causal policy-evaluation contribution could be interesting, but would need data and validation well beyond a general research assistant |

Other earlier contenders were reconsidered. SIH26157 has a strong supervisory reasoning problem, but requires offline operation and expert-reviewed assessment data. SIH26121 offers a compelling well-intelligence agent but has unresolved access to meaningful drilling history and predictive ground truth. SIH26237 is a cryptographic/watermarking research project with offline requirements and a less central language-agent role. Lower counts do not resolve those dependencies.

## Winner: SIH26155

### Proposed idea

**An adaptive network compliance agent that learns unfamiliar configuration semantics through targeted questions and executable tests, then produces evidence-linked findings and checked remediation proposals.**

The official requirement already includes a vendor-neutral schema and an interactive training interface. We must go beyond demonstrating that an administrator can label a line. The proposed contribution is making those learned mappings reliable, reusable and measurably cheaper to establish.

**Research hypothesis:** with the same documentation and human-annotation budget, targeted clarification plus test-gated mapping updates can increase correct coverage on unseen vendor/firmware configurations while controlling the rate of false compliant verdicts, relative to fixed parsers and a direct LLM/RAG auditor.

That is a claim we can test. It is not a claim that this combination is globally unprecedented.

### How the implementation should work

1. **Preserve the evidence.** Store the input snapshot, vendor/OS evidence, source-line locations, relevant documentation version, applicable benchmark version and every mapping revision. Treat configuration text and retrieved documents as untrusted data, not instructions to the agent.

2. **Build an explicit semantic model.** Represent supported controls as typed facts with scope, inheritance/default assumptions and evidence. Distinguish absent configuration, an explicitly disabled setting, an inherited setting and an unsupported setting. Avoid treating a keyword match as a compliance decision.

3. **Ask questions that resolve consequential ambiguity.** When uncertain, the agent selects the clarification that resolves the most relevant control uncertainty for the least reviewer effort. For example, it should investigate an ambiguous inherited management-access rule before a low-impact naming difference. This selection strategy must be compared with simpler alternatives such as random sampling or basic uncertainty sampling.

4. **Test mappings before promoting them.** A proposed mapping receives declared scope and executable cases covering nesting, negation, defaults, reordered input and version differences where relevant. Expert-labelled examples or a valid independent test environment provide the expected answers. Mutations are useful robustness tests, but a generated mutation is not automatically a valid ground-truth configuration. Failed or insufficiently supported mappings remain provisional.

5. **Evaluate versioned rules deterministically.** The agent may help retrieve and structure a rule, but a reviewed, versioned evaluator determines the supported pass/fail result. The result vocabulary should include insufficient evidence, unsupported and not applicable. Passing selected device checks is not certification of an organisation against an entire framework.

6. **Produce a constrained remediation proposal.** Generate a minimal reviewable change, rerun applicable checks and examine relevant operational invariants. Use established verification tools where their feature/vendor coverage is sufficient. Batfish's existing change-analysis capability is a component we can reuse, not a contribution we should claim to have invented.

7. **Declare coverage honestly.** A vendor-neutral JSON representation does not automatically give an existing simulator support for a new vendor. For unsupported syntax or behaviour, report the unverified property. Do not turn a successful subset of tests into an unrestricted claim of safety.

8. **Persist validated knowledge.** Keep mappings and regressions versioned, scoped to the tested families/versions and attributable to reviewers. Detect when new firmware input no longer matches the conditions under which a mapping was accepted.

### A concrete example

An administrator provides configuration snapshots from supported devices and a new OS version. The agent encounters a management-access setting whose meaning depends on inherited context. It retrieves the matching documentation, identifies the ambiguity and asks a targeted question. The resulting interpretation is tested against labelled cases including a negated form and an inherited default.

Only after those checks pass does the mapping become usable for the declared scope. The auditor finds a supported non-compliance, shows the exact input evidence and proposes a change. The applicable verification layer checks the relevant access and reachability invariants. If it cannot establish an invariant, the output says what remains unverified and requests review.

The distinguishing result is the validated adaptation process and its measured error/effort tradeoff. A chat transcript, a generated PDF or a simulated network alone would not establish that advantage.

### What would make it hard to outperform on the chosen task

The assets to build are a carefully labelled configuration corpus, difficult semantic cases, a scoped rule library, a versioned set of learned mappings and reproducible benchmark results. A larger model or a more polished UI does not automatically reproduce those results. Another team can still outperform them; the implementation earns its position through evidence.

Use a disciplined evaluation design:

| Question | Test | Metric |
|---|---|---|
| Does it generalise to unfamiliar input? | Hold out entire vendor families or firmware versions from development; keep template-related configurations together | Correct supported-field/control coverage and onboarding effort |
| Does it create false assurance? | Use independently labelled compliant, non-compliant and insufficient-evidence cases | False compliant verdict rate, false failures and accuracy at matched coverage |
| Are clarifications useful? | Give alternatives equal documentation access and annotation budgets | Reviewer questions/minutes required for a given correctness level |
| Do mapping updates help? | Evaluate on fresh cases after the update, then run regression cases | Improvement on held-out inputs and regressions introduced |
| Are changes reliable? | Check proposed changes against known control outcomes and supported operational invariants | Successful repairs, collateral violations and unresolved properties |
| Is the agent necessary? | Remove targeted questioning, mapping tests or the agent's selection policy one at a time | Change in error/coverage/effort relative to the full system |
| Is the system practical? | Run repeated configurations and new-format onboarding separately | Latency, cost, throughput and reviewer effort |

Report the sample sizes and scope. A zero-error result on a finite benchmark does not prove universal safety. A system that abstains on every hard case does not win: compare error and useful coverage together.

**Baselines:** a hand-written parser/rule approach, the same capable LLM with the same documentation and a straightforward RAG prompt, and a relevant established configuration-analysis workflow on supported devices. Batfish is not a universal competitor for every requested control; use it where the tasks overlap. NetConfEval provides related evaluation ideas and tasks, but does not by itself constitute an end-to-end benchmark for this new compliance-learning claim.

Do not train and test on paraphrases of the same configurations, let the LLM grade its own correctness, or compare an unsupported baseline with a supported system and call the result general superiority. None of these experiments has been run yet.

## Principal alternative: SIH26164

### Proposed idea

**An evidence-linked post-quantum migration workbench that connects discovery to compatibility-tested migration plans.**

CBOMkit already supplies inventory generation, viewing and policy evaluation. The project needs a substantial increment beyond those capabilities.

The strongest version would:

1. Correlate cryptographic assets found in source, dependencies, certificates and controlled build/runtime evidence.
2. Link each asset to its protocol role, consumer compatibility, data lifetime and business importance.
3. Identify where migration is blocked by a dependency, peer implementation, protocol or unavailable algorithm support.
4. Propose supported migration candidates and test them in a controlled copy of a representative application or service.
5. Measure correctness, interoperability, latency, payload size and resource use before recommending a reviewable plan.

Keep key encapsulation, signatures, hashing and symmetric encryption distinct. A recommendation to replace every RSA or elliptic-curve occurrence with an arbitrary post-quantum algorithm is not a valid migration strategy. Use standardised primitives and supported implementations; the invention should be the planning and verification workflow rather than homemade cryptography.

**Testable contribution:** compared with an inventory-plus-policy report, the workbench identifies more actionable migration steps and fewer incompatible recommendations while exposing the evidence and assumptions behind each step. Candidate advantages include reduced manual investigation and stronger connection between discovered code and real application behaviour.

Its strongest benchmark would use known cryptographic assets and multiple controlled application/dependency versions with both successful and deliberately incompatible migration candidates. Compare discovery accuracy, recommendation correctness and validated migration outcomes. The inspected CBOMkit documentation does not establish that no other commercial or research tool already offers migration testing; the novelty remains a hypothesis requiring wider validation.

Choose this over SIH26155 if the team prefers application security, cryptography and build/test automation to network configuration semantics.

## Ambitious conditional alternative: SIH26228

### Proposed idea

**An adaptive AI-assurance examiner that selects the next diagnostic test from current evidence and a compute budget, then issues an auditable assurance report across the dataset, model and inference record.**

The official brief requires five capabilities: training-data integrity, model integrity, cryptographic inference provenance, distribution-shift/anomaly assessment, and analyst-facing governance. The complete workflow must run offline. Public or team-generated datasets/models and reproducible test scenarios are explicitly permitted, making it less dependent on private operational data than the well-intelligence or SOC-supervision projects.

ART already offers a substantial ML-security toolkit. A dashboard around standard tests would therefore be an incremental implementation. The proposed research contribution is an adaptive test-selection strategy that obtains useful evidence efficiently and calibrates its conclusions.

For example, an initial anomaly may have several explanations: benign distribution shift, labelling errors, duplicated data or suspicious model behaviour. The examiner selects a supported diagnostic, updates its assessment and decides whether another test is worth its cost. It should not label an issue a malicious backdoor solely because an anomaly detector fired.

Compare the adaptive strategy with fixed test suites and simple selection policies under matched compute budgets. Report detection/false-alarm tradeoffs, coverage across declared scenarios, calibration, audit cost and ablations. Test on held-out architectures and perturbation/attack families where the assumptions allow. Broad “all attacks detected” claims would be unjustified.

Cryptographic record binding should detect declared tampering/replay cases and identify the associated input/model/configuration; it does not establish the model's correctness or trustworthiness by itself. Preserve that distinction in the report.

This has a high research ceiling and substantial uncertainty. It requires local models/tools and appropriate ML-security expertise. Ordinary laptops may support small experiments, but larger model audits will have additional compute needs. Hosted AI APIs cannot be part of the required offline deployed workflow.

## Choice and decision boundary

**For the team's existing hosted-API setup and agentic preference, select SIH26155.** Its strongest technical objective is clear, its improvement can be measured, and it aligns with the official requirement to learn unfamiliar vendor formats.

Keep SIH26164 as the alternative if the team has stronger application/cryptography expertise. Consider SIH26228 only if the team consciously switches to offline inference and accepts a research-heavy validation programme. Removing the one-day limit changes its feasibility consideration; it does not remove the organiser's deployment constraints.

Before committing months of work, verify the proposed contribution on a small but genuinely held-out evaluation. If validated semantic learning does not improve the error/coverage/annotation tradeoff over a strong LLM/RAG baseline, do not defend the novelty using the number of agents or the UI. Refine the mechanism or choose a different problem.

## Search summary and limits

- Commands: `webcmd --version`; `webcmd web fetch --url ... --timeout 20 --max-chars ...`; local reads of captured official SIH descriptions. No benchmark or competitor implementation was executed.
- Substantive primary sources fetched: Batfish, CBOMkit, ART and NetConfEval repository READMEs linked above.
- Discovery: the GitHub repository search API identified `RedHatResearch/conext24-NetConfEval`. DuckDuckGo returned an unhelpful redirect page and Bing returned irrelevant results; neither was used as substantive evidence.
- Browser fallback: none for the competitive-source research. Raw repository documents provided the evidence after a GitHub page was empty/blocked and the Batfish homepage fetch stalled and was stopped.
- Gaps: no exhaustive academic/patent/commercial-product survey, no access to other teams' submissions, no fresh SIH count collection, and no demonstrated performance advantage yet. The verified existing capabilities constrain the claims; the proposed remaining opportunities are explicitly hypotheses.
