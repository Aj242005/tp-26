"""Apply the configured local origin to the existing OIDC client without resetting users."""
import os

import httpx


def main():
    origin = os.environ["APP_ORIGIN"].rstrip("/")
    with httpx.Client(base_url="http://identity:8080/auth", timeout=20) as client:
        token = client.post("/realms/master/protocol/openid-connect/token", data={
            "grant_type": "password", "client_id": "admin-cli", "username": "bootstrap",
            "password": os.environ["KEYCLOAK_ADMIN_PASSWORD"]})
        token.raise_for_status()
        headers = {"Authorization": "Bearer " + token.json()["access_token"]}
        response = client.get("/admin/realms/sih26155/clients", params={"clientId": "sih26155-web"}, headers=headers)
        response.raise_for_status()
        record = response.json()[0]
        record.update(redirectUris=[origin + "/api/auth/callback"], webOrigins=[origin], rootUrl=origin)
        updated = client.put("/admin/realms/sih26155/clients/" + record["id"], json=record, headers=headers)
        updated.raise_for_status()
    print("Local OIDC client origin synchronized; users preserved")


if __name__ == "__main__":
    main()
