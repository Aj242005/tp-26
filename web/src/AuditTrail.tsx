/* Spatial extension of the evidence console: a machined pipeline, legible labels,
   and a synchronized inspector. Geometry represents recorded dependencies;
   replay is a guided walkthrough, never an invented execution clock. */
import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowRight, Box, ChevronLeft, ChevronRight, Download, FileText, Layers, Maximize2, Minus, Pause, Play, Plus, ScanLine, Search, Workflow } from 'lucide-react';
import { date, type RecordItem } from './api';
import { Badge, Coverage } from './components';
import { auditStages, displayValue, type StageId, type TrailStage } from './trail-model';
import type { SceneCommand, SceneProps } from './TrailScene';
import './trail.css';

type Props = { audit: RecordItem; canViewSource: boolean; onOpenFinding: (id: string) => void; onOpenSource: (line: number) => void; onOpenInvestigation: () => void };

export default function AuditTrail(props: Props) {
  const { audit } = props;
  const stages = useMemo(() => auditStages(audit), [audit]);
  const [selected, setSelected] = useState<StageId>(audit.findings ? 'evaluate' : 'snapshot');
  const [mode, setMode] = useState<'3d' | 'flat'>(() => window.matchMedia('(max-width: 640px)').matches ? 'flat' : '3d');
  const [Scene, setScene] = useState<ComponentType<SceneProps> | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [command, setCommand] = useState<SceneCommand>({ action: 'reset', tick: 0 });
  const stageButtons = useRef(new Map<StageId, HTMLButtonElement>());
  const inspector = useRef<HTMLElement>(null);
  const current = stages.find(stage => stage.id === selected)!;
  const index = stages.indexOf(current);
  const recorded = stages.filter(stage => !['optional', 'pending'].includes(stage.state));
  useEffect(() => {
    if (inspector.current) inspector.current.scrollTop = 0;
    const button = stageButtons.current.get(selected), rail = button?.parentElement;
    if (button && rail) {
      const item = button.getBoundingClientRect(), container = rail.getBoundingClientRect();
      if (item.left < container.left || item.right > container.right) rail.scrollLeft += item.left - container.left - 15;
    }
  }, [selected]);

  useEffect(() => {
    if (mode !== '3d' || Scene) return;
    let cancelled = false;
    import('./TrailScene').then(module => { if (!cancelled) setScene(() => module.default); }).catch(() => { if (!cancelled) { setUnavailable(true); setMode('flat'); } });
    return () => { cancelled = true; };
  }, [mode, Scene]);
  useEffect(() => {
    if (!playing) return;
    const next = recorded.findIndex(stage => stage.id === selected) + 1;
    const timer = window.setTimeout(() => { if (next >= recorded.length) setPlaying(false); else setSelected(recorded[next].id); }, 1800);
    return () => window.clearTimeout(timer);
  }, [playing, selected, stages]);
  useEffect(() => {
    const pause = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener('visibilitychange', pause);
    return () => document.removeEventListener('visibilitychange', pause);
  }, []);
  function select(id: StageId) { setPlaying(false); setSelected(id); }
  function move(delta: number) { select(stages[Math.max(0, Math.min(stages.length - 1, index + delta))].id); }
  function sceneCommand(action: SceneCommand['action']) { setCommand(value => ({ action, tick: value.tick + 1 })); }
  function replay() { if (playing) setPlaying(false); else if (recorded.length) { setSelected(recorded[0].id); setPlaying(true); } }

  return <section className="surface audit-trail" aria-label="Interactive audit trail">
    <header className="trail-head"><div><span className="trail-kicker"><Workflow size={15} /> Spatial audit debugger</span><h2>Follow the evidence.</h2><p>From preserved input to a reviewable decision. Select a stage to look inside.</p></div><div className="segmented" aria-label="Trail display"><button className={mode === '3d' ? 'selected' : ''} aria-pressed={mode === '3d'} onClick={() => { setUnavailable(false); setMode('3d'); }}><Box size={15} /> 3D view</button><button className={mode === 'flat' ? 'selected' : ''} aria-pressed={mode === 'flat'} onClick={() => setMode('flat')}><Layers size={15} /> Flat view</button></div></header>
    {unavailable && <div className="notice trail-fallback" role="status">3D rendering is unavailable here. All stages and evidence remain available in the flat view.</div>}
    <div className="trail-workbench"><div className="trail-map-column">
      <div className={`trail-stage ${mode === 'flat' ? 'is-flat' : ''}`}>
        <div className="trail-scene-heading"><span className="mono">AUDIT / {audit.id.slice(0, 8)}</span><span>Artifact lineage</span></div>
        {mode === '3d' ? Scene ? <Scene stages={stages} selected={selected} onSelect={select} onUnavailable={() => { setUnavailable(true); setMode('flat'); }} command={command} /> : <div className="trail-scene-loading" role="status"><Box size={32} /><span>Preparing spatial view…</span></div> : <div className="trail-flat" aria-label="Audit stage diagram">{stages.map((stage, step) => <button key={stage.id} className={`trail-flat-node ${stage.state} ${selected === stage.id ? 'selected' : ''}`} aria-pressed={selected === stage.id} onClick={() => select(stage.id)}><span className="trail-flat-number">{String(step + 1).padStart(2, '0')}</span><span><strong>{stage.title}</strong><small>{stage.summary}</small></span><span className={`trail-state ${stage.state}`}>{stage.status}</span><ChevronRight size={16} /></button>)}</div>}
        <div className="trail-map-footer"><span>{mode === '3d' ? 'Drag to orbit · right-drag to pan' : 'Select any stage to inspect its evidence'}</span>{mode === '3d' && <div className="trail-view-controls"><button aria-label="Zoom out of audit trail" onClick={() => sceneCommand('out')}><Minus size={16} /></button><button aria-label="Zoom into audit trail" onClick={() => sceneCommand('in')}><Plus size={16} /></button><button aria-label="Reset audit trail camera" onClick={() => sceneCommand('reset')}><Maximize2 size={16} /></button></div>}</div>
      </div>
      <div className="trail-legend"><span><i className="trail-dot recorded" /> Recorded</span><span><i className="trail-dot attention" /> Review / gaps</span><span><i className="trail-dot optional" /> Pending / optional</span><span className="trail-legend-note">Connections show evidence dependencies</span></div>
      <button className="trail-inspect-jump" onClick={() => inspector.current?.focus()}>{current.title}<span>Inspect evidence <ArrowDown size={14} /></span></button>
      <div className="trail-transport"><button className="button secondary small" onClick={replay} disabled={!recorded.length}>{playing ? <Pause size={14} /> : <Play size={14} />}{playing ? 'Pause replay' : 'Replay trail'}</button><div className="trail-step-controls"><button className="icon-button" aria-label="Previous audit stage" disabled={index === 0} onClick={() => move(-1)}><ChevronLeft size={16} /></button><span className="mono">{index + 1} / {stages.length}</span><button className="icon-button" aria-label="Next audit stage" disabled={index === stages.length - 1} onClick={() => move(1)}><ChevronRight size={16} /></button></div><span className="trail-replay-note">Guided sequence · not elapsed time</span></div>
      <div className="trail-stage-rail" role="group" aria-label="Select audit stage" onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const step = event.key === 'Home' ? 0 : event.key === 'End' ? stages.length - 1 : Math.max(0, Math.min(stages.length - 1, index + (event.key === 'ArrowRight' ? 1 : -1)));
        select(stages[step].id); stageButtons.current.get(stages[step].id)?.focus();
      }}>{stages.map((stage, step) => <button key={stage.id} ref={node => { if (node) stageButtons.current.set(stage.id, node); else stageButtons.current.delete(stage.id); }} aria-label={`Inspect ${stage.title}`} aria-pressed={selected === stage.id} className={selected === stage.id ? 'selected' : ''} onClick={() => select(stage.id)}><span className={`trail-dot ${stage.state}`} /><span>{String(step + 1).padStart(2, '0')}</span><strong>{stage.short}</strong></button>)}</div>
    </div><aside ref={inspector} tabIndex={-1} className="trail-inspector" aria-label="Selected audit stage"><div className="trail-inspector-heading"><span className="mono">{String(index + 1).padStart(2, '0')} / INSPECTOR</span><span className={`trail-state ${current.state}`}>{current.status}</span></div><h3>{current.title}</h3><p>{current.explanation}</p>{current.timestamp && <div className="trail-timestamp"><span>Recorded</span><time dateTime={current.timestamp}>{date(current.timestamp)}</time></div>}{current.state === 'failed' && <div className="error-box">{audit.error ?? audit.progress ?? 'This stage did not finish.'}</div>}<StageEvidence key={selected} {...props} stage={current} /></aside></div>
    <div className="sr-only" role="status" aria-live="polite">Stage {index + 1}: {current.title}. {current.status}.</div>
  </section>;
}

function StageEvidence({ audit, stage, canViewSource, onOpenFinding, onOpenSource, onOpenInvestigation }: Props & { stage: TrailStage }) {
  const [filter, setFilter] = useState('all');
  const [factPage, setFactPage] = useState(0);
  const investigation = audit.investigation ?? audit.agent_checkpoint;
  const facts = Object.entries(audit.normalization?.facts ?? {});
  const findings = (audit.findings ?? []).filter(row => filter === 'all' || row.verdict === filter);
  const sourceButton = (line = 1) => <button className="button secondary small" disabled={!canViewSource} onClick={() => onOpenSource(line)}><FileText size={14} /> {line === 1 ? 'Open configuration' : `Open line ${line}`}</button>;
  if (stage.id === 'snapshot') return <><dl className="trail-properties"><div><dt>Configuration</dt><dd>{audit.name}</dd></div><div><dt>Device record</dt><dd className="mono">{audit.device_id ?? 'Not recorded'}</dd></div><div><dt>Source SHA-256</dt><dd className="mono trail-hash">{audit.input_sha256 ?? 'Not recorded'}</dd></div><div><dt>Declared scope</dt><dd>{audit.normalization ? audit.normalization.complete_declared ? 'Complete snapshot, declared by uploader' : 'Partial / completeness not declared' : 'Available after interpretation'}</dd></div></dl>{sourceButton()}{!canViewSource && <p className="trail-small-note">The auditor role is required to view source configuration.</p>}{audit.synthetic && <div className="trail-inline-note">Synthetic example · not a live network scan.</div>}</>;
  if (stage.id === 'policy') return <><dl className="trail-properties"><div><dt>Captured policy</dt><dd>{audit.policy?.name ?? 'Not recorded'}</dd></div><div><dt>Framework / version</dt><dd>{audit.policy?.framework ?? '—'} / <span className="mono">{audit.policy?.version ?? '—'}</span></dd></div><div><dt>Declared checks</dt><dd className="mono">{audit.policy?.rules.length ?? 0}</dd></div></dl><p className="trail-small-note">{audit.policy?.scope}</p>{audit.policy && <details className="trail-disclosure"><summary>Inspect captured rule definitions</summary><pre className="trail-json">{JSON.stringify(audit.policy.rules, null, 2)}</pre></details>}<Link className="button secondary small" to="/policies">Open policy library <ArrowRight size={14} /></Link></>;
  if (stage.id === 'normalize') return <><dl className="trail-properties compact"><div><dt>Normalizer</dt><dd className="mono">{audit.normalization?.native_version ?? 'Not recorded'}</dd></div><div><dt>Facts / unrecognized lines</dt><dd>{facts.length} / {audit.normalization?.unrecognized_count ?? '—'}</dd></div></dl><h4>Captured mappings <span>{audit.mapping_snapshot?.length ?? 0}</span></h4>{audit.mapping_snapshot?.length ? audit.mapping_snapshot.map(mapping => <details className="trail-disclosure" key={mapping.id}><summary>{mapping.spec.name}<small className="mono">{mapping.version}</small></summary><dl className="trail-properties"><div><dt>Fact / selector</dt><dd>{mapping.spec.fact}<br /><code>{mapping.spec.selector}</code></dd></div><div><dt>Mapping record</dt><dd className="mono">{mapping.id}</dd></div></dl></details>) : <p className="trail-small-note">No approved mappings were captured for this audit.</p>}<h4>Source-backed facts <span>{facts.length}</span></h4>{facts.slice(factPage * 6, factPage * 6 + 6).map(([name, fact]) => <details className="trail-disclosure" key={name}><summary><span className="mono">{name}</span><small>{displayValue(fact.value)}</small></summary><p>{fact.reason}</p><dl className="trail-properties"><div><dt>Origin / scope</dt><dd>{fact.origin} / {fact.scope ?? 'Not recorded'}</dd></div><div><dt>Cited lines</dt><dd>{fact.lines.join(', ') || 'No explicit source lines'}</dd></div></dl>{fact.lines.length > 0 && sourceButton(fact.lines[0])}</details>)}{facts.length > 6 && <div className="trail-pagination"><button className="button text small" disabled={factPage === 0} onClick={() => setFactPage(factPage - 1)}>Previous facts</button><span>{factPage + 1} / {Math.ceil(facts.length / 6)}</span><button className="button text small" disabled={(factPage + 1) * 6 >= facts.length} onClick={() => setFactPage(factPage + 1)}>Next facts</button></div>}{!audit.normalization && <p className="trail-small-note">Interpretation results have not been saved yet.</p>}</>;
  if (stage.id === 'evaluate') return <>{audit.coverage !== undefined && <Coverage value={audit.coverage} />}<div className="trail-verdicts"><div><span className="status-dot pass" />Pass<strong>{audit.counts?.pass ?? '—'}</strong></div><div><span className="status-dot fail" />Fail<strong>{audit.counts?.fail ?? '—'}</strong></div><div><span className="status-dot unknown" />Unknown<strong>{audit.counts?.insufficient_evidence ?? '—'}</strong></div></div>{!!audit.counts?.not_applicable && <p className="trail-small-note">{audit.counts.not_applicable} checks are not applicable.</p>}<label className="trail-filter"><Search size={14} /><span className="sr-only">Filter trail findings</span><select aria-label="Filter trail findings" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">All findings</option><option value="fail">Failing checks</option><option value="insufficient_evidence">Missing evidence</option><option value="pass">Passing checks</option></select></label><div className="trail-finding-list">{findings.map(finding => <button key={finding.id} onClick={() => onOpenFinding(finding.id)}><div><span className="mono">{finding.id}</span><Badge value={finding.verdict} /></div><strong>{finding.title}</strong><small>{displayValue(finding.observed)} <ArrowRight size={11} /> {displayValue(finding.expected)}</small></button>)}</div>{!findings.length && <p className="trail-small-note">{audit.findings ? 'No findings match this filter.' : 'Evaluation results have not been saved yet.'}</p>}</>;
  if (stage.id === 'report') return audit.report ? <><dl className="trail-properties"><div><dt>Artifact size</dt><dd>{audit.report.size.toLocaleString()} bytes</dd></div><div><dt>Report SHA-256</dt><dd className="mono trail-hash">{audit.report.sha256}</dd></div><div><dt>Evaluation recorded</dt><dd>{date(audit.evaluated_at)}</dd></div></dl><a className="button secondary" href={`/api/audits/${audit.id}/export/pdf`}><Download size={15} /> Download device PDF</a><div className="trail-inline-note">This PDF reflects the recorded evaluation. New mappings require a new audit.</div></> : <div className="trail-empty"><FileText size={24} /><p>The report artifact is not available yet.</p></div>;
  if (stage.id === 'investigate') return <>{investigation ? <><dl className="trail-properties compact"><div><dt>Model</dt><dd className="mono">{investigation.model}</dd></div><div><dt>Provider-reported tokens</dt><dd>{investigation.tokens.toLocaleString()}</dd></div></dl>{audit.investigation && <p>{audit.investigation.summary}</p>}<h4>Recorded tool calls <span>{investigation.trace.length}</span></h4>{investigation.trace.map((entry, step) => <details className="trail-disclosure trail-tool" key={step}><summary><span><small className="mono">CALL {step + 1} · STEP {entry.step}</small><strong>{entry.tool.replaceAll('_', ' ')}</strong></span>{entry.result?.error ? <Badge value="failed" /> : entry.result?.sources ? <span className="trail-tool-count">{entry.result.sources.length} sources</span> : entry.result?.passed !== undefined ? <Badge value={entry.result.passed ? 'pass' : 'fail'} /> : <ChevronRight size={14} />}</summary>{!entry.result && <p>No response was captured for this call.</p>}{entry.result?.error && <p className="danger-text">{entry.result.error}</p>}{entry.result?.status && <p>{entry.result.status.replaceAll('_', ' ')}</p>}{entry.result?.sources?.length === 0 && <p>No matching reference passages were returned.</p>}{entry.result?.sources?.map((source, number) => <div className="trail-source" key={`${source.id}-${number}`}><strong>{source.name}</strong><small>{source.version} · <span className="mono">{source.id.slice(0, 8)}</span></small><p>{source.excerpt}</p></div>)}{entry.result?.results?.map((result, number) => <div className="trail-test-result" key={number}><Badge value={result.passed ? 'pass' : 'fail'} /><span>Case {number + 1}: {displayValue(result.actual)} / expected {displayValue(result.expected)}</span></div>)}</details>)}</> : <div className="trail-empty"><ScanLine size={25} /><p>No Gemini investigation has been recorded. Deterministic results remain available.</p></div>}<button className="button secondary small" onClick={onOpenInvestigation}>Open investigation <ArrowRight size={14} /></button></>;
  return <>{investigation?.questions.length ? investigation.questions.map((question, step) => <div className="trail-question" key={step}><h4>{question.question}</h4><p>{question.reason}</p></div>) : <p>No clarification questions are recorded{investigation ? ' in this investigation' : ' yet'}.</p>}<div className="trail-inline-note">The audit snapshot does not certify that a proposed mapping was approved. Review the mapping and its tests before activation.</div><Link className="button secondary" to="/training">Open training & review <ArrowRight size={15} /></Link>{!!investigation?.questions.length && <button className="button text small" onClick={onOpenInvestigation}>Answer clarification questions</button>}</>;
}
