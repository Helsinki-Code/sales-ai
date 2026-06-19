FROM python:3.13-slim AS runtime

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HERMES_HOME=/tmp/hermes \
    HERMES_YOLO_MODE=false

RUN apt-get update && apt-get install --no-install-recommends -y git && rm -rf /var/lib/apt/lists/*

COPY apps/hermes-runner/pyproject.toml ./
RUN pip install --no-cache-dir .

COPY apps/hermes-runner/src ./src
COPY vendor/ai-sales-team/skills ./vendor/ai-sales-team/skills

RUN useradd --create-home --uid 10001 runner && chown -R runner:runner /app
USER runner
EXPOSE 8080
CMD ["uvicorn", "src.app:app", "--host", "0.0.0.0", "--port", "8080"]
