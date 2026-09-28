import json
from contextlib import contextmanager
from types import SimpleNamespace
from urllib.parse import parse_qs, urlsplit

import pytest
from fastapi import HTTPException, Request

from scripts.identity_config import social_providers
from service import auth
from service.config import Settings


@pytest.mark.asyncio
async def test_social_login_keeps_pkce_browser_binding_and_explicit_provider_gate(monkeypatch):
    cfg = Settings(_env_file=None, app_secret_key="x" * 40, google_client_id="test-client",
                   google_client_secret="test-secret", app_origin="https://prooflane.example",
                   oidc_issuer_url="https://prooflane.example/auth/realms/prooflane")
    monkeypatch.setattr(auth, "settings", lambda: cfg)
    records = []

    @contextmanager
    def transaction():
        yield SimpleNamespace(add=records.append)

    monkeypatch.setattr(auth, "transaction", transaction)
    request = Request({"type": "http", "method": "GET", "path": "/api/auth/login",
                       "headers": [], "query_string": b"provider=google"})
    response = await auth.login(request)
    query = parse_qs(urlsplit(response.headers["location"]).query)
    assert query["kc_idp_hint"] == ["google"]
    assert query["code_challenge_method"] == ["S256"]
    assert all(query[key] for key in ("state", "nonce", "code_challenge"))
    saved = json.loads(auth.seal().decrypt(records[0].data["sealed"].encode()))
    assert saved["nonce"] == query["nonce"][0]
    assert saved["verifier"] and saved["binding"]
    cookie = response.headers["set-cookie"]
    assert "HttpOnly" in cookie and "Secure" in cookie and "SameSite=lax" in cookie
    assert "test-secret" not in response.headers["location"]
    assert auth.providers() == [{"id": "google", "name": "Google", "configured": True},
                                {"id": "github", "name": "GitHub", "configured": False}]
    assert auth.provider_hint(None) == {}
    for name, status in (("github", 503), ("https://attacker.example", 400)):
        with pytest.raises(HTTPException) as error:
            auth.provider_hint(name)
        assert error.value.status_code == status


def test_broker_definitions_never_auto_grant_tenancy_or_trust_email():
    providers = social_providers({"GOOGLE_CLIENT_ID": "id", "GOOGLE_CLIENT_SECRET": "secret"})
    assert [p["enabled"] for p in providers] == [True, False]
    for provider in providers:
        assert provider["trustEmail"] is False and provider["storeToken"] is False
        assert provider["firstBrokerLoginFlowAlias"] == "first broker login"
        assert "tenant_id" not in json.dumps(provider)
        assert "realmRoles" not in provider
