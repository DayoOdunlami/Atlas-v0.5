"""
Atlas 5 — FastAPI agent service (AG-UI streaming).

Registers JARVIS and ATLAS as AG-UI streaming endpoints via ag_ui_langgraph.
The Next.js CopilotKit runtime connects via HttpAgent to these paths.

Architecture:
  Browser (React / CopilotKit)
    ↕ AG-UI SSE event stream
  Next.js /api/copilotkit  (CopilotKit runtime + HttpAgent)
    ↕ POST to /jarvis or /atlas
  This service (uvicorn, port 8000)
    ↕ ag_ui_langgraph.LangGraphAgent.run()
  LangGraph compiled state graphs

Run locally:
    cd atlas5-clone-dashboard
    uvicorn agents.server:app --port 8000 --reload

Or via uv from the agents/ subfolder:
    uv run uvicorn agents.server:app --port 8000 --reload

Health checks:
    curl http://localhost:8000/health           → {"status": "ok"}
    curl http://localhost:8000/jarvis/health    → {"status": "ok", "agent": {"name": "jarvis"}}
    curl http://localhost:8000/atlas/health     → {"status": "ok", "agent": {"name": "atlas"}}
"""

from __future__ import annotations

import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

# ---------------------------------------------------------------------------
# Ensure project root (atlas5-clone-dashboard/) is on sys.path so that
# `agents.*` and `mcps.*` imports resolve correctly regardless of how
# uvicorn is invoked.
# ---------------------------------------------------------------------------
_repo_root = Path(__file__).resolve().parent.parent
if str(_repo_root) not in sys.path:
    sys.path.insert(0, str(_repo_root))

# Load env vars before any graph imports (graphs load model keys at import time)
try:
    from dotenv import load_dotenv
    load_dotenv(_repo_root / ".env.local", override=True)
    load_dotenv(_repo_root / ".env", override=True)
except ImportError:
    pass

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ag_ui_langgraph import LangGraphAgent
from ag_ui_langgraph.endpoint import add_langgraph_fastapi_endpoint


# ---------------------------------------------------------------------------
# Deferred graph imports — keeps startup fast; errors surface on first request
# ---------------------------------------------------------------------------

def _load_jarvis():
    from agents.jarvis.graph import jarvis_graph
    return jarvis_graph


def _load_atlas():
    from agents.atlas.graph import atlas_graph
    return atlas_graph


# ---------------------------------------------------------------------------
# App lifecycle
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Startup and shutdown logic."""
    print("Atlas 5 agent service starting up (AG-UI mode)")
    print(f"  Repo root: {_repo_root}")
    print(f"  ANTHROPIC_API_KEY: {'set' if os.getenv('ANTHROPIC_API_KEY') else 'MISSING!'}")
    print(f"  POSTGRES_URL:      {'set' if os.getenv('POSTGRES_URL') else 'MISSING!'}")
    print(f"  OPENAI_API_KEY:    {'set' if os.getenv('OPENAI_API_KEY') else 'not set (ILIKE fallback)'}")
    print(f"  EXA_API_KEY:       {'set' if os.getenv('EXA_API_KEY') else 'not set (Exa disabled)'}")
    print("  Agents: JARVIS /jarvis | ATLAS /atlas")
    print("  Docs:   http://localhost:8000/docs")
    yield
    print("Atlas 5 agent service shutting down.")


# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Atlas 5 — Agent Service",
    description=(
        "AG-UI streaming agent service for Connected Places Catapult Atlas 5. "
        "JARVIS (corpus explorer) and ATLAS (Green Book strategist) via LangGraph."
    ),
    version="0.5.0",
    lifespan=lifespan,
)

# CORS — local dev + Railway production Vercel deployment
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3005",
        "https://localhost:3005",
        "https://atlas-v0-5.vercel.app",
        "https://atlas-v0-5-dayoodunlamis-projects.vercel.app",
        os.getenv("NEXT_PUBLIC_BASE_URL", ""),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Global health check (service-level)
# ---------------------------------------------------------------------------

@app.get("/health")
async def health() -> dict[str, str]:
    """Service-level health check — returns {"status": "ok"}."""
    return {"status": "ok"}


@app.get("/")
async def root() -> dict[str, str]:
    """Service info."""
    return {
        "service": "Atlas 5 agent service",
        "version": "0.5.0",
        "protocol": "AG-UI (ag_ui_langgraph)",
        "agents": {
            "jarvis": "/jarvis  POST → AG-UI SSE stream",
            "atlas": "/atlas   POST → AG-UI SSE stream",
        },
        "health": {
            "service": "/health",
            "jarvis": "/jarvis/health",
            "atlas": "/atlas/health",
        },
        "docs": "/docs",
    }


# ---------------------------------------------------------------------------
# JARVIS — /jarvis (AG-UI streaming endpoint)
# ---------------------------------------------------------------------------

try:
    _jarvis_graph = _load_jarvis()
    jarvis_agent = LangGraphAgent(
        name="jarvis",
        graph=_jarvis_graph,
        description=(
            "JARVIS is the Atlas 5 corpus explorer. Given a query, it searches "
            "the CPC innovation corpus (atlas.projects), verifies all citation IDs "
            "against the database, and returns ranked evidence with a confidence tier."
        ),
    )
    add_langgraph_fastapi_endpoint(app, jarvis_agent, path="/jarvis")
    print("[server] JARVIS registered at /jarvis")
except Exception as _jarvis_err:
    print(f"[server] WARNING: JARVIS failed to load: {_jarvis_err}")
    print("[server] JARVIS endpoint will return 500 until graph is fixed.")


# ---------------------------------------------------------------------------
# ATLAS — /atlas (AG-UI streaming endpoint)
# ---------------------------------------------------------------------------

try:
    _atlas_graph = _load_atlas()
    atlas_agent = LangGraphAgent(
        name="atlas",
        graph=_atlas_graph,
        description=(
            "ATLAS is the Atlas 5 Green Book strategist. Given a proposal, it builds "
            "a Five Case Model brief (Strategic/Economic/Commercial/Financial/Management), "
            "calculates NPV at HMT STPR 3.5%, and returns verified corpus citations "
            "with a confidence tier and decision spine."
        ),
    )
    add_langgraph_fastapi_endpoint(app, atlas_agent, path="/atlas")
    print("[server] ATLAS registered at /atlas")
except Exception as _atlas_err:
    print(f"[server] WARNING: ATLAS failed to load: {_atlas_err}")
    print("[server] ATLAS endpoint will return 500 until graph is fixed.")


# ---------------------------------------------------------------------------
# Entrypoint (direct execution)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "agents.server:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=[str(_repo_root / "agents"), str(_repo_root / "mcps")],
    )
