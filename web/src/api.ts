export type Finding = {
  id: string; title: string; verdict: string; severity: string; observed: unknown; expected: unknown;
  source: string; rationale: string; remediation: string | null; remediation_note: string;
  evidence: { value: unknown; lines: number[]; reason: string; origin: string } | null;
};
export type RecordItem = {
  id: string; name: string; kind: string; created_at: string; updated_at: string; vendor?: string;
  firmware?: string; pending_delete?: boolean; status?: string; synthetic?: boolean; source?: string; device_id?: string;
  coverage?: number; pass_rate?: number | null; counts?: Record<string, number>; findings?: Finding[];
  progress?: string; error?: string; policy?: Policy; policy_id?: string | null; report?: { key: string; sha256: string; size: number };
  normalization?: { unrecognized: { line: number; text: string }[]; unrecognized_count: number };
  tests?: { passed: boolean; eligible: boolean; results: { passed: boolean; expected: unknown; actual: unknown }[] };
  spec?: Mapping | Policy; version?: string; authority?: string; url?: string; content?: string;
  investigation?: { summary: string; model: string; tokens: number; questions: { question: string; reason: string }[]; trace: { step: number; tool: string }[] };
};
export type Policy = { name: string; framework: string; version: string; scope: string; rules: unknown[] };
export type Mapping = {
  name: string; vendor: string; firmware: string; fact: string; selector_type: string; selector: string;
  scope_prefix: string; value_mode: string; value_type: string; literal: unknown; description: string;
  cases: { text: string; expected: unknown; label_source: string }[];
};
export type User = { name: string; username: string; roles: string[]; csrf: string; tenant_id: string;
  workspace: string; ai: { configured: boolean; enabled: boolean; model: string | null; provider: string } };
export let csrf = '';
export function setCsrf(value: string) { csrf = value; }
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData) && options.body) headers.set('Content-Type', 'application/json');
  if (options.method && options.method !== 'GET') headers.set('X-CSRF-Token', csrf);
  const response = await fetch('/api' + path, { ...options, headers, credentials: 'same-origin' });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(typeof payload.detail === 'string' ? payload.detail : `Request failed (${response.status})`);
  }
  return response.json();
}
export function post<T>(path: string, body: unknown = {}, headers: Record<string, string> = {}) {
  return api<T>(path, { method: 'POST', body: JSON.stringify(body), headers });
}
export const date = (value?: string) => value ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—';
