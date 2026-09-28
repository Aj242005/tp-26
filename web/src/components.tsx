import type { ReactNode, KeyboardEvent } from 'react';
import { ArrowRight, AlertCircle, LoaderCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { date, type RecordItem, type User } from './api';

export type Context = { user: User; notify: (message: string, error?: boolean) => void };
export function moveTab(event: KeyboardEvent<HTMLDivElement>) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const tabs = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  const current = tabs.indexOf(document.activeElement as HTMLButtonElement);
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  event.preventDefault(); tabs[next]?.focus(); tabs[next]?.click();
}
export function Badge({ value }: { value: string }) {
  return <span className={`badge ${value}`}>{value.replaceAll('_', ' ')}</span>;
}
export function Loading() { return <div className="loading" role="status"><LoaderCircle className="spin" size={20} /> Loading workspace data…</div>; }
export function ErrorBox({ error }: { error: unknown }) {
  return error ? <div className="error-box" role="alert"><AlertCircle size={18} /><span>{error instanceof Error ? error.message : 'This operation could not be completed.'}</span></div> : null;
}
export function PageHead({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return <div className="page-head"><div><h1>{title}</h1><p>{description}</p></div><div className="actions">{children}</div></div>;
}
export function Empty({ title, children }: { title: string; children: ReactNode }) {
  return <div className="empty"><div className="empty-mark" aria-hidden="true">↗</div><h2>{title}</h2><div>{children}</div></div>;
}
export function AuditTable({ items }: { items: RecordItem[] }) {
  if (!items.length) return <Empty title="No audits yet"><p>Upload a configuration and run your first evidence assessment.</p><Link className="button" to="/devices">Open device inventory <ArrowRight size={16} /></Link></Empty>;
  return <div className="table-scroll"><table><thead><tr><th>Device / audit</th><th>Framework</th><th>Status</th><th>Evidence coverage</th><th>Created</th><th><span className="sr-only">Open audit</span></th></tr></thead><tbody>
    {items.map(item => <tr key={item.id}><td><Link className="record-name" to={`/audits/${item.id}`}>{item.name}</Link><small>{item.vendor?.toUpperCase() ?? 'UNKNOWN'}{item.synthetic ? ' · Synthetic example' : ''}</small></td>
      <td>{item.policy?.framework ?? 'Baseline'}<small>{item.policy?.version}</small></td><td><Badge value={item.status ?? 'queued'} /></td>
      <td>{item.coverage !== undefined ? <><strong>{item.coverage}%</strong><small>{item.counts?.fail ?? 0} fail · {item.counts?.insufficient_evidence ?? 0} need evidence</small></> : <span className="muted">Awaiting analysis</span>}</td>
      <td className="date-cell">{date(item.created_at)}</td><td><Link className="icon-button" aria-label={`Open ${item.name}`} to={`/audits/${item.id}`}><ArrowRight size={17} /></Link></td></tr>)}
  </tbody></table></div>;
}
