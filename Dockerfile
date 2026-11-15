FROM node:22-bookworm-slim AS frontend
WORKDIR /build/web
ENV npm_config_before=2026-11-08T00:00:00Z
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM python:3.13-slim-bookworm
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --uid 10001 --create-home vcscout
WORKDIR /app
COPY app.py ./
COPY tools/cala_http.py tools/probe_cala.py tools/linkedin_lookup.py tools/openai_graph.py ./tools/
COPY research/results-summary.json research/saved-dossiers.json ./research/
COPY --from=frontend /build/web/dist ./web/dist
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HOST=0.0.0.0 \
    PORT=10000 \
    VCSCOUT_CACHE_DIR=/tmp/vcscout-cache
USER vcscout
EXPOSE 10000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
    CMD python -c "import os,urllib.request; urllib.request.urlopen('http://127.0.0.1:'+os.environ['PORT']+'/healthz',timeout=4)"
CMD ["python", "app.py"]
