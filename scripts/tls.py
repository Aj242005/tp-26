"""Create a local self-signed localhost certificate. No certificate is installed as trusted."""
import ipaddress
from datetime import UTC, datetime, timedelta
from pathlib import Path

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID

root = Path(__file__).resolve().parents[1]
directory = root / "runtime" / "tls"
directory.mkdir(parents=True, exist_ok=True)
if not (directory / "localhost.key").exists():
    key = rsa.generate_private_key(public_exponent=65537, key_size=3072)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "localhost")])
    cert = (x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key())
            .serial_number(x509.random_serial_number()).not_valid_before(datetime.now(UTC) - timedelta(minutes=5))
            .not_valid_after(datetime.now(UTC) + timedelta(days=90))
            .add_extension(x509.SubjectAlternativeName([x509.DNSName("localhost"), x509.IPAddress(ipaddress.ip_address("127.0.0.1"))]), critical=False)
            .sign(key, hashes.SHA256()))
    (directory / "localhost.key").write_bytes(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
    (directory / "localhost.crt").write_bytes(cert.public_bytes(serialization.Encoding.PEM))
config = (root / "ops" / "nginx.conf").read_text()
config = config.replace("listen 8080;", "listen 8443 ssl;\n    ssl_certificate /etc/local-tls/localhost.crt;\n    ssl_certificate_key /etc/local-tls/localhost.key;\n    ssl_protocols TLSv1.2 TLSv1.3;")
config = config.replace("X-Forwarded-Port 8185", "X-Forwarded-Port 8443")
config = config.replace("  server {", "  server { listen 8080; return 308 https://localhost:8443$request_uri; }\n  server {", 1)
(directory / "nginx.conf").write_text(config, encoding="utf-8")
print("Local TLS files ready in runtime/tls; certificate is self-signed and valid for 90 days")
