"""Scan publishable text files; report locations, never matching credential values."""
import re
import subprocess
import sys
from pathlib import Path

from dotenv import dotenv_values

root = Path(__file__).resolve().parents[1]
files = subprocess.run(["rg", "--files", "--hidden", "-g", "!.git"], cwd=root, capture_output=True, text=True, check=True).stdout.splitlines()
patterns = {
    "Google API credential": re.compile(r"(?:AIza[A-Za-z0-9_-]{30,}|AQ\.[A-Za-z0-9_-]{35,})"),
    "Google OAuth secret": re.compile(r"GOCSPX-[A-Za-z0-9_-]{20,}"),
    "Provider secret token": re.compile(r"\bsk-[A-Za-z0-9_-]{24,}"),
    "Private key material": re.compile(r"-----BEGIN (?:RSA |EC )?PRIVATE KEY-----\r?\n[A-Za-z0-9+/=]{32,}"),
}
for name, value in dotenv_values(root / ".env").items():
    if name in ("GOOGLE_CLIENT_SECRET", "GITHUB_CLIENT_SECRET") and value and len(value) >= 16:
        patterns["Configured " + name] = re.compile(re.escape(value))
findings = []
for name in files:
    path = root / name
    if path.stat().st_size > 5 * 1024 * 1024:
        continue
    try:
        content = path.read_text(encoding="utf-8")
    except UnicodeError:
        continue
    for label, pattern in patterns.items():
        for match in pattern.finditer(content):
            findings.append(f"{name}:{content[:match.start()].count(chr(10)) + 1}: {label}")
if findings:
    print("\n".join(findings))
    sys.exit(1)
print(f"No known credential patterns found in {len(files)} publishable files; .env/runtime remain excluded")
