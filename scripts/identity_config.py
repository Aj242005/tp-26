"""Keycloak broker definitions shared by initial import and non-destructive sync."""


def social_providers(values):
    providers = []
    for alias, label, scope in (("google", "Google", "openid profile email"),
                                ("github", "GitHub", "read:user user:email")):
        client_id = values.get(f"{alias.upper()}_CLIENT_ID", "")
        secret = values.get(f"{alias.upper()}_CLIENT_SECRET", "")
        providers.append({
            "alias": alias, "providerId": alias, "displayName": label,
            "enabled": bool(client_id and secret), "trustEmail": False,
            "storeToken": False, "addReadTokenRoleOnCreate": False,
            "firstBrokerLoginFlowAlias": "first broker login",
            "config": {"clientId": client_id or "", "clientSecret": secret or "",
                       "defaultScope": scope, "syncMode": "IMPORT"},
        })
    return providers
