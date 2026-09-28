FROM python:3.12-slim@sha256:f77ac9e44ae96ef2c90b8053ea08c31f8be030f824196b0ae4db6d462c84e51f
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 UV_LINK_MODE=copy PYTHONPATH=/app
WORKDIR /app
COPY --from=ghcr.io/astral-sh/uv:0.11.1@sha256:fc93e9ecd7218e9ec8fba117af89348eef8fd2463c50c13347478769aaedd0ce /uv /usr/local/bin/uv
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --compile-bytecode && uv cache clean && rm /usr/local/bin/uv && useradd --uid 10001 --create-home app
COPY service ./service
COPY migrations ./migrations
COPY alembic.ini ./
COPY fixtures ./fixtures
COPY scripts ./scripts
USER 10001
ENV PATH="/app/.venv/bin:$PATH"
CMD ["uvicorn", "service.api:app", "--host", "0.0.0.0", "--port", "8000", "--no-proxy-headers", "--no-access-log"]
