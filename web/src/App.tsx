import { useState } from 'react';
import { NavLink, Link, Route, Routes } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, ArrowRight, BookOpen, Boxes, Check, ChevronRight, FileCheck2, LayoutDashboard, LogOut, Network, Plus, Settings, ShieldCheck, Sparkles, X } from 'lucide-react';
import { api, post, setCsrf, type RecordItem, type User } from './api';
import { AuditTable, Empty, ErrorBox, Loading, PageHead, type Context } from './components';
import { Devices, Audits, AuditDetail } from './audits';
import { Training, Policies, Sources, Administration } from './workspace';

function Login() {
  return <main className="login-page"><div className="login-brand"><ShieldCheck size={28} /><span>SIH26155</span></div><div className="login-layout">
    <section><span className="eyebrow">Network security / configuration assurance</span><h1>Every finding.<br />Grounded in evidence.</h1><p>A working space for configuration audits, unfamiliar vendor formats, and changes your team can review with confidence.</p>
      <a className="button large" href="/api/auth/login">Sign in to your workspace <ArrowRight size={18} /></a><p className="login-note">Your local identity service manages access.<br />Local credentials are stored in your project’s .env file.</p></section>
    <section className="login-proof" aria-label="How the auditor works"><div className="proof-heading"><FileCheck2 size={18} /><span>From configuration to a reviewable decision</span></div>
      <ol><li><span>1</span><div><h2>Bring the configuration</h2><p>Preserve the source, device context and version.</p></div></li><li><span>2</span><div><h2>Inspect the evidence</h2><p>Trace each supported finding to a setting and a rule.</p></div></li><li><span>3</span><div><h2>Resolve what is unknown</h2><p>Test and review new mappings before they influence an audit.</p></div></li></ol>
      <div className="proof-note"><Check size={16} /> Unknown settings remain visible. They never count as a pass.</div></section>
  </div><footer>AI-Driven Multi-Vendor Network Security Compliance Auditor</footer></main>;
}

function Overview(ctx: Context) {
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const query = useQuery({ queryKey: ['overview'], queryFn: () => api<{ counts: Record<string, number>; jobs: Record<string, number>; recent: RecordItem[] }>('/overview'), refetchInterval: 6000 });
  async function examples() { setBusy(true); try { await post('/examples'); await client.invalidateQueries(); ctx.notify('Five synthetic configurations added to the device inventory.'); } catch (e) { ctx.notify((e as Error).message, true); } finally { setBusy(false); } }
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorBox error={query.error} />;
  const data = query.data!;
  return <><PageHead title="Workspace overview" description="A clear view of your configurations, audit work, and unresolved evidence."><Link className="button" to="/devices"><Plus size={17} /> Add configurations</Link></PageHead>
    <div className="overview-summary"><div><span>Device inventory</span><strong>{data.counts.device ?? 0}</strong><small>Preserved configuration snapshots</small></div><div><span>Audits recorded</span><strong>{data.counts.audit ?? 0}</strong><small>Versioned assessments</small></div><div><span>Work in progress</span><strong>{(data.jobs.queued ?? 0) + (data.jobs.running ?? 0) + (data.jobs.retry ?? 0)}</strong><small>Durable queued and running jobs</small></div><div><span>Learning library</span><strong>{data.counts.mapping ?? 0}</strong><small>Proposed and reviewed mappings</small></div></div>
    {!data.counts.device && <section className="onboarding"><div className="onboarding-symbol"><Network size={30} /></div><div><h2>Start with a configuration you can inspect.</h2><p>Upload your own snapshot, or explore the workflow with clearly labelled synthetic examples for IOS, Junos, FortiOS and an unfamiliar format.</p><button className="button secondary" disabled={busy || !ctx.user.roles.includes('auditor')} onClick={examples}>{busy ? 'Adding examples…' : 'Load example configurations'} <ArrowRight size={16} /></button></div></section>}
    <section className="surface"><div className="section-head"><h2>Recent audits</h2><Link to="/audits">View all audits <ArrowRight size={16} /></Link></div><AuditTable items={data.recent} /></section>
    <div className="context-strip"><ShieldCheck size={18} /><p><strong>Coverage is part of the result.</strong> The included policy packs are team-authored technical baselines. Review exact benchmark editions before using them for a formal assessment.</p></div>
  </>;
}

export default function App() {
  const client = useQueryClient();
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const query = useQuery({ queryKey: ['me'], staleTime: 60000, retry: false, queryFn: async () => {
    const response = await fetch('/api/me', { credentials: 'same-origin' });
    if (response.status === 401) return null;
    if (!response.ok) throw new Error('The local application is unavailable. Check the Docker services, then reload.');
    const user: User = await response.json(); setCsrf(user.csrf); return user;
  } });
  const notify = (text: string, error = false) => setMessage({ text, error });
  if (query.isPending) return <Loading />;
  if (query.error) return <main className="startup-error"><ShieldCheck size={36} /><h1>Workspace unavailable</h1><ErrorBox error={query.error} /><button className="button" onClick={() => query.refetch()}>Try again</button></main>;
  if (!query.data) return <Login />;
  const user = query.data;
  const ctx = { user, notify };
  const links = [
    { to: '/', label: 'Overview', icon: LayoutDashboard }, { to: '/devices', label: 'Devices', icon: Network },
    { to: '/audits', label: 'Audits', icon: FileCheck2 }, { to: '/training', label: 'Training & review', icon: Sparkles },
    { to: '/policies', label: 'Policy library', icon: ShieldCheck }, { to: '/sources', label: 'Reference sources', icon: BookOpen },
    { to: '/administration', label: 'Activity & settings', icon: Settings },
  ];
  async function logout() { try { await post('/auth/logout'); client.clear(); window.location.assign('/'); } catch (e) { notify((e as Error).message, true); } }
  return <div className="app-shell"><a href="#main-content" className="skip-link">Skip to content</a><aside className="sidebar"><Link to="/" className="brand"><div className="brand-symbol"><ShieldCheck size={24} /></div><div>Configuration<br /><strong>Auditor</strong><small>SIH26155</small></div></Link>
    <div className="workspace-label"><Boxes size={15} />{user.workspace}</div><nav aria-label="Main navigation">{links.map(({ to, label, icon: Icon }) => <NavLink end={to === '/'} key={to} to={to}><Icon size={18} /><span>{label}</span></NavLink>)}</nav>
    <div className="sidebar-bottom"><div className={`connection-dot ${user.ai.configured ? 'ready' : ''}`} /><div><strong>{user.ai.configured ? 'Gemini configured' : 'Deterministic auditing'}</strong><small>{user.ai.configured ? user.ai.model : 'Gemini setup available in .env'}</small></div></div></aside>
    <div className="workspace"><header className="topbar"><div><span>Security workspace</span><ChevronRight size={14} /><strong>Configuration assurance</strong></div><div className="user-area"><span className="avatar">{user.name.slice(0, 1)}</span><span>{user.name}</span><button className="icon-button" onClick={logout} aria-label="Sign out"><LogOut size={17} /></button></div></header>
      <main id="main-content"><Routes><Route path="/" element={<Overview {...ctx} />} /><Route path="/devices" element={<Devices {...ctx} />} /><Route path="/audits" element={<Audits />} /><Route path="/audits/:id" element={<AuditDetail {...ctx} />} /><Route path="/training" element={<Training {...ctx} />} /><Route path="/policies" element={<Policies {...ctx} />} /><Route path="/sources" element={<Sources {...ctx} />} /><Route path="/administration" element={<Administration {...ctx} />} /><Route path="*" element={<Empty title="Page not found"><Link to="/">Return to your workspace</Link></Empty>} /><Route path="*" element={<section className="surface form-body"><h1>Page not found</h1><p>This address does not match a workspace page.</p><Link className="button" to="/">Return to overview</Link></section>} /></Routes></main>
      <footer className="workspace-footer"><span><Activity size={13} /> Local Docker workspace</span><span>Evidence before verdicts.</span></footer></div>
    {message && <div className={`toast ${message.error ? 'toast-error' : ''}`} role={message.error ? 'alert' : 'status'}><span>{message.text}</span><button aria-label="Dismiss notification" onClick={() => setMessage(null)}><X size={16} /></button></div>}
  </div>;
}
