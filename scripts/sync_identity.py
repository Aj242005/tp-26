"""Sync Prooflane branding, origin and social providers without resetting users."""
import os

import httpx
from identity_config import social_providers


def main():
    origin = os.environ["APP_ORIGIN"].rstrip("/")
    realm_path = "/admin/realms/" + os.environ.get("OIDC_REALM", "prooflane")
    with httpx.Client(base_url="http://identity:8080/auth", timeout=20) as client:
        token = client.post("/realms/master/protocol/openid-connect/token", data={
            "grant_type": "password", "client_id": "admin-cli", "username": "bootstrap",
            "password": os.environ["KEYCLOAK_ADMIN_PASSWORD"]})
        token.raise_for_status()
        headers = {"Authorization": "Bearer " + token.json()["access_token"]}
        response = client.get(realm_path + "/clients", params={"clientId": os.environ.get("OIDC_CLIENT_ID", "prooflane-web")}, headers=headers)
        response.raise_for_status()
        record = response.json()[0]
        record.update(name="Prooflane", redirectUris=[origin + "/api/auth/callback"],
                      webOrigins=[origin], rootUrl=origin)
        updated = client.put(realm_path + "/clients/" + record["id"], json=record, headers=headers)
        updated.raise_for_status()
        realm = client.put(realm_path, headers=headers, json={"displayName": "Prooflane", "sslRequired": "external" if origin.startswith("https://") else "none", "internationalizationEnabled": False})
        realm.raise_for_status()
        for provider in social_providers(os.environ):
            path = realm_path + "/identity-provider/instances"
            existing = client.get(path + "/" + provider["alias"], headers=headers)
            if existing.status_code == 404:
                result = client.post(path, headers=headers, json=provider)
            else:
                existing.raise_for_status()
                result = client.put(path + "/" + provider["alias"], headers=headers, json=provider)
            result.raise_for_status()
            print(provider["displayName"] + (": configured" if provider["enabled"] else ": disabled (credentials missing)"))
        # Tenancy must be administrator-owned, never a field a social user can self-assign.
        path = realm_path + "/users/profile"
        profile_response = client.get(path, headers=headers)
        profile_response.raise_for_status()
        profile = profile_response.json()
        profile["attributes"] = [a for a in profile.get("attributes", []) if a["name"] != "tenant_id"] + [
            {"name": "tenant_id", "displayName": "Workspace organization ID",
             "permissions": {"view": ["admin"], "edit": ["admin"]}, "multivalued": False}]
        result = client.put(path, headers=headers, json=profile)
        result.raise_for_status()
    print("Prooflane identity configuration synchronized; existing users and roles preserved")


if __name__ == "__main__":
    main()
