# Security boundaries

The application audits uploaded configuration files. It has no device credentials, SSH connector, live-device write action or generated-code execution facility.

## Enforced boundaries

- OIDC Authorization Code + PKCE, validated issuer/audience/nonce/signature, one-use browser-bound login state, random server sessions, HttpOnly/SameSite cookies and eight-hour session expiry. TLS mode adds Secure cookies.
- Viewer, auditor, reviewer and admin roles. Mutations require a session CSRF token and same-origin validation. Raw configuration access is restricted to auditors and recorded; default source views redact known credential patterns.
- Organization identifiers derive from validated identity claims. PostgreSQL RLS applies under non-owner app/worker roles and transaction-local tenant context. The worker role has cross-tenant job-claim access only; entity reads require tenant context. Application roles can append audit events but cannot modify/delete them.
- AES-GCM artifact encryption with fresh nonces, object-key binding and plaintext SHA-256 verification. Tenant prefixes are checked before artifact access. Private objects are served only through authorized API routes.
- Bounded UTF-8 uploads; no archive extraction in the configuration flow. Declarative selectors use fixed operations; XML uses defusedxml, generated regex/code is forbidden, and parsing runs in a timed subprocess within container memory limits.
- Configurations and reference documents are untrusted model input. Gemini receives redacted, bounded excerpts and approved references. Its allowlisted tools search passages, test/propose mappings and ask clarifications. No model output can approve a mapping or determine a final pass/fail verdict.
- API/worker networks have no general outbound route. The dedicated egress proxy uses TLS verification and fixed Google upstream hosts. No arbitrary URL-fetch tool exists.
- Shared token buckets, provider concurrency leases, daily token reservations, job fencing, bounded retries and safe failure messages. Valkey loss fails closed for expensive work.

## Interpretation limitations

The initial normalizers prove declared technical properties only. A VTY ACL binding does not prove effective packet restrictions; enabling authentication mode does not prove remote-server reachability; an SNMPv3 privacy group does not prove every user is secured. Unknown/default/inherited settings are not silently counted as compliant.

Mapping test cases are evidence for their stated inputs, not a proof over every firmware/configuration. AI-generated expected values are not independent ground truth. Human review and independently labelled vendor cases are required before relying on expanded coverage operationally.

## Local release limitations

Two local organizations and bootstrap accounts are configured explicitly. Role/membership changes in Keycloak do not retroactively change an existing application session; revoke affected sessions or wait for expiry. The event log is append-only for runtime roles, not tamper-proof against a database administrator. One data key is active at a time; automatic multi-key rotation is not provided. The local machine and Docker daemon remain trusted.

Redaction recognizes common credential forms; no generic redactor can guarantee discovery of every proprietary secret syntax. Review unfamiliar sensitive input before using hosted inference. Provider retention/account settings are separate from local storage and must be configured for the intended data.

Dependency and image scans are point-in-time evidence, not a guarantee of absence of vulnerabilities. See actual results and any dispositions in [verification](verification.md).
