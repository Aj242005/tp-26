# Prooflane: sign-in connections and optional HTTPS

The local app remains at **http://localhost:8185**. Neither social sign-in nor Caddy requires deploying this project to a cloud service. Social sign-in does require registering an OAuth application with each provider. Caddy's public certificates require a reachable domain. Never paste client secrets into chat, screenshots or the browser UI.

## Google and GitHub

Prooflane delegates sign-in to the existing Keycloak identity service. It retains authorization-code flow, PKCE, state, nonce, browser binding and HTTP-only application sessions. Google/GitHub passwords and access tokens are not stored by Prooflane. The provider client secrets are server-side `.env` settings.

1. **Google:** create a Web application OAuth client in [Google Cloud's credentials console](https://console.cloud.google.com/apis/credentials). Configure the consent screen, select the minimum identity scopes (`openid`, `profile`, `email`), and add yourself as a test user if the consent application is in testing. Set the authorized redirect URI below. A Google Cloud project for OAuth registration is not a deployment of this application.
2. **GitHub:** create an OAuth App in [Developer settings](https://github.com/settings/developers). Homepage URL: `http://localhost:8185`. Authorization callback URL: the GitHub URI below. Keycloak requests `read:user user:email` for identity; it does not request repository access.
3. Fill the corresponding values in the project's ignored `.env`:

```dotenv
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```

| Provider | Exact local authorized redirect / callback URI |
| --- | --- |
| Google | `http://localhost:8185/auth/realms/prooflane/broker/google/endpoint` |
| GitHub | `http://localhost:8185/auth/realms/prooflane/broker/github/endpoint` |

These are **broker callbacks**, not `/api/auth/callback`. The latter is the separate Keycloak-to-Prooflane callback. These examples use the default realm `prooflane`. An existing installation may set `OIDC_REALM` to a different identifier in its private `.env`; preserve that value and use it in its callback URLs.

4. From the project root, apply the configuration:

```powershell
uv run python scripts/bootstrap.py
docker compose up -d --build api worker maintenance identity gateway
docker compose exec api python scripts/sync_identity.py
```

`sync_identity.py` updates the existing realm and web client without resetting users, roles or passwords. It enables a provider only when both credentials are present and disables it when either is removed. The identity service has outbound connectivity for the OAuth token exchange. Reload the sign-in page after syncing; the buttons become available. A configured badge checks configuration presence, not the validity of the provider account or credentials.

## First sign-in and workspace access

A social account proves identity; it does not automatically receive access to private network configurations. First-time broker users are created by Keycloak's standard **first broker login** flow. Email matching alone does not automatically link an existing account (`trustEmail=false`). Existing-account linking requires proof of control in Keycloak's standard flow.

An administrator must approve a new account once:

1. After the person attempts Google/GitHub sign-in, open the local [Keycloak administration console](http://localhost:8185/auth/admin/). Sign in as `bootstrap`, using `KEYCLOAK_ADMIN_PASSWORD` from `.env`.
2. Select realm `prooflane`, then **Users**, and identify the newly created user. Verify their identity and intended organization before granting access.
3. Set the administrator-only `tenant_id` user attribute to `00000000-0000-0000-0000-000000000001` for the primary workspace. The second demo organization is `00000000-0000-0000-0000-000000000002`; do not assign it unintentionally. The sync script registers this attribute with admin-only view/edit permissions.
4. Under **Role mapping**, assign `viewer` for reading; add `auditor` for uploads/audits/mapping drafts; add `reviewer` for mapping approval, policy import and reference registration. Give `admin` only to administrators. Assign `viewer` plus the relevant task roles so the UI and API agree.
5. Have the person sign in again. Until the organization and at least one workspace role are assigned, Prooflane shows **access pending** and creates no application session for that identity.

Existing users can connect another identity from **Activity & settings → Sign-in connections → Manage connected accounts**. Keycloak may ask for reauthentication. Connecting an account preserves the user's existing organization and roles. App sign-out ends the Prooflane session; the provider/Keycloak SSO session may still let the same person sign in without entering a password. Use the account console to manage identity sessions on shared devices.

## Caddy and Let's Encrypt

**Let's Encrypt supplies HTTPS certificates, not DNS hosting or a domain name.** DNS is the address book that points your chosen domain at the machine. Caddy obtains and renews the certificate that encrypts browser traffic.

The root [Caddyfile](../Caddyfile) and [compose.caddy.yaml](../compose.caddy.yaml) are an optional overlay. The base Compose setup remains loopback-only and does not start Caddy. The overlay publishes TCP 80/443 and UDP 443; use it deliberately when you are ready for public access. It covers the web app, `/api/` backend and `/auth/` identity endpoints under one origin. API authentication and shared rate limits still apply; private metrics and the identity admin console are blocked at this public proxy.

Before activation:

- Obtain/control a domain and point its A record to the host's public IPv4 address. Add an AAAA record only if IPv6 really reaches this machine. No DNS-provider API key is needed for this default setup.
- Forward/open ports 80 and 443 to the machine and ensure another service is not using them. Caddy uses HTTP-01 or TLS-ALPN-01 validation. Localhost, a laptop behind CGNAT, or a domain pointing elsewhere will not meet these requirements.
- Set the following in `.env` using your real domain and email:

```dotenv
PUBLIC_DOMAIN=audit.your-domain.com
ACME_EMAIL=you@your-domain.com
APP_ORIGIN=https://audit.your-domain.com
```

Then, when ready:

```powershell
docker compose -f compose.yaml -f compose.caddy.yaml up -d --build
docker compose exec api python scripts/sync_identity.py
```

Register new Google and GitHub callback URLs by replacing `http://localhost:8185` with your exact HTTPS origin. Use HTTPS for the browser thereafter. The API derives its allowed host, callback URLs, CSRF origin and Secure cookie setting from `APP_ORIGIN`; Keycloak uses the same public origin. Caddy preserves the client IP and HTTPS scheme on direct API/identity upstreams. Its certificate/account state persists in `caddy_data` and `caddy_config`; preserve these volumes across recreation.

The Caddyfile explicitly selects Let's Encrypt. For repeated public issuance experiments, use its staging ACME directory first to avoid issuance limits (staging certificates are intentionally not browser-trusted). Public deployment details are maintained in [cloud operations](cloud-deployment.md).

**DNS-01 alternative:** if ports cannot be exposed, DNS validation requires a Caddy build with your DNS provider's module and a narrowly scoped provider token. Stock Caddy does not include every DNS module. Wildcard certificates also require DNS-01. That provider-specific setup is not enabled by this overlay; it cannot be accurately configured until the DNS provider is chosen.

**Return to local HTTP:** stop Caddy with `docker compose -f compose.yaml -f compose.caddy.yaml stop caddy`, restore `APP_ORIGIN=http://localhost:8185`, recreate the base services with `docker compose up -d`, sync identity again, and restore the local OAuth callbacks. Do not use `down -v`: it destroys persistent data. The existing `compose.tls.yaml` and `scripts/tls.py` remain available for self-signed local HTTPS; do not combine the two TLS approaches.

## Verification boundaries

Local checks cover provider gating, PKCE/browser binding, UI states, existing identity/audit workflows, Caddy syntax and local reverse-proxy routing. Google registration has been completed in the owner's account, its credentials are in the ignored `.env`, and the owner's account is in the testing audience. The real Google callback was verified, including denial of workspace access before an explicit owner role assignment. New users still require approval.

After the explicit owner assignment, Google sign-in was completed through to the existing **Workspace overview**, displaying the owner's name and real stored assessments. The GitHub OAuth app and credentials are configured, with local and hosted callback URLs registered. Public Let's Encrypt issuance requires your real domain and reachable ports. Provider setup is separate from backend deployment; see the cloud operations document for the deployed topology and limitations.

## Primary documentation consulted

- [Keycloak server administration](https://www.keycloak.org/docs/latest/server_admin/index.html): identity brokering, social login and account management.
- [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https): local vs public certificates, HTTP/TLS/DNS validation and port requirements.

Fetched with `webcmd web fetch --url <URL>` for both pages. No browser fallback was used. The Keycloak readable extraction is a partial extract of its large administration manual; provider configuration is also checked against the running Keycloak Admin API.

## Connected cloud callback

For the current Vercel frontend and default cloud realm, Google must allow `https://prooflane.akshitjain.space/auth/realms/prooflane/broker/google/endpoint`. The equivalent GitHub callback ends in `/broker/github/endpoint`. Keep local callbacks if the same Google client is used locally. The backend hostname is a proxy upstream, not the browser OAuth origin.

Hosted Google sign-in was verified on 28 September 2026, returning the configured owner to the workspace overview. The existing local callback was retained. The OAuth application was registered with a testing audience; check the provider console before inviting additional users, and separately approve their workspace access. The public identity administrator console is blocked; administer the cloud realm through SSH and the internal identity API.

GitHub sign-in was also verified through its real consent page and callback to the hosted workspace. It requests read-only profile and email access. The owner's authenticated GitHub account is explicitly connected to the same workspace identity as Google; this does not enable automatic email-based account linking for other users.
