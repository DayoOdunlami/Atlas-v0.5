# Atlas 5 — Agent Service (Railway)
#
# Build context: repo root (/)
# Railway config: rootDirectory = "/", dockerfilePath = "Dockerfile"
#
# Serves the FastAPI AG-UI streaming service for JARVIS and ATLAS agents.
# The Next.js CopilotKit runtime connects to this service via HTTP.

FROM python:3.11-slim

# System deps for psycopg2
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY agents/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy agent code
# agents/ — LangGraph graphs (JARVIS, ATLAS, CICERONE, HYVE) + FastAPI server
# mcps/   — CPC corpus MCP tools called by the agents
COPY agents/ ./agents/
COPY mcps/   ./mcps/

# server.py inserts /app onto sys.path at startup so that
# `agents.*` and `mcps.*` imports resolve correctly.

EXPOSE 8000

# Start the AG-UI streaming FastAPI service
CMD ["uvicorn", "agents.server:app", "--host", "0.0.0.0", "--port", "8000"]
