# Research direction and evaluation

Prooflane investigates whether tested, reviewed adaptation can make unfamiliar configuration formats useful without creating unsupported assurance. The contribution to measure is improved interpretation with a fixed reference and reviewer budget. Configuration analysis, model-written reports and pre-change validation are established capabilities.

## Relevant work

| Reference | Established capability | Implication |
| --- | --- | --- |
| [Batfish](https://github.com/batfish/batfish) | Configuration analysis, reachability and change validation | Compare overlapping supported tasks; a dashboard alone is not a novel result |
| [NetConfEval](https://github.com/RedHatResearch/conext24-NetConfEval) | Evaluation tasks for language models and network configuration | Use reproducible tasks and distinguish translation from security correctness |

The associated paper is [Can LLMs Facilitate Network Configuration?](https://doi.org/10.1145/3656296). This is a targeted reference review, not an exhaustive literature, product or patent survey.

## Testable hypothesis

With equal documentation, model access and human annotation budgets, targeted clarification and test-gated mapping updates may improve useful coverage on held-out configurations while controlling false compliant verdicts.

The application implements bounded proposals, test execution, explicit approval and versioned reuse. It does not yet establish a performance advantage over competing approaches.

## Evaluation design

- Hold out whole configuration families or firmware branches. Keep related templates and mutations in one split.
- Compare fixed parsers, a direct model with identical references, and the complete reviewed workflow.
- Remove clarification, testing and version gates separately to measure their contribution.
- Measure false passes, false failures, coverage, reviewer effort, regressions, latency and provider usage.
- Use independently checked expected outcomes. Synthetic cases establish workflow behavior, not universal device correctness.

Success needs better supported decisions, not merely fewer unknowns. Unsupported inheritance, missing scope and conflicting evidence must stay visible. Proposed corrections require device and operational review; the product does not execute them on live equipment.
