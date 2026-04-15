FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_SYSTEM_PYTHON=1

WORKDIR /app

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

COPY pyproject.toml uv.lock* ./
RUN uv sync --frozen --no-dev 2>/dev/null || uv pip install --system \
    fastapi uvicorn[standard] sqlalchemy aiosqlite httpx[http2] \
    anthropic pydantic pydantic-settings "python-jose[cryptography]" "passlib[bcrypt]"

COPY . .

EXPOSE 8080

CMD ["python", "main.py", "--port", "8080"]
