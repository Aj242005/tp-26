# Vercel frontend

Canonical application: **https://prooflane.akshitjain.space**. Backend gateway: **https://proof-lane.akshitjain.space**.

Vercel serves the compiled React application at the custom frontend domain. External rewrites forward `/api` and `/auth` to the HTTPS backend. The browser keeps the frontend origin throughout sign-in and audit requests. Database, object storage, workers, Gemini credentials and OAuth secrets stay on the backend.

The previous `prooflane-five.vercel.app` address has a Vercel project-domain 308 redirect to `prooflane.akshitjain.space`. Keep that redirect so shared links reach the same browser origin and session cookies.

## Connected release

Run from `web/` in the owner's already linked `prooflane` project:

```powershell
pnpm install --frozen-lockfile
$env:PROOFLANE_BACKEND_ORIGIN='https://proof-lane.akshitjain.space'
pnpm build:vercel:connected
npx --yes vercel@60.1.3 deploy --prebuilt --prod
```

The backend must be reachable with a valid public certificate first. On the backend, set both `APP_ORIGIN` and `FRONTEND_ORIGIN` to `https://prooflane.akshitjain.space`, and `PUBLIC_DOMAIN` to `proof-lane.akshitjain.space`. Recreate the affected services and sync identity after changing the origin or OAuth configuration. Visits to the backend homepage redirect to the frontend. See [identity and HTTPS](identity-and-https.md) and [cloud operations](cloud-deployment.md).

`prepare-vercel.mjs` creates a Build Output API deployment from `dist/`. API and identity responses are not cached; fingerprinted browser assets are immutable. Keycloak supplies the Content Security Policy for its own identity pages. Other pages retain the frontend policy. SPA refreshes fall back to `index.html`; missing assets return 404.

The upload contains compiled assets and routing configuration. Root `.env`, private keys and runtime files are excluded. Never put credentials in `VITE_*` variables. `.vercel/` is ignored because it contains local linkage and generated output.

Git automatic deployments are disconnected. Publish using the prebuilt command above; a plain root-level deployment does not configure the backend or identity service.

## Frontend-only preview

`pnpm build:vercel` deliberately builds a preview that explains the missing backend and returns uncached 503 responses for reserved backend paths. Use `node scripts/check-frontend.mjs <url>` only for this preview mode. Ordinary `pnpm build` and Docker builds produce the authenticated application.

## Release checks

Check public HTTPS, API readiness, unauthenticated access denial, identity discovery, sign-in, a configuration upload, a completed audit, the interactive audit trail, and report download. Verify that metrics and the identity administrator console remain blocked at the public gateway. A frontend build alone is not proof that these backend workflows work.

Routing reference: [Vercel rewrites](https://vercel.com/docs/routing/rewrites), consulted 28 September 2026. External rewrites act as a reverse proxy; cache behaviour depends on upstream and route headers.

The connected checks passed on 28 September 2026. To repeat them from `web/`, set `PROOFLANE_ENV_FILE` to the private environment file for the target workspace, then run `node scripts/check-connected.mjs https://prooflane.akshitjain.space`. The check uploads a synthetic configuration and leaves its completed audit available for inspection; it does not change live devices. Results and screenshots stay under ignored `runtime/cloud/checks/`.
