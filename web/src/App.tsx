/* THESIS: A debugger for configuration assurance, with evidence as the working material.
OWN-WORLD: Graphite panes, crisp blue selections, Geist UI and monospaced source/measurements.
STORY: Locate an assessment, inspect its uncertainty, trace a finding, then review a change.
FIRST VIEWPORT: Instrument dock, compact navigation counters, selectable audits and a live control spectrum.
FORM: Grounded direction 7, debugger workbench; seed b6d4e010. Task-led split panes;
dark default with an equivalent light mode. No invented telemetry or network relationships. */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NavLink, Link, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, BookOpen, Boxes, Check, ChevronRight, Command, FileCheck2, LayoutDashboard, LogOut, Moon, Network, PanelLeftClose, PanelLeftOpen, Search, Settings, ShieldCheck, Sparkles, Sun, Terminal, Waves, X } from 'lucide-react';
import { post, setCsrf, type User } from './api';
import { Badge, Empty, ErrorBox, Loading } from './components';
import { Devices, Audits, AuditDetail } from './audits';
import { Training, Policies, Sources, Administration } from './workspace';
import Overview from './Overview';
import { transitionInterface } from './motion';
import { SocialSignIn } from './identity';

const frontendOnly = import.meta.env.VITE_FRONTEND_ONLY;

function Login() {
  const pending = new URLSearchParams(useLocation().search).get('access') === 'pending';
  return <main className="login-page"><div className="login-brand"><ShieldCheck size={28} /><span>Prooflane <small>Evidence console</small></span><span className="login-access">{frontendOnly ? 'Frontend preview' : 'Private workspace'}</span></div><div className="login-layout">
    <section><span className="eyebrow">Network security / configuration assurance</span><h1>Every finding.<br />Grounded in evidence.</h1><p>A working space for configuration audits, unfamiliar vendor formats, and changes your team can review with confidence.</p>
      {frontendOnly ? <div className="notice" role="status"><div><strong>Backend connection pending</strong><p>This preview introduces Prooflane. Sign-in, configuration uploads, audit results and the interactive 3D trail become available when the secure workspace backend is connected.</p><p>The full workspace currently runs on the project owner’s laptop.</p></div></div> : <>
        {pending && <div className="notice" role="status">Your identity was verified. Ask your administrator to assign your organization and workspace role, then sign in again.</div>}
        <SocialSignIn /><a className="button large" href="/api/auth/login">Sign in to your workspace <ArrowRight size={18} /></a><p className="login-note">Use a workspace account, or an existing connected session.<br />Local demo credentials are stored in your project’s .env file.</p>
      </>}</section>
    <section className="login-proof" aria-label="How the auditor works"><div className="proof-heading"><Terminal size={18} /><span>Configuration → evidence → decision</span></div>
      <div className="login-source"><div><span>ios-example.cfg</span><Badge value="synthetic" /></div><pre><span className="code-line"><span className="line-number">1</span>hostname branch-router</span><span className="code-line"><span className="line-number">2</span>ip ssh version 2</span><span className="code-line"><span className="line-number">3</span>service password-encryption</span></pre><p><Check size={14} /> Every supported fact retains its source.</p></div>
      <ol><li><span>1</span><div><h2>Bring the configuration</h2><p>Preserve the source, device context and version.</p></div></li><li><span>2</span><div><h2>Inspect the evidence</h2><p>Trace each supported finding to a setting and a rule.</p></div></li><li><span>3</span><div><h2>Resolve what is unknown</h2><p>Test and review new mappings before they influence an audit.</p></div></li></ol>
      <div className="proof-note"><Check size={16} /> Unknown settings remain visible. They never count as a pass.</div></section>
  </div><footer>Prooflane · Evidence-backed network security auditing</footer></main>;
}

const destinations = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, group: 'Auditing', description: 'Assessments and processing queue' },
  { to: '/devices', label: 'Devices', icon: Network, group: 'Auditing', description: 'Upload configurations and run audits' },
  { to: '/audits', label: 'Audits', icon: FileCheck2, group: 'Auditing', description: 'Inspect findings and export reports' },
  { to: '/training', label: 'Training & review', icon: Sparkles, group: 'Knowledge', description: 'Test and approve configuration mappings' },
  { to: '/policies', label: 'Policy library', icon: ShieldCheck, group: 'Knowledge', description: 'Technical controls and framework crosswalks' },
  { to: '/sources', label: 'Reference sources', icon: BookOpen, group: 'Knowledge', description: 'Versioned reference documentation' },
  { to: '/administration', label: 'Activity & settings', icon: Settings, group: 'Workspace', description: 'Access, retention and workspace history' },
];

function CommandMenu() {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState(0);
  const navigate = useNavigate();
  const matches = destinations.filter(item => `${item.label} ${item.description}`.toLowerCase().includes(filter.toLowerCase()));
  useEffect(() => { if (dialog.current?.open) dialog.current.querySelector(`#command-option-${selected}`)?.scrollIntoView({ block: 'nearest' }); }, [selected, filter]);
  function open() { setFilter(''); setSelected(0); dialog.current?.showModal(); input.current?.focus(); }
  function close() { dialog.current?.close(); trigger.current?.focus(); }
  function choose(path: string) { close(); navigate(path); }
  useEffect(() => {
    function shortcut(event: KeyboardEvent) { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); if (dialog.current?.open) dialog.current.close(); else { setFilter(''); setSelected(0); dialog.current?.showModal(); input.current?.focus(); } } }
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, []);
  return <><button ref={trigger} className="command-trigger" onClick={open} aria-label="Search workspace navigation"><Search size={16} /><span>Go to workspace…</span><kbd>Ctrl K</kbd></button>
    <dialog ref={dialog} className="command-dialog" aria-label="Workspace navigation" onClick={event => { if (event.target === dialog.current) close(); }} onKeyDown={event => {
      if (event.target === input.current && ['ArrowDown', 'ArrowUp'].includes(event.key) && matches.length) { event.preventDefault(); setSelected(value => (value + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length); }
      if (event.key === 'Enter' && matches[selected] && event.target === input.current) { event.preventDefault(); choose(matches[selected].to); }
    }}><div className="command-search"><Search size={20} /><input ref={input} value={filter} onChange={event => { setFilter(event.target.value); setSelected(0); }} role="combobox" aria-expanded="true" aria-autocomplete="list" aria-controls="command-destinations" aria-activedescendant={matches[selected] ? `command-option-${selected}` : undefined} aria-label="Search destinations" placeholder="Where would you like to go?" /><button className="icon-button" aria-label="Close navigation search" onClick={close}><X size={18} /></button></div><div className="command-results" id="command-destinations" role="listbox" aria-label="Workspace destinations">{matches.map(({ to, label, icon: Icon, description }, index) => <button role="option" id={`command-option-${index}`} aria-selected={selected === index} tabIndex={-1} className={selected === index ? 'command-result selected' : 'command-result'} key={to} onClick={() => choose(to)} onFocus={() => setSelected(index)}><Icon size={19} /><span><strong>{label}</strong><small>{description}</small></span><ArrowRight size={16} /></button>)}{!matches.length && <p className="command-empty">No matching destination. Try “devices”, “policy” or “review”.</p>}</div><div className="command-footer"><span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span><span><kbd>Enter</kbd> Open</span><span><kbd>Esc</kbd> Close</span></div></dialog></>;
}

function NavigationMarker() {
  const marker = useRef<HTMLSpanElement>(null);
  const location = useLocation();
  useLayoutEffect(() => {
    const nav = marker.current?.parentElement;
    if (!nav) return;
    const update = () => {
      const active = nav.querySelector('a.active');
      if (!active || !marker.current) return;
      const parent = nav.getBoundingClientRect(), item = active.getBoundingClientRect();
      Object.assign(marker.current.style, { transform: `translate(${item.left - parent.left}px, ${item.top - parent.top}px)`, width: `${item.width}px`, height: `${item.height}px` });
    };
    update();
    const observer = new ResizeObserver(update); observer.observe(nav);
    return () => observer.disconnect();
  }, [location.pathname]);
  return <span ref={marker} className="nav-active-marker" aria-hidden="true" />;
}

export default function App() {
  const client = useQueryClient();
  const location = useLocation();
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('auditor-theme') === 'light' ? 'light' : 'dark'; } catch { return 'dark'; } });
  const [compact, setCompact] = useState(() => { try { return localStorage.getItem('auditor-compact') === 'true'; } catch { return false; } });
  const [motion, setMotion] = useState(() => { try { return localStorage.getItem('auditor-motion') !== 'off'; } catch { return true; } });
  useLayoutEffect(() => { document.documentElement.dataset.theme = theme; try { localStorage.setItem('auditor-theme', theme); } catch { /* Storage may be unavailable in a private browser. */ } }, [theme]);
  useLayoutEffect(() => { document.documentElement.dataset.motion = motion ? 'on' : 'off'; try { localStorage.setItem('auditor-motion', motion ? 'on' : 'off'); } catch { /* Preference remains available for this session. */ } }, [motion]);
  useLayoutEffect(() => { try { localStorage.setItem('auditor-compact', String(compact)); } catch { /* Preference remains available for this session. */ } }, [compact]);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const query = useQuery({ queryKey: ['me'], enabled: !frontendOnly, staleTime: 60000, retry: false, queryFn: async () => {
    const response = await fetch('/api/me', { credentials: 'same-origin' });
    if (response.status === 401) return null;
    if (!response.ok) throw new Error('The local application is unavailable. Check the Docker services, then reload.');
    const user: User = await response.json(); setCsrf(user.csrf); return user;
  } });
  const notify = (text: string, error = false) => setMessage({ text, error });
  if (frontendOnly) return <Login />;
  if (query.isPending) return <Loading />;
  if (query.error) return <main className="startup-error"><ShieldCheck size={36} /><h1>Workspace unavailable</h1><ErrorBox error={query.error} /><button className="button" onClick={() => query.refetch()}>Try again</button></main>;
  if (!query.data) return <Login />;
  const user = query.data;
  const ctx = { user, notify };
  const current = destinations.find(item => item.to !== '/' && location.pathname.startsWith(item.to)) ?? destinations[0];
  async function logout() { try { await post('/auth/logout'); client.clear(); window.location.assign('/'); } catch (e) { notify((e as Error).message, true); } }
  return <div className={`app-shell ${compact ? 'nav-compact' : ''}`}><a href="#main-content" className="skip-link">Skip to content</a><aside className="sidebar"><Link to="/" className="brand" aria-label="Prooflane home"><div className="brand-symbol"><ShieldCheck size={22} /></div><div><strong>Prooflane</strong><small>Evidence console</small></div></Link>
    <div className="workspace-label"><Boxes size={17} /><div><strong>{user.workspace}</strong><small>Configuration assurance</small></div></div><nav aria-label="Main navigation"><NavigationMarker />{['Auditing', 'Knowledge', 'Workspace'].map(group => <div className="nav-group" key={group}><span className="nav-group-label">{group}</span>{destinations.filter(item => item.group === group).map(({ to, label, icon: Icon }) => <NavLink end={to === '/'} key={to} to={to} aria-label={label} data-label={label} title={compact ? label : undefined}><Icon size={17} /><span>{label}</span><ChevronRight className="nav-chevron" size={13} /></NavLink>)}</div>)}</nav>
    <div className="sidebar-bottom"><div className="provider-heading"><Sparkles size={16} /><strong>{user.ai.configured ? 'Gemini configured' : 'Deterministic auditing'}</strong></div><small>{user.ai.configured ? user.ai.model : 'Gemini setup available in .env'}</small><Link to="/administration">Integration settings <ArrowRight size={13} /></Link></div></aside>
    <div className="workspace"><header className="topbar"><div className="topbar-location"><button className="icon-button dock-toggle" aria-label={compact ? 'Expand navigation' : 'Collapse navigation'} title={compact ? 'Expand navigation' : 'Focus mode'} onClick={() => transitionInterface(() => setCompact(!compact))}>{compact ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</button><div className="breadcrumbs"><span>Workspace</span><ChevronRight size={14} /><strong>{current.label}</strong></div></div><div className="topbar-tools"><CommandMenu /><button className="icon-button motion-toggle" aria-label={motion ? 'Reduce interface motion' : 'Enable interface motion'} aria-pressed={!motion} title={motion ? 'Reduce interface motion' : 'Enable interface motion'} onClick={() => setMotion(!motion)}><Waves size={18} /></button><button className="icon-button theme-toggle" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} onClick={() => transitionInterface(() => setTheme(theme === 'dark' ? 'light' : 'dark'))}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button><div className="user-area"><span className="avatar">{user.name.slice(0, 1)}</span><span className="user-name">{user.name}</span><button className="icon-button" onClick={logout} aria-label="Sign out"><LogOut size={17} /></button></div></div></header>
      <main id="main-content"><div className="route-stage" key={location.pathname}><Routes><Route path="/" element={<Overview {...ctx} />} /><Route path="/devices" element={<Devices {...ctx} />} /><Route path="/audits" element={<Audits />} /><Route path="/audits/:id" element={<AuditDetail {...ctx} />} /><Route path="/training" element={<Training {...ctx} />} /><Route path="/policies" element={<Policies {...ctx} />} /><Route path="/sources" element={<Sources {...ctx} />} /><Route path="/administration" element={<Administration {...ctx} />} /><Route path="*" element={<Empty title="Page not found"><Link to="/">Return to your workspace</Link></Empty>} /></Routes></div></main>
      <footer className="workspace-footer"><span><ShieldCheck size={13} /> Organization-scoped workspace</span><span><Command size={12} /> Evidence before verdicts</span></footer></div>
    {message && <div key={message.text} className={`toast ${message.error ? 'toast-error' : ''}`} role={message.error ? 'alert' : 'status'}>{!message.error && <span className="toast-check"><Check size={17} /></span>}<span>{message.text}</span><button aria-label="Dismiss notification" onClick={() => setMessage(null)}><X size={16} /></button></div>}
  </div>;
}
