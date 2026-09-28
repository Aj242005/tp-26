"""Generate only missing local secrets and identity configuration. Never print secrets."""
import base64
import json
import os
import secrets
from pathlib import Path

from dotenv import dotenv_values, set_key

ROOT = Path(__file__).resolve().parents[1]


def main():
    env = ROOT / ".env"
    if not env.exists():
        env.write_text((ROOT / ".env.example").read_text(encoding="utf-8"), encoding="utf-8")
    values = dict(dotenv_values(env))
    names = ("APP_SECRET_KEY", "POSTGRES_PASSWORD", "APP_DB_PASSWORD", "WORKER_DB_PASSWORD",
             "REDIS_PASSWORD", "S3_SECRET_ACCESS_KEY", "OIDC_CLIENT_SECRET", "KEYCLOAK_ADMIN_PASSWORD",
             "KEYCLOAK_DB_PASSWORD", "LOCAL_ADMIN_PASSWORD", "LOCAL_AUDITOR_PASSWORD", "LOCAL_OTHER_PASSWORD")
    for name in names:
        if not values.get(name):
            values[name] = secrets.token_urlsafe(32)
            set_key(env, name, values[name], quote_mode="never")
    for name, value in {"DATA_ENCRYPTION_KEY": base64.urlsafe_b64encode(os.urandom(32)).decode(),
                        "S3_ACCESS_KEY_ID": "sih" + secrets.token_hex(8)}.items():
        if not values.get(name):
            values[name] = value
            set_key(env, name, value, quote_mode="never")
    origin = values.get("APP_ORIGIN") or "http://localhost:8185"
    roles = ["viewer", "auditor", "reviewer", "admin"]
    users = []
    for username, password_key, assigned, tenant in (
        ("admin", "LOCAL_ADMIN_PASSWORD", roles, "00000000-0000-0000-0000-000000000001"),
        ("auditor", "LOCAL_AUDITOR_PASSWORD", ["viewer", "auditor"], "00000000-0000-0000-0000-000000000001"),
        ("other", "LOCAL_OTHER_PASSWORD", roles, "00000000-0000-0000-0000-000000000002"),
    ):
        users.append({"username": username, "enabled": True, "emailVerified": True,
                      "firstName": username.title(), "lastName": "Local", "email": f"{username}@localhost.test",
                      "credentials": [{"type": "password", "value": values[password_key], "temporary": False}],
                      "realmRoles": assigned, "attributes": {"tenant_id": [tenant]}})
    realm = {"realm": "sih26155", "enabled": True, "registrationAllowed": False,
             "sslRequired": "none", "bruteForceProtected": True, "failureFactor": 5,
             "roles": {"realm": [{"name": role} for role in roles]}, "users": users,
             "clients": [{"clientId": "sih26155-web", "enabled": True, "publicClient": False,
                          "secret": values["OIDC_CLIENT_SECRET"], "standardFlowEnabled": True,
                          "directAccessGrantsEnabled": False,
                          "redirectUris": [origin + "/api/auth/callback"], "webOrigins": [origin],
                          "attributes": {"pkce.code.challenge.method": "S256"},
                          "protocolMappers": [{"name": "tenant", "protocol": "openid-connect",
                              "protocolMapper": "oidc-usermodel-attribute-mapper",
                              "config": {"user.attribute": "tenant_id", "claim.name": "tenant_id",
                                         "jsonType.label": "String", "id.token.claim": "true",
                                         "access.token.claim": "true"}},
                              {"name": "roles", "protocol": "openid-connect",
                               "protocolMapper": "oidc-usermodel-realm-role-mapper",
                               "config": {"claim.name": "roles", "multivalued": "true",
                                          "id.token.claim": "true", "jsonType.label": "String"}}]}]}
    runtime = ROOT / "runtime"
    runtime.mkdir(exist_ok=True)
    (runtime / "realm.json").write_text(json.dumps(realm, indent=2), encoding="utf-8")
    s3 = {"identities": [{"name": "local-application", "credentials": [
        {"accessKey": values["S3_ACCESS_KEY_ID"], "secretKey": values["S3_SECRET_ACCESS_KEY"]}],
        "actions": ["Admin", "Read", "Write", "List", "Tagging"]}]}
    (runtime / "s3.json").write_text(json.dumps(s3), encoding="utf-8")
    print("Local secrets and identity realm are ready. Passwords remain in .env.")
    print("Login users: admin, auditor, other (separate organization).")
    print("Gemini configured:", bool(values.get("GEMINI_API_KEY") and values.get("GEMINI_MODEL")))


if __name__ == "__main__":
    main()
