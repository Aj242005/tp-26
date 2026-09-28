import base64
import hashlib
import json
import secrets
from datetime import timedelta

import httpx
from authlib.integrations.httpx_client import AsyncOAuth2Client
from authlib.jose import JsonWebToken
from cryptography.fernet import Fernet
from fastapi import HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy import select

from service.config import settings
from service.db import LoginSession, LoginState, digest, event, now, transaction

ROLES = {"viewer", "auditor", "reviewer", "admin"}


def providers():
    cfg = settings()
    return [{"id": alias, "name": name,
             "configured": bool(getattr(cfg, alias + "_client_id") and getattr(cfg, alias + "_client_secret"))}
            for alias, name in (("google", "Google"), ("github", "GitHub"))]


def provider_hint(provider):
    if not provider:
        return {}
    matches = [item for item in providers() if item["id"] == provider]
    if not matches:
        raise HTTPException(400, "Choose Google, GitHub, or workspace sign-in")
    if not matches[0]["configured"]:
        raise HTTPException(503, "This sign-in provider has not been configured by the workspace administrator")
    return {"kc_idp_hint": provider}


def seal():
    return Fernet(base64.urlsafe_b64encode(hashlib.sha256(settings().app_secret_key.encode()).digest()))


def current_user(request: Request):
    if hasattr(request.state, "user"):
        return request.state.user
    token = request.cookies.get("sih_session", "")
    if not token or len(token) > 200:
        raise HTTPException(401, "Sign in to your workspace")
    with transaction() as db:
        session = db.scalar(select(LoginSession).where(LoginSession.id == digest(token),
                                                       LoginSession.expires_at > now()))
        if session is None:
            raise HTTPException(401, "Your session has expired. Sign in again")
        request.state.user = {**session.data, "tenant_id": session.tenant_id, "session_id": session.id}
        return request.state.user


def require(request: Request, role="viewer"):
    user = current_user(request)
    if role not in user["roles"] and "admin" not in user["roles"]:
        raise HTTPException(403, f"The {role} role is required")
    if request.method not in ("GET", "HEAD", "OPTIONS"):
        if not secrets.compare_digest(request.headers.get("X-CSRF-Token", ""), user["csrf"]):
            raise HTTPException(403, "Refresh the page and try again: CSRF token is missing or invalid")
        origin = request.headers.get("Origin")
        if origin and origin != settings().app_origin:
            raise HTTPException(403, "Request origin is not permitted")
    return user


async def login(request: Request):
    cfg = settings()
    hint = provider_hint(request.query_params.get("provider"))
    state, nonce, verifier, binding = (secrets.token_urlsafe(32) for _ in range(4))
    async with AsyncOAuth2Client(cfg.oidc_client_id, cfg.oidc_client_secret, scope="openid profile email",
                                 redirect_uri=cfg.app_origin + "/api/auth/callback",
                                 code_challenge_method="S256") as client:
        url, _ = client.create_authorization_url(cfg.oidc_issuer_url + "/protocol/openid-connect/auth",
                                                 state=state, nonce=nonce, code_verifier=verifier, **hint)
    payload = {"nonce": nonce, "verifier": verifier, "binding": digest(binding)}
    with transaction() as db:
        db.add(LoginState(id=digest(state), data={"sealed": seal().encrypt(json.dumps(payload).encode()).decode()},
                          expires_at=now() + timedelta(minutes=5)))
    response = RedirectResponse(url, status_code=302)
    response.set_cookie("sih_login", binding, max_age=300, httponly=True, secure=cfg.secure_cookies,
                        samesite="lax", path="/api/auth")
    return response


async def callback(request: Request):
    cfg = settings()
    state, code = request.query_params.get("state", ""), request.query_params.get("code", "")
    if not state or not code or len(state) > 200 or len(code) > 4000:
        raise HTTPException(400, "Login was not completed. Start sign-in again")
    with transaction() as db:
        row = db.scalar(select(LoginState).where(LoginState.id == digest(state),
                                                 LoginState.expires_at > now()).with_for_update())
        if row is None:
            raise HTTPException(400, "Login expired or was already used. Start sign-in again")
        saved = json.loads(seal().decrypt(row.data["sealed"].encode()))
        if not secrets.compare_digest(saved["binding"], digest(request.cookies.get("sih_login", ""))):
            raise HTTPException(400, "Login browser validation failed")
        db.delete(row)
    try:
        async with AsyncOAuth2Client(cfg.oidc_client_id, cfg.oidc_client_secret,
                                     redirect_uri=cfg.app_origin + "/api/auth/callback", timeout=10) as client:
            token = await client.fetch_token(cfg.oidc_internal_url + "/protocol/openid-connect/token",
                                              code=code, code_verifier=saved["verifier"])
        async with httpx.AsyncClient(timeout=10) as http:
            keys = (await http.get(cfg.oidc_internal_url + "/protocol/openid-connect/certs"))
            keys.raise_for_status()
        claims = JsonWebToken(["RS256"]).decode(token["id_token"], keys.json(), claims_options={
            "iss": {"essential": True, "value": cfg.oidc_issuer_url},
            "aud": {"essential": True, "value": cfg.oidc_client_id},
            "nonce": {"essential": True, "value": saved["nonce"]},
            "exp": {"essential": True}, "sub": {"essential": True}})
        claims.validate(leeway=15)
    except Exception as exc:
        raise HTTPException(502, "Identity verification failed. Check the local identity service") from exc
    tenant = claims.get("tenant_id", "")
    roles = sorted(ROLES.intersection(claims.get("roles", [])))
    if tenant not in (cfg.default_tenant_id, "00000000-0000-0000-0000-000000000002") or not roles:
        response = RedirectResponse("/?access=pending", status_code=302)
        response.delete_cookie("sih_login", path="/api/auth")
        # An account switch must not leave the previous identity visible as the new one.
        response.delete_cookie("sih_session", path="/")
        return response
    session_token = secrets.token_urlsafe(40)
    profile = {"subject": claims["sub"], "name": claims.get("name", claims.get("preferred_username", "User")),
               "username": claims.get("preferred_username", ""), "roles": roles,
               "csrf": secrets.token_urlsafe(32)}
    with transaction(tenant) as db:
        db.add(LoginSession(id=digest(session_token), tenant_id=tenant, data=profile,
                            expires_at=now() + timedelta(hours=8)))
        event(db, tenant, profile["subject"], "session.created", "workspace")
    response = RedirectResponse("/", status_code=302)
    response.set_cookie("sih_session", session_token, max_age=28800, httponly=True,
                        secure=cfg.secure_cookies, samesite="lax", path="/")
    response.delete_cookie("sih_login", path="/api/auth")
    return response
