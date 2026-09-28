"""Container-side encrypted-object snapshot helper; binary data travels only on stdout."""
import io
import json
import sys
import zipfile

from sqlalchemy import select

from service import storage
from service.config import settings
from service.db import Entity, transaction


def main():
    action = sys.argv[1]
    client, bucket = storage.client(), settings().s3_bucket
    if action == "export":
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_STORED) as archive:
            for page in client.get_paginator("list_objects_v2").paginate(Bucket=bucket):
                for item in page.get("Contents", []):
                    with client.get_object(Bucket=bucket, Key=item["Key"])["Body"] as stream:
                        archive.writestr(item["Key"], stream.read())
        sys.stdout.buffer.write(buffer.getvalue())
    elif action == "import":
        if not any(row["Name"] == bucket for row in client.list_buckets()["Buckets"]):
            client.create_bucket(Bucket=bucket)
        with zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())) as archive:
            for name in archive.namelist():
                if ".." in name or name.startswith("/") or "\\" in name:
                    raise ValueError("Invalid object key")
                client.put_object(Bucket=bucket, Key=name, Body=archive.read(name), ContentType="application/octet-stream")
    elif action == "verify":
        hashes = []
        records = 0
        for tenant in (settings().default_tenant_id, "00000000-0000-0000-0000-000000000002"):
            with transaction(tenant) as db:
                for row in db.scalars(select(Entity).where(Entity.tenant_id == tenant)):
                    records += 1
                    for field in ("artifact", "report"):
                        if row.data.get(field):
                            storage.get(tenant, row.data[field])
                            hashes.append(row.data[field]["sha256"])
        print(json.dumps({"records": records, "verified_artifacts": len(hashes), "hashes": sorted(hashes)}))
    else:
        raise ValueError("Unknown snapshot action")


if __name__ == "__main__":
    main()
