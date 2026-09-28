"""Subprocess boundary for bounded configuration parsing."""
import json
import sys

from service.domain import normalize

if __name__ == "__main__":
    payload = json.load(sys.stdin)
    if len(payload["text"].splitlines()) > 100000:
        raise ValueError("Maximum configuration line count exceeded")
    json.dump(normalize(payload["text"], payload["vendor"], payload["complete"]), sys.stdout)
