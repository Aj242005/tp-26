import math
import threading
import time
from functools import lru_cache

import redis
from fastapi import HTTPException

from service.config import settings

TOKEN_BUCKET = """
local t=redis.call('TIME'); local now=tonumber(t[1])+tonumber(t[2])/1000000
local old=redis.call('HMGET',KEYS[1],'tokens','at')
local tokens=math.min(tonumber(ARGV[2]),tonumber(old[1] or ARGV[2])+(now-tonumber(old[2] or now))*tonumber(ARGV[1])/60)
if tokens<1 then return {0,math.ceil((1-tokens)*60/tonumber(ARGV[1]))} end
redis.call('HSET',KEYS[1],'tokens',tokens-1,'at',now)
redis.call('EXPIRE',KEYS[1],math.ceil(tonumber(ARGV[2])*60/tonumber(ARGV[1]))+60)
return {1,0}
"""

_fallback = {}
_lock = threading.Lock()


@lru_cache
def cache():
    return redis.Redis.from_url(settings().redis_url, socket_connect_timeout=2, socket_timeout=2,
                                 decode_responses=True)


def limit(key, rate=120, burst=30, allow_read_fallback=False):
    try:
        allowed, retry = cache().eval(TOKEN_BUCKET, 1, "limit:" + key, rate, burst)
    except redis.RedisError as exc:
        if allow_read_fallback:
            with _lock:
                at = time.monotonic()
                if len(_fallback) > 5000:
                    for old in [name for name, (_, touched) in _fallback.items() if at - touched > 120]:
                        del _fallback[old]
                tokens, previous = _fallback.get(key, (3, at))
                tokens = min(3, tokens + (at - previous) / 6)
                if tokens < 1 or len(_fallback) >= 10000:
                    raise HTTPException(429, "Degraded read limit reached; retry shortly", headers={"Retry-After": "6"}) from None
                _fallback[key] = (tokens - 1, at)
            return
        raise HTTPException(503, "Rate-limit service is unavailable. Try again shortly",
                            headers={"Retry-After": "10"}) from exc
    if not allowed:
        raise HTTPException(429, "Request limit reached. Wait before trying again",
                            headers={"Retry-After": str(max(1, math.ceil(retry)))})
