import base64
import hashlib
import os
from functools import lru_cache

import boto3
from botocore.config import Config
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from service.config import settings


@lru_cache
def client():
    cfg = settings()
    return boto3.client("s3", endpoint_url=cfg.s3_endpoint, region_name=cfg.s3_region,
                        aws_access_key_id=cfg.s3_access_key_id,
                        aws_secret_access_key=cfg.s3_secret_access_key,
                        config=Config(connect_timeout=3, read_timeout=15, retries={"max_attempts": 2}))


def cipher():
    return AESGCM(base64.urlsafe_b64decode(settings().data_encryption_key))


def put(tenant: str, artifact_id: str, content: bytes):
    key = f"{tenant}/{artifact_id}"
    nonce = os.urandom(12)
    sealed = b"SIH1" + nonce + cipher().encrypt(nonce, content, key.encode())
    client().put_object(Bucket=settings().s3_bucket, Key=key, Body=sealed,
                        ContentType="application/octet-stream")
    return {"key": key, "sha256": hashlib.sha256(content).hexdigest(), "size": len(content)}


def get(tenant: str, artifact: dict):
    key = artifact["key"]
    if not key.startswith(tenant + "/") or ".." in key:
        raise ValueError("Artifact does not belong to this organization")
    response = client().get_object(Bucket=settings().s3_bucket, Key=key)
    with response["Body"] as stream:
        sealed = stream.read(20 * 1024 * 1024 + 1)
    if not sealed.startswith(b"SIH1") or len(sealed) > 20 * 1024 * 1024:
        raise ValueError("Unsupported or oversized encrypted artifact")
    content = cipher().decrypt(sealed[4:16], sealed[16:], key.encode())
    if hashlib.sha256(content).hexdigest() != artifact["sha256"]:
        raise ValueError("Artifact integrity check failed")
    return content


def delete(tenant: str, key: str):
    if not key.startswith(tenant + "/"):
        raise ValueError("Artifact does not belong to this organization")
    client().delete_object(Bucket=settings().s3_bucket, Key=key)
