"""Consistent, encrypted local backup and isolated restore rehearsal. Never copies .env."""
import argparse
import base64
import hashlib
import io
import json
import os
import re
import subprocess
import time
import zipfile
from datetime import UTC, datetime
from pathlib import Path

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[1]
CONFIG = dotenv_values(ROOT / ".env")
ENV = os.environ.copy()


def run(project, *args, content=None):
    command = ["docker", "compose", "-p", project, "-f", "compose.yaml", *args]
    result = subprocess.run(command, cwd=ROOT, env=ENV, input=content, capture_output=True)
    if result.returncode:
        # Raw command output may contain connection strings. Print operation only.
        raise RuntimeError("Docker operation failed: " + " ".join(args[:3]))
    return result.stdout


def key():
    return base64.urlsafe_b64decode(CONFIG["DATA_ENCRYPTION_KEY"])


def backup(project):
    writers = [name for name in run(project, "ps", "--services", "--status", "running").decode().splitlines()
               if name in ("gateway", "api", "worker", "maintenance", "identity")]
    run(project, "stop", *writers)
    try:
        before = json.loads(run(project, "run", "--rm", "--no-deps", "api", "python", "-m", "service.snapshot", "verify"))
        parts = {database + ".dump": run(project, "exec", "-T", "database", "pg_dump", "-U", "postgres", "-Fc", database)
                 for database in (CONFIG.get("POSTGRES_DB", "prooflane"), "keycloak")}
        parts["objects.zip"] = run(project, "run", "--rm", "--no-deps", "api", "python", "-m", "service.snapshot", "export")
        parts["verification.json"] = json.dumps(before).encode()
        manifest = {"format": 1, "created_at": datetime.now(UTC).isoformat(), "key_fingerprint": hashlib.sha256(key()).hexdigest()[:16],
                    "sha256": {name: hashlib.sha256(data).hexdigest() for name, data in parts.items()}}
        parts["manifest.json"] = json.dumps(manifest).encode()
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for name, data in parts.items():
                archive.writestr(name, data)
        if buffer.tell() > 1024 * 1024 * 1024:
            raise RuntimeError("This local backup tool is limited to 1 GiB; use streaming storage backups for larger data")
        nonce = os.urandom(12)
        sealed = b"SIHB1" + nonce + AESGCM(key()).encrypt(nonce, buffer.getvalue(), CONFIG.get("BACKUP_CONTEXT", "prooflane-backup-v1").encode())
        directory = ROOT / "runtime" / "backups"
        directory.mkdir(parents=True, exist_ok=True)
        path = directory / (datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ") + ".sihbackup")
        path.write_bytes(sealed)
        print(json.dumps({"backup": str(path), "bytes": len(sealed), "artifacts_verified": before["verified_artifacts"]}))
        (ROOT / "runtime" / "latest-backup.json").write_text(json.dumps({"path": str(path), **manifest}), encoding="utf-8")
    finally:
        run(project, "start", *writers)


def restore(path, project, port):
    if not re.fullmatch(r"prooflane-restore[a-z0-9-]*", project):
        raise ValueError("Restore requires a separate project named prooflane-restore...")
    existing = subprocess.run(["docker", "ps", "-a", "-q", "--filter", "label=com.docker.compose.project=" + project],
                               capture_output=True, check=True).stdout.strip()
    if existing:
        raise ValueError("The restore project must be new; existing containers are never overwritten")
    started = time.monotonic()
    blob = path.read_bytes()
    if not blob.startswith(b"SIHB1"):
        raise ValueError("Unsupported backup format")
    plaintext = AESGCM(key()).decrypt(blob[5:17], blob[17:], CONFIG.get("BACKUP_CONTEXT", "prooflane-backup-v1").encode())
    with zipfile.ZipFile(io.BytesIO(plaintext)) as archive:
        manifest = json.loads(archive.read("manifest.json"))
        parts = {name: archive.read(name) for name in manifest["sha256"]}
        for name, value in parts.items():
            if hashlib.sha256(value).hexdigest() != manifest["sha256"][name]:
                raise ValueError("Backup integrity check failed")
    ENV.update(APP_PORT=str(port), APP_ORIGIN=f"http://localhost:{port}", LLM_ENABLED="false")
    run(project, "up", "-d", "--wait", "database", "cache", "object-store")
    for database in (CONFIG.get("POSTGRES_DB", "prooflane"), "keycloak"):
        owner = ["--role=keycloak"] if database == "keycloak" else []
        run(project, "exec", "-T", "database", "pg_restore", "-U", "postgres", "--clean", "--if-exists",
            "--no-owner", *owner, "-d", database, content=parts[database + ".dump"])
    run(project, "run", "--rm", "--no-deps", "api", "python", "-m", "service.snapshot", "import", content=parts["objects.zip"])
    after = json.loads(run(project, "run", "--rm", "--no-deps", "api", "python", "-m", "service.snapshot", "verify"))
    before = json.loads(parts["verification.json"])
    if after != before:
        raise ValueError("Restored metadata or artifact hashes differ")
    # Leave the restored stack quiescent: apply deletion replay before opening access.
    result = {"project": project, "verified": True, "seconds": round(time.monotonic() - started, 2),
              "records": after["records"], "artifacts": after["verified_artifacts"],
              "next": "Replay deletions recorded after the backup, then start API/identity/gateway"}
    (ROOT / "runtime" / "restore-result.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["create", "restore"])
    parser.add_argument("--file", type=Path)
    parser.add_argument("--project", default=CONFIG.get("COMPOSE_PROJECT_NAME", "prooflane"))
    parser.add_argument("--port", type=int, default=8186)
    arguments = parser.parse_args()
    if arguments.action == "create":
        backup(arguments.project)
    else:
        if not arguments.file:
            parser.error("restore requires --file")
        restore(arguments.file, arguments.project, arguments.port)
