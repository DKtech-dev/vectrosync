# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS frontend-builder
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --ignore-scripts
COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim AS runtime
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    HOME=/tmp \
    PORT=8000
WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir --requirement requirements.txt \
    && addgroup --system catenary \
    && adduser --system --ingroup catenary --home /nonexistent catenary

COPY --chown=catenary:catenary src ./src
COPY --chown=catenary:catenary backend ./backend
COPY --chown=catenary:catenary configs ./configs
COPY --chown=catenary:catenary app.py ./app.py
COPY --chown=catenary:catenary --from=frontend-builder /build/frontend/dist ./frontend/dist

USER catenary
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=3)"]
CMD ["python", "-m", "uvicorn", "backend.server:app", "--host", "0.0.0.0", "--port", "8000"]
