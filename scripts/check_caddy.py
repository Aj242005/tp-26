"""Check the real Caddy routing on loopback, without public ACME issuance."""
import subprocess
import time
from pathlib import Path

import httpx
from dotenv import dotenv_values


def main():
    root = Path(__file__).resolve().parents[1]
    cfg = dotenv_values(root / ".env")
    project = cfg.get("COMPOSE_PROJECT_NAME", "prooflane")
    realm = cfg.get("OIDC_REALM", "prooflane")
    name = "prooflane-caddy-check"
    image = "caddy:2.11.2-alpine@sha256:834468128c7696cec0ceea6172f7d692daf645ae51983ca76e39da54a97c570d"
    subprocess.run(["docker", "run", "-d", "--name", name, "--network", project + "_application",
                    "--network", project + "_edge", "-p", "127.0.0.1:8186:8080",
                    "-e", "PUBLIC_DOMAIN=http://localhost:8080", "-e", "ACME_EMAIL=operator@example.com",
                    "--mount", f"type=bind,source={root / 'Caddyfile'},target=/etc/caddy/Caddyfile,readonly",
                    image], capture_output=True, check=True)
    try:
        with httpx.Client(base_url="http://localhost:8186", timeout=3) as client:
            for _ in range(10):
                try:
                    if client.get("/api/health/live").status_code == 200:
                        break
                except httpx.TransportError:
                    pass
                time.sleep(1)
            checks = {"/": 200, "/api/health/live": 200, "/api/me": 401, "/api/auth/providers": 200,
                      f"/auth/realms/{realm}/.well-known/openid-configuration": 200,
                      "/api/metrics": 404, "/api/metrics/": 404, "/auth/admin/": 404,
                      "/auth/admin/realms": 404}
            for path, expected in checks.items():
                response = client.get(path)
                assert response.status_code == expected, (path, response.status_code)
            assert "Prooflane" in client.get("/").text
            print("Caddy: nine real upstream/status checks passed; branding and private endpoint blocks verified.")
    finally:
        subprocess.run(["docker", "rm", "-f", name], capture_output=True, check=True)


if __name__ == "__main__":
    main()
