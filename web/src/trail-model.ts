import type { RecordItem } from './api';

export type StageId = 'snapshot' | 'policy' | 'normalize' | 'evaluate' | 'report' | 'investigate' | 'review';
export type TrailStage = { id: StageId; title: string; short: string; state: 'recorded' | 'attention' | 'active' | 'pending' | 'optional' | 'failed'; status: string; summary: string; explanation: string; timestamp?: string };
export const connections: [StageId, StageId][] = [
  ['snapshot', 'normalize'], ['policy', 'evaluate'], ['normalize', 'evaluate'],
  ['evaluate', 'report'], ['evaluate', 'investigate'], ['investigate', 'review'],
];

// The diagram describes artifact dependencies, not a measured execution clock.
export function auditStages(audit: RecordItem): TrailStage[] {
  const normalized = !!audit.normalization;
  const evaluated = Array.isArray(audit.findings);
  const investigation = audit.investigation ?? audit.agent_checkpoint;
  const unknown = audit.counts?.insufficient_evidence ?? 0;
  const fail = audit.counts?.fail ?? 0;
  const busy = ['running', 'queued', 'retry', 'report_pending'].includes(audit.status ?? '');
  const learning = busy && /investigat|tool step|learn/i.test(audit.progress ?? '');
  const stages: TrailStage[] = [
    { id: 'snapshot', title: 'Input snapshot', short: 'Snapshot', state: audit.input_sha256 ? 'recorded' : 'pending', status: audit.input_sha256 ? 'Preserved' : 'Not recorded', summary: audit.vendor?.toUpperCase() ?? 'Unknown vendor', timestamp: audit.created_at,
      explanation: 'The preserved configuration is the common source for this assessment. Its content hash binds the findings to a specific input.' },
    { id: 'policy', title: 'Policy snapshot', short: 'Policy', state: audit.policy ? 'recorded' : 'pending', status: audit.policy ? 'Pinned version' : 'Not recorded', summary: audit.policy ? `${audit.policy.framework} / ${audit.policy.version}` : 'No policy snapshot',
      explanation: 'The audit captures the selected rule version. These rules define expected values; they do not change when the policy library is edited.' },
    { id: 'normalize', title: 'Configuration interpretation', short: 'Interpret', state: normalized ? 'recorded' : busy && !learning ? 'active' : 'pending', status: normalized ? 'Facts captured' : busy && !learning ? audit.status === 'running' ? 'Running' : 'Queued' : 'Not reached', summary: normalized ? `${Object.keys(audit.normalization?.facts ?? {}).length} facts` : 'Waiting for interpretation',
      explanation: 'Native parsing and the captured approved mappings turn supported settings into typed facts with source lines. Unrecognized syntax remains explicit.' },
    { id: 'evaluate', title: 'Rule evaluation', short: 'Evaluate', state: evaluated ? fail || unknown ? 'attention' : 'recorded' : 'pending', status: evaluated ? fail || unknown ? 'Review findings' : 'Evaluated' : 'Not reached', summary: evaluated ? `${fail} fail / ${unknown} unknown` : 'Waiting for facts', timestamp: audit.evaluated_at,
      explanation: 'Each applicable rule compares an observed fact with its expected value. Missing evidence stays unknown and never becomes a passing check.' },
    { id: 'report', title: 'Device report', short: 'Report', state: audit.report ? 'recorded' : busy && evaluated && !learning ? 'active' : 'pending', status: audit.report ? 'Artifact ready' : busy && evaluated && !learning ? 'Preparing' : 'Not reached', summary: audit.report ? `${(audit.report.size / 1024).toFixed(1)} KiB PDF` : 'No report artifact', timestamp: audit.completed_at,
      explanation: 'The report preserves the evaluation for this audit. A later investigation adds review material; it does not silently rewrite this result.' },
    { id: 'investigate', title: 'Gemini investigation', short: 'Investigate', state: learning ? 'active' : investigation ? 'recorded' : 'optional', status: learning ? audit.status === 'running' ? 'Running' : 'Queued' : investigation ? 'Trace saved' : 'Not run', summary: investigation ? `${investigation.trace.length} tool calls` : 'Optional evidence branch',
      explanation: 'The agent searches authorized references, tests mapping proposals and asks for clarification. Inspect the actual tool responses, including empty results and errors.' },
    { id: 'review', title: 'Human review gate', short: 'Review', state: investigation ? 'attention' : 'optional', status: investigation ? 'Review required' : 'Not reached', summary: investigation ? `${investigation.questions.length} clarification questions` : 'Requires investigation material',
      explanation: 'An agent response is not an approval. Mapping tests and reviewer activation happen in Training & review; a new audit applies the approved version.' },
  ];
  if ((audit.status === 'failed' || audit.status === 'retry') && audit.failed_stage) {
    const target = audit.failed_stage === 'learn' ? 'investigate' : audit.failed_stage === 'report' ? 'report' : normalized ? 'evaluate' : 'normalize';
    const stage = stages.find(item => item.id === target)!;
    stage.state = audit.status === 'retry' ? 'active' : 'failed';
    stage.status = audit.status === 'retry' ? 'Retry queued' : 'Failed';
    stage.summary = audit.error ?? audit.progress ?? 'Inspect the preserved evidence';
  }
  return stages;
}

export const displayValue = (value: unknown) => value === null || value === undefined ? 'Unknown' : typeof value === 'object' ? JSON.stringify(value) : String(value);
