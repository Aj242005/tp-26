# Dependency and image review

Measured 28 September 2026 using the locked Python/JavaScript dependencies and the pinned container images. This is a local release with unresolved upstream image findings, not a vulnerability-free certification. Keep the gateway bound to loopback. Reassess these findings before exposing any service to untrusted networks.

## Changes made

- Upgraded cryptography to 50.0.1 and removed build-only uv and pip from the application runtime image. The runtime Python dependency audit and pnpm audit reported no known vulnerabilities at this check.
- Updated both NGINX runtime images to 1.30.5; the resulting web and Google egress images have no reported package vulnerabilities.
- Upgraded Keycloak from 26.6.4 to the registry's stable 26.7.4 release, pinned by digest. The scan no longer reports the core reset-credentials account-takeover issue, CVE-2026-18963. A verified encrypted backup was taken first. Sign-in and application workflows are tested against the existing database after the upgrade.
- Generated a CycloneDX SBOM for every runtime and optional observability image. Reports and exact image IDs are in `runtime/security/inventory.json` and its referenced files. Counts include duplicate package occurrences; they are not unique CVE counts.

## Remaining findings and exposure

**Keycloak:** Four critical package occurrences remain: Netty SNI routing (CVE-2026-75595), Bouncy Castle certificate name constraints (CVE-2026-8763, two occurrences), and FreeMarker locale-based template traversal (CVE-2026-84939). Keycloak serves internal HTTP; NGINX terminates optional TLS, and there is no Netty SNI-based mutual-TLS gate. No external identity broker, X.509 login or user-provided certificate chain is configured. These facts limit the first two vulnerabilities' described prerequisites. For FreeMarker, the live realm database has internationalization disabled; the exact 26.7.4 locale selector then returns `Locale.ENGLISH` before consulting user/request locale. Its default FreeMarker provider creates a fresh configuration and calls `getTemplate(templateName, "UTF-8")` without setting a request-supplied locale. These source/configuration checks constrain the advisory's attacker-controlled-locale prerequisite in the default provider. They do not patch the library or assess custom providers/themes; the package finding remains open and unsuppressed. Seven high occurrences also remain, including OS PCRE2, a bundled unused SQL Server JDBC driver (the configured database is PostgreSQL), and Bouncy Castle ASN.1 handling. Use a vendor release that fixes these libraries and repeat sign-in/security checks before external hosting; do not silently replace vendor JARs with an untested custom distribution.

**Application Debian base:** 44 high package occurrences represent eight advisory IDs across util-linux, ACL, ncurses, systemd libraries and Perl. No distribution fixed version was supplied by this scan. The reported paths concern privileged mount/nsenter operations, systemd-homed, infocmp or Perl Archive::Tar. The service runs as UID 10001, drops capabilities, has a read-only filesystem and no host mounts/control socket, and does not invoke those tools or services. These are reachability constraints, not package fixes. Track Debian base updates and rescan.

**PostgreSQL image:** The critical Go TLS issue (CVE-2025-68121) and all 21 high occurrences are attributed to the bundled `gosu` privilege-dropping helper, not the PostgreSQL server or Alpine packages. The helper receives a fixed service user/command at startup; it does not serve HTTP/TLS. Inspection of the actual binary found no `crypto/tls.`, `crypto/x509.`, `net/http.` or `net/url.` symbols, which supports the TLS reachability assessment but does not establish absence of every Go-runtime issue. Retain the finding and upgrade the official helper/image when available.

**SeaweedFS:** One high finding, gRPC malformed-request denial of service (CVE-2026-84445), is associated with a development-version dependency. Its version string does not establish whether the fixed commit is present. Storage is on the private data network with no published gRPC port or general user-controlled RPC proxy. The version ambiguity and internal-service risk remain open. One unmaintained OpenPGP dependency is also reported with unknown severity.

**Optional Grafana:** 104 high package occurrences remain in OS and bundled Go/plugin dependencies. This profile is stopped after verification and is not qualified for untrusted external access. Its ports are loopback-only when enabled. Upgrade and rescan the optional monitoring stack before broader use. Prometheus and OpenTelemetry have only unknown-severity lifecycle findings in this scan, which still warrant tracking.

The full severity counts below are generated from the retained inventory. Scanner databases are point-in-time evidence, and a zero count does not prove exploit resistance. No suppression file hides these results.

## Reproduce

`uv run python scripts/scan_images.py --optional` scans all configured images and generates SBOMs. The scanner uses a pinned Trivy 0.74 image, offline vulnerability/Java databases after their initial download, and a Linux Docker volume for archive processing. It is not given the Docker control socket. `--image <exact-image-reference>` rescans a replacement and retains other inventory entries.

## Source check

The official registry tag list was fetched with `webcmd web fetch` from <https://quay.io/api/v1/repository/keycloak/keycloak/tag/?onlyActiveTags=true&limit=25>. It identified stable 26.7.4 and its digest. The initially attempted 26.6.6 tag was unavailable; no nightly image was selected. No browser fallback was needed. Advisory descriptions and fixed-version fields are retained in the raw Trivy reports; runtime reachability judgments above are local assessments, not vendor attestations.

The same command fetched the exact-version [locale selector](https://raw.githubusercontent.com/keycloak/keycloak/26.7.4/services/src/main/java/org/keycloak/locale/DefaultLocaleSelectorProvider.java) and [FreeMarker provider](https://raw.githubusercontent.com/keycloak/keycloak/26.7.4/services/src/main/java/org/keycloak/theme/freemarker/DefaultFreeMarkerProvider.java). Local copies are retained in `runtime/keycloak-locale-source.txt` and `runtime/keycloak-freemarker-source.txt`. A read-only query of `realm.internationalization_enabled` and `registration_allowed` returned false for both in `prooflane`. No browser fallback was needed.

## Image finding counts

| Image | Critical | High | Medium | Low | Unknown |
| --- | ---: | ---: | ---: | ---: | ---: |
| prooflane-web:local | 0 | 0 | 0 | 0 | 0 |
| valkey/valkey:8-alpine | 0 | 0 | 0 | 0 | 0 |
| nginxinc/nginx-unprivileged:stable-alpine | 0 | 0 | 0 | 0 | 0 |
| chrislusf/seaweedfs | 0 | 1 | 0 | 0 | 1 |
| otel/opentelemetry-collector-contrib | 0 | 0 | 0 | 0 | 1 |
| postgres:17-alpine | 1 | 21 | 21 | 2 | 1 |
| prom/prometheus | 0 | 0 | 0 | 0 | 2 |
| prooflane-app:local | 0 | 44 | 53 | 57 | 2 |
| grafana/grafana | 0 | 104 | 33 | 35 | 6 |
| quay.io/keycloak/keycloak:26.7.4 | 4 | 7 | 50 | 26 | 0 |
