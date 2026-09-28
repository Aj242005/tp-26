from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    app_env: str = "local"
    app_origin: str = "http://localhost:8185"
    app_secret_key: str = ""
    data_encryption_key: str = ""
    database_url: str = "postgresql+psycopg://sih_app@database/sih26155"
    worker_database_url: str = ""
    redis_url: str = "redis://cache:6379/0"
    s3_endpoint: str = "http://object-store:9000"
    s3_bucket: str = "sih26155"
    s3_region: str = "us-east-1"
    s3_access_key_id: str = ""
    s3_secret_access_key: str = ""
    oidc_client_id: str = "sih26155-web"
    oidc_client_secret: str = ""
    oidc_issuer_url: str = "http://localhost:8185/auth/realms/sih26155"
    oidc_internal_url: str = "http://identity:8080/auth/realms/sih26155"
    gemini_api_key: str = ""
    gemini_backend: Literal["developer", "vertex_express"] = "developer"
    gemini_egress_gateway: str = ""
    gemini_model: str = ""
    llm_enabled: bool = False
    llm_global_concurrency: int = 2
    llm_tenant_concurrency: int = 1
    llm_requests_per_minute: int = 5
    llm_daily_token_budget: int = 200000
    llm_max_tool_steps: int = 8
    llm_request_timeout_seconds: int = 60
    llm_max_output_tokens: int = 4096
    job_lease_seconds: int = 75
    worker_poll_seconds: float = 1
    audit_jobs_per_minute: int = 60
    retention_days: int = 30
    default_tenant_id: str = "00000000-0000-0000-0000-000000000001"

    @property
    def secure_cookies(self):
        return self.app_origin.startswith("https://")

    @property
    def ai_ready(self):
        return self.llm_enabled and bool(self.gemini_api_key and self.gemini_model)

    @property
    def gemini_base_url(self):
        if not self.gemini_egress_gateway:
            return None
        return self.gemini_egress_gateway + (":8081" if self.gemini_backend == "vertex_express" else ":8082")


@lru_cache
def settings():
    return Settings()
