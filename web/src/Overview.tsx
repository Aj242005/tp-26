import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, ArrowRight, Box, Boxes, Check, ChevronRight, FileCheck2, HelpCircle, Minus, Network, Plus, ScanLine, ShieldCheck, X } from 'lucide-react';
import { api, date, post, type RecordItem } from './api';
import { AuditTable, Badge, CopyButton, ErrorBox, Loading, PageHead, type Context } from './components';
import { displayValue } from './trail-model';

export default function Overview(ctx: Context) {
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [selectedAudit, setSelectedAudit] = useState<string | null>(null);
  const query = useQuery({ queryKey: ['overview'], queryFn: () => api<{ counts: Record<string, number>; jobs: Record<string, number>; recent: RecordItem[] }>('/overview'), refetchInterval: 6000 });
  async function examples() {
    setBusy(true);
    try { await post('/examples'); await client.invalidateQueries(); ctx.notify('Five synthetic configurations added to the device inventory.'); }
    catch (error) { ctx.notify((error as Error).message, true); }
    finally { setBusy(false); }
  }
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorBox error={query.error} />;
  const data = query.data!;
  const recent = data.recent;
  const current = recent.find(item => item.id === selectedAudit) ?? recent.find(item => item.coverage !== undefined) ?? recent[0];
  const queued = (data.jobs.queued ?? 0) + (data.jobs.retry ?? 0);
  const running = data.jobs.running ?? 0;
  const counters = [
    { name: 'Configurations', value: data.counts.device ?? 0, to: '/devices', icon: Network },
    { name: 'Recorded audits', value: data.counts.audit ?? 0, to: '/audits', icon: FileCheck2 },
    { name: 'Work in progress', value: queued + running, to: '/administration', icon: Activity },
    { name: 'Learning library', value: data.counts.mapping ?? 0, to: '/training', icon: Boxes },
  ];
  return <>
    <PageHead title="Workspace overview" description="Explore your evidence. Understand the gaps. Decide what comes next."><Link className="button" to="/devices"><Plus size={17} /> Add configurations</Link></PageHead>
    <div className="workspace-metrics">{counters.map(({ name, value, to, icon: Icon }) => <Link key={name} to={to}><Icon size={18} /><span>{name}<strong>{value.toLocaleString()}</strong></span><ArrowRight size={15} /></Link>)}</div>
    <section className="audit-studio" aria-label="Interactive evidence workbench">
      <div className="studio-heading"><div><ScanLine size={19} /><h2>Evidence workbench</h2><span className="studio-label">Select · inspect · trace</span></div>{current && <Link className="studio-trail-link" to={`/audits/${current.id}?view=trail`}><Box size={17} /> Explore in 3D <ArrowRight size={15} /></Link>}</div>
      {current ? <div className="studio-layout"><div className="audit-browser"><div className="audit-browser-heading"><span>Recent assessments</span><span>{recent.length}</span></div>{recent.map(item => <button key={item.id} className={`audit-option ${current.id === item.id ? 'selected' : ''}`} aria-pressed={current.id === item.id} onClick={() => setSelectedAudit(item.id)}><div><span className="mono">{item.id.slice(0, 8)}</span><span className={`status-dot ${item.status === 'complete' ? 'pass' : item.status === 'failed' ? 'fail' : 'unknown'}`} /></div><strong>{item.name}</strong><small>{item.vendor?.toUpperCase() ?? 'UNKNOWN'} · {date(item.created_at)}</small><ChevronRight size={15} /></button>)}<Link className="browse-all" to="/audits">Open audit register <ArrowRight size={15} /></Link></div><EvidenceLens key={current.id} record={current} /></div> : <div className="studio-empty"><ScanLine size={38} /><h3>Your evidence starts here.</h3><p>Upload a configuration, or explore IOS, Junos, FortiOS and an unfamiliar format using labelled synthetic examples.</p><button className="button secondary" disabled={busy || !ctx.user.roles.includes('auditor')} onClick={examples}>{busy ? 'Adding examples…' : 'Load example configurations'}<ArrowRight size={16} /></button></div>}
      <div className="studio-footer"><span><ShieldCheck size={14} /> Evidence before verdicts</span><span><Activity size={14} /> {running} running <i /> {queued} queued / retrying</span></div>
    </section>
    <div className="register-heading"><div><h2>Assessment history</h2><p>Every run preserves its own evidence and policy version.</p></div><Link to="/audits">View all assessments <ArrowRight size={15} /></Link></div>
    <section className="surface audit-register"><AuditTable items={data.recent} /></section>
    <div className="context-strip"><ShieldCheck size={18} /><p><strong>Coverage is part of the result.</strong> The included policy packs are team-authored technical baselines. Review exact benchmark editions before using them for a formal assessment.</p></div>
  </>;
}

function EvidenceLens({ record }: { record: RecordItem }) {
  const query = useQuery({ queryKey: ['audit', record.id], queryFn: () => api<RecordItem>(`/audits/${record.id}`), refetchInterval: ['running', 'queued', 'retry', 'report_pending'].includes(record.status ?? '') ? 3000 : false });
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const audit = query.data ?? record;
  const findings = audit.findings ?? [];
  const pinned = findings.find(row => row.id === selected) ?? findings.find(row => row.verdict === 'fail') ?? findings[0];
  const finding = findings.find(row => row.id === hovered) ?? pinned;
  return <div className="evidence-lens"><div className="lens-header"><div><span className="lens-meta">{audit.vendor?.toUpperCase()} / {audit.policy?.framework ?? 'Baseline'} {audit.synthetic && <span>· Synthetic</span>}</span><h3>{audit.name}</h3></div><Badge value={audit.status ?? 'queued'} /></div>
    <div className="lens-subhead"><span><span className="mono">{audit.id.slice(0, 8)}</span><CopyButton text={audit.id} label="audit ID" /></span><span>Policy {audit.policy?.version ?? 'not recorded'}</span></div>
    <ErrorBox error={query.error} />
    {query.isPending ? <Loading /> : findings.length ? <>
      <div className="spectrum-head"><h4>Control spectrum</h4><span>{findings.length} checks · hover to preview, click to pin</span></div>
      <div className="control-spectrum" role="group" aria-label="Preview audit controls" onMouseLeave={() => setHovered(null)}>{findings.slice(0, 60).map((row, index) => <button key={row.id} className={`control-tile ${row.verdict} ${finding?.id === row.id ? 'selected' : ''}`} aria-pressed={pinned?.id === row.id} aria-label={`${row.id}: ${row.title}, ${row.verdict.replaceAll('_', ' ')}`} title={`${row.id} · ${row.title}`} onMouseEnter={() => setHovered(row.id)} onFocus={() => { setSelected(row.id); setHovered(null); }} onClick={() => { setSelected(row.id); setHovered(null); }}><span>{row.verdict === 'pass' ? <Check size={15} /> : row.verdict === 'fail' ? <X size={15} /> : row.verdict === 'not_applicable' ? <Minus size={15} /> : <HelpCircle size={15} />}</span><span className="mono">{String(index + 1).padStart(2, '0')}</span></button>)}</div>
      {findings.length > 60 && <p className="spectrum-limit">Showing the first 60 controls. Open the audit for all {findings.length}.</p>}
      <div className="spectrum-legend"><span><i className="status-dot pass" />{audit.counts?.pass ?? 0} pass</span><span><i className="status-dot fail" />{audit.counts?.fail ?? 0} fail</span><span><i className="status-dot unknown" />{audit.counts?.insufficient_evidence ?? 0} need evidence</span><span>{audit.coverage ?? 0}% evaluated{audit.counts?.not_applicable ? ` / ${audit.counts.not_applicable} not applicable` : ''}</span></div>
      {finding && <div className="control-preview" key={finding.id}><div className="control-preview-title"><div><span className="mono">{finding.id}</span><Badge value={finding.verdict} /></div><h4>{finding.title}</h4><p>{finding.evidence?.reason ?? 'No supported source evidence establishes this setting.'}</p></div><div className="preview-values"><span>Observed<strong>{displayValue(finding.observed)}</strong></span><ArrowRight size={17} /><span>Expected<strong>{displayValue(finding.expected)}</strong></span></div><Link className="control-preview-link" to={`/audits/${audit.id}?finding=${encodeURIComponent(finding.id)}`}>Inspect this finding <ArrowRight size={16} /></Link></div>}
    </> : <div className="lens-pending"><Activity size={30} /><h4>{audit.status === 'failed' ? 'Assessment needs attention' : 'Waiting for evaluation'}</h4><p>{audit.error ?? audit.progress ?? 'The stored findings will appear here when evaluation completes.'}</p><Link to={`/audits/${audit.id}`}>Open assessment <ArrowRight size={15} /></Link></div>}
  </div>;
}
