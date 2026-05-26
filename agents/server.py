"""
Atlas 5 — FastAPI agent service.

D0 scaffold: health check endpoint only.
Agent graph routes are added per deliverable (D4: JARVIS, D5: ATLAS, D8: CICERONE+HYVE).

Run locally:
    cd agents && uvicorn server:app --port 8000 --reload

Or via uv:
    cd agents && uv run uvicorn server:app --port 8000 --reload

Tier 1 check (D0+):
    curl http://localhost:8000/health
    # → {"status": "ok"}
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path

# Load .env from repo root before any graph imports
# override=True so .env values win over blank shell variables
try:
    from dotenv import load_dotenv
    _repo_root = Path(__file__).resolve().parent.parent
    load_dotenv(_repo_root / ".env.local", override=True)
    load_dotenv(_repo_root / ".env", override=True)
except ImportError:
    pass
from typing import AsyncIterator

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


# ---------------------------------------------------------------------------
# App lifecycle
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Startup and shutdown logic."""
    print("Atlas 5 agent service starting up")
    print(f"  PYTHON_AGENTS_URL: {os.getenv('PYTHON_AGENTS_URL', 'http://localhost:8000')}")
    print("  Agents: JARVIS (D4) | ATLAS (D5) | CICERONE+HYVE (D8)")
    yield
    print("Atlas 5 agent service shutting down.")


# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Atlas 5 — Agent Service",
    description=(
        "Multi-agent LangGraph service for Connected Places Catapult Atlas 5. "
        "Four agents: ATLAS, JARVIS, CICERONE, HYVE."
    ),
    version="0.1.0-d0",
    lifespan=lifespan,
)

# CORS — allow Next.js dev server and production origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://localhost:3000",
        os.getenv("NEXT_PUBLIC_BASE_URL", ""),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.get("/health")
async def health() -> dict[str, str]:
    """
    Tier 1 health check.
    Returns {"status": "ok"} when the service is running.
    """
    return {"status": "ok"}


@app.get("/")
async def root() -> dict[str, str]:
    """Service info."""
    return {
        "service": "Atlas 5 agent service",
        "version": "0.1.0-d0",
        "stage": "D0 scaffold — health check only",
        "agents": "JARVIS (D4), ATLAS (D5), CICERONE+HYVE (D8)",
        "docs": "/docs",
    }


# ---------------------------------------------------------------------------
# D4 — JARVIS agent route
# ---------------------------------------------------------------------------

class JarvisRequest(BaseModel):
    query: str
    context_packet: dict = {}


@app.post("/agents/jarvis")
async def run_jarvis(req: JarvisRequest) -> dict:
    """
    POST /agents/jarvis
    Body: {"query": "...", "context_packet": {...}}

    Runs the JARVIS LangGraph agent. Returns:
    {
      "corpus_citations": [...],   # verified atlas.projects IDs
      "confidence_tier": "...",    # Speculative|Indicative|Supported|Robust
      "analysis": "..."
    }
    """
    try:
        from agents.jarvis.graph import run_jarvis as _run_jarvis
        result = _run_jarvis(req.query, req.context_packet)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


# ---------------------------------------------------------------------------
# D5 — ATLAS agent route
# ---------------------------------------------------------------------------

class AtlasRequest(BaseModel):
    query: str
    context_packet: dict = {}


@app.post("/agents/atlas")
def run_atlas_endpoint(req: AtlasRequest) -> dict:
    """
    POST /agents/atlas
    Body: {"query": "...", "context_packet": {...}}

    Synchronous endpoint — FastAPI runs this in a thread pool so the
    blocking LangGraph + LLM call does not block uvicorn's event loop.

    Returns the full Atlas response contract (recipe, sections, decision_spine,
    corpus_citations, confidence_tier, tool_calls, npv_value, discount_rate).
    """
    try:
        from agents.atlas.graph import run_atlas as _run_atlas
        result = _run_atlas(req.query, req.context_packet)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


# ---------------------------------------------------------------------------
# D8 — CICERONE + HYVE agent routes
# ---------------------------------------------------------------------------

class CiceroneRequest(BaseModel):
    query: str
    context_packet: dict = {}


@app.post("/agents/cicerone")
async def run_cicerone_endpoint(req: CiceroneRequest) -> dict:
    """
    POST /agents/cicerone
    Body: {"query": "...", "context_packet": {...}}

    Runs the CICERONE cross-sector transfer agent. Returns:
    {
      "transferability_score": 65,      # 0-100
      "sector_analogues": [...],
      "evidence_gaps": [{"area": "...", "status": "HAVE|PARTIAL|MISSING", "note": "..."}],
      "corpus_citations": [...],
      "confidence_tier": "...",
      "analysis": "..."
    }
    """
    try:
        from agents.cicerone.graph import run_cicerone as _run_cicerone
        result = _run_cicerone(req.query, req.context_packet)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


class HyveRequest(BaseModel):
    query: str
    context_packet: dict = {}


@app.post("/agents/hyve")
async def run_hyve_endpoint(req: HyveRequest) -> dict:
    """
    POST /agents/hyve
    Body: {"query": "...", "context_packet": {...}}

    Runs the HYVE HIVE intelligence agent. Returns:
    {
      "hive_citations": [{"article_id": "...", "title": "...", "score": 0.85}],
      "transport_mode": "rail",
      "confidence_tier": "...",
      "analysis": "..."
    }
    """
    try:
        from agents.hyve.graph import run_hyve as _run_hyve
        result = _run_hyve(req.query, req.context_packet)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
