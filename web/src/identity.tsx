import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Github, KeyRound } from 'lucide-react';
import { api } from './api';
import { Badge, ErrorBox } from './components';

type Provider = { id: string; name: string; configured: boolean };
function useProviders() {
  return useQuery({ queryKey: ['auth-providers'], staleTime: 60000, retry: false,
    queryFn: () => api<{ providers: Provider[] }>('/auth/providers') });
}

function GoogleMark() {
  return <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M43.61 24.46c0-1.36-.12-2.66-.35-3.92H24v7.42h11a9.4 9.4 0 0 1-4.08 6.16v5h6.6c3.86-3.55 6.09-8.78 6.09-14.66Z" /><path fill="#34A853" d="M24 44c5.5 0 10.12-1.82 13.49-4.88l-6.6-5c-1.83 1.24-4.17 1.98-6.89 1.98-5.3 0-9.79-3.57-11.4-8.38H5.8v5.15A20 20 0 0 0 24 44Z" /><path fill="#FBBC05" d="M12.6 27.72a12 12 0 0 1 0-7.44v-5.15H5.8a20 20 0 0 0 0 17.74l6.8-5.15Z" /><path fill="#EA4335" d="M24 11.9c3 0 5.68 1.03 7.8 3.05l5.85-5.85A19.6 19.6 0 0 0 24 4 20 20 0 0 0 5.8 15.13l6.8 5.15C14.21 15.47 18.7 11.9 24 11.9Z" /></svg>;
}

export function SocialSignIn() {
  const query = useProviders();
  const providers = query.data?.providers ?? [{ id: 'google', name: 'Google', configured: false }, { id: 'github', name: 'GitHub', configured: false }];
  return <div className="social-signin"><div className="social-actions" aria-label="Social sign-in">{providers.map(provider => {
    const content = <>{provider.id === 'google' ? <GoogleMark /> : <Github size={18} />}<span>Continue with {provider.name}</span><ArrowRight size={16} /></>;
    return provider.configured ? <a className="button secondary social-button" key={provider.id} href={`/api/auth/login?provider=${provider.id}`}>{content}</a>
      : <button className="button secondary social-button" key={provider.id} disabled aria-describedby="social-status">{content}</button>;
  })}</div><p id="social-status" className="social-status">{query.isPending ? 'Checking sign-in options…' : query.isError ? 'Social sign-in is unavailable. Workspace sign-in is still available below.' : providers.some(p => !p.configured) ? 'Unavailable providers need administrator setup.' : 'Use your existing account. Workspace access is granted by your administrator.'}</p>
    {!query.isPending && providers.some(p => !p.configured) && <details className="signin-setup"><summary>Set up Google or GitHub sign-in</summary><p>In the project’s <code>.env</code>, set <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code>, or <code>GITHUB_CLIENT_ID</code> and <code>GITHUB_CLIENT_SECRET</code>. Follow <code>docs/identity-and-https.md</code> to register the callback and sync the identity service.</p></details>}
  </div>;
}

export function IdentitySettings() {
  const query = useProviders();
  return <section className="surface form-body" id="sign-in-settings"><div className="setting-title"><KeyRound size={20} /><h2>Sign-in connections</h2></div><ErrorBox error={query.error} /><p className="muted">Google and GitHub verify identity. Your organization and assigned roles determine workspace access.</p>
    <div className="identity-providers">{query.data?.providers.map(provider => <div key={provider.id}><strong>{provider.name}</strong><Badge value={provider.configured ? 'configured' : 'not_configured'} /></div>)}</div>
    <p>OAuth credentials are configured in <code>.env</code>. Setup, callback URLs and the one-time access approval are documented in <code>docs/identity-and-https.md</code>.</p>
    <a className="button secondary" href="/api/auth/account" target="_blank" rel="noreferrer">Manage connected accounts <ArrowRight size={16} /></a>
  </section>;
}
