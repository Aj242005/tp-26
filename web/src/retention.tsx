import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, post } from './api';
import { ErrorBox, type Context } from './components';

export function Retention(ctx: Context) {
  const [busy, setBusy] = useState(false);
  const query = useQuery({ queryKey: ['retention'], enabled: ctx.user.roles.includes('admin'),
    queryFn: () => api<{ raw_days: number; report_days: number }>('/settings') });
  if (!ctx.user.roles.includes('admin')) return null;
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    const data = new FormData(event.currentTarget);
    try { await post('/settings', { raw_days: Number(data.get('raw_days')), report_days: Number(data.get('report_days')) });
      await query.refetch(); ctx.notify('Retention policy saved. Expired artifacts are removed by the maintenance service.');
    } catch (error) { ctx.notify((error as Error).message, true); } finally { setBusy(false); }
  }
  return <section className="surface form-body"><h2>Artifact retention</h2><p>Raw configurations and PDF artifacts expire independently. Audit findings, policy versions, and access events remain for review. Deleting a configuration from Devices also deletes its assessments and exports.</p><ErrorBox error={query.error} />{query.data && <form onSubmit={save} className="form-grid"><label>Raw configuration retention (days)<input type="number" min={1} max={3650} name="raw_days" defaultValue={query.data.raw_days} required /></label><label>PDF retention (days)<input type="number" min={1} max={3650} name="report_days" defaultValue={query.data.report_days} required /></label><div><button className="button secondary" disabled={busy}>Save retention policy</button></div></form>}<p className="muted">Shortening retention can permanently remove existing artifacts at the next maintenance run. Backups have a separate operator-managed retention policy.</p></section>;
}
