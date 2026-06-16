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
    load_dotenv(_repo_root / ".env", override=False)
    load_dotenv(_repo_root / "agents" / ".env", override=False)
    load_dotenv(_repo_root / ".env.local", override=True)
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


def _load_cicerone():
    from agents.cicerone.graph import cicerone_graph
    return cicerone_graph


def _load_hyve():
    from agents.hyve.graph import hyve_graph
    return hyve_graph


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
    print("  Agents: JARVIS /jarvis | ATLAS /atlas | CICERONE /cicerone | HYVE /hyve")
    from agents.feature_flags import flags as _startup_flags
    print(f"  Feature flags: ATLAS5_ORCHESTRATOR_V1={_startup_flags.orchestrator_v1} | "
          f"VIZ_ART_DIRECTOR={_startup_flags.viz_art_director_v1} | "
          f"GENERATIVE_VIZ={_startup_flags.generative_viz_v1}")
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
        "JARVIS (corpus explorer), ATLAS (Green Book strategist), CICERONE (cross-sector), "
        "HYVE (climate adaptation), and the new tool-calling ORCHESTRATOR (ADR-0001) via LangGraph."
    ),
    version="0.6.0",
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
async def health() -> dict:
    """Service-level health check with corpus transport probe."""
    from mcps.cpc_corpus import transport
    from mcps.cpc_corpus import queries

    corpus_transport = "unknown"
    corpus_ok = False
    try:
        rows = queries.search_projects("health", limit=1)
        corpus_transport = transport.get_last_transport()
        corpus_ok = corpus_transport != "unavailable"
    except Exception as exc:
        corpus_transport = "error"
        corpus_detail = str(exc)[:120]
    else:
        corpus_detail = transport.human_transport_note(corpus_transport)

    return {
        "status": "ok",
        "corpus": {
            "ok": corpus_ok,
            "transport": corpus_transport,
            "note": corpus_detail,
            "postgres_url_set": bool(os.getenv("POSTGRES_URL") or os.getenv("DATABASE_URL")),
            "supabase_rest_set": transport.rest_configured(),
        },
    }


@app.get("/")
async def root() -> dict[str, str]:
    """Service info."""
    from agents.feature_flags import flags as _root_flags
    return {
        "service": "Atlas 5 agent service",
        "version": "0.6.0",
        "feature_flags": {
            "orchestrator_v1": _root_flags.orchestrator_v1,
            "viz_art_director_v1": _root_flags.viz_art_director_v1,
            "generative_viz_v1": _root_flags.generative_viz_v1,
        },
        "protocol": "AG-UI (ag_ui_langgraph)",
        "agents": {
            "jarvis":    "/jarvis    POST → AG-UI SSE stream",
            "atlas":     "/atlas     POST → AG-UI SSE stream",
            "cicerone":  "/cicerone  POST → AG-UI SSE stream",
            "hyve":      "/hyve      POST → AG-UI SSE stream",
        },
        "health": {
            "service":  "/health",
            "jarvis":   "/jarvis/health",
            "atlas":    "/atlas/health",
            "cicerone": "/cicerone/health",
            "hyve":     "/hyve/health",
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
# CICERONE — /cicerone (AG-UI streaming endpoint)
# ---------------------------------------------------------------------------

try:
    _cicerone_graph = _load_cicerone()
    cicerone_agent = LangGraphAgent(
        name="cicerone",
        graph=_cicerone_graph,
        description=(
            "CICERONE is the Atlas 5 cross-sector transfer agent. Given a source context "
            "and target opportunity, it scores transferability (0–100), identifies sector "
            "analogues, and classifies evidence gaps as HAVE / PARTIAL / MISSING with "
            "verified corpus citations and a confidence tier."
        ),
    )
    add_langgraph_fastapi_endpoint(app, cicerone_agent, path="/cicerone")
    print("[server] CICERONE registered at /cicerone")
except Exception as _cicerone_err:
    print(f"[server] WARNING: CICERONE failed to load: {_cicerone_err}")
    print("[server] CICERONE endpoint will return 500 until graph is fixed.")


# ---------------------------------------------------------------------------
# HYVE — /hyve (AG-UI streaming endpoint)
# ---------------------------------------------------------------------------

try:
    _hyve_graph = _load_hyve()
    hyve_agent = LangGraphAgent(
        name="hyve",
        graph=_hyve_graph,
        description=(
            "HYVE is the Atlas 5 climate adaptation agent. Given a query, it searches "
            "the HIVE corpus of climate adaptation and transport resilience case studies, "
            "resolves chunk-level results to parent article IDs, and returns verified "
            "hive_citations with a transport mode classification and confidence tier."
        ),
    )
    add_langgraph_fastapi_endpoint(app, hyve_agent, path="/hyve")
    print("[server] HYVE registered at /hyve")
except Exception as _hyve_err:
    print(f"[server] WARNING: HYVE failed to load: {_hyve_err}")
    print("[server] HYVE endpoint will return 500 until graph is fixed.")


# ---------------------------------------------------------------------------
# ORCHESTRATOR — /workbench  (feature-flag gated, ADR-0001)
#
# When ATLAS5_ORCHESTRATOR_V1=true the new tool-calling orchestrator graph is
# registered at /workbench, replacing the legacy hard-router.
# When the flag is OFF the legacy graph.py is registered instead so the
# existing Vercel/Railway workbench continues to work unchanged.
# ---------------------------------------------------------------------------

from agents.feature_flags import flags as _flags

if _flags.orchestrator_v1:
    try:
        from agents.orchestrator.graph import orchestrator_graph as _wb_graph  # type: ignore[import]
        _wb_name = "orchestrator"
        _wb_description = (
            "Atlas 5 tool-calling orchestrator (v1). "
            "Triages queries, gates deep research, runs a tool-calling loop, "
            "verifies claims via the trust spine, and produces a format-passed "
            "AtlasRenderModel. Flag: ATLAS5_ORCHESTRATOR_V1=true."
        )
        print("[server] ATLAS5_ORCHESTRATOR_V1=true — loading new orchestrator graph")
    except Exception as _orch_err:
        _wb_graph = None
        print(f"[server] WARNING: orchestrator graph failed to load: {_orch_err}")
        print("[server] Falling back to legacy workbench graph.")
        _flags_fallback = True
    else:
        _flags_fallback = False
else:
    _wb_graph = None
    _flags_fallback = True
    print("[server] ATLAS5_ORCHESTRATOR_V1 not set — using legacy workbench graph")

if _wb_graph is None:
    try:
        from agents.workbench.graph import graph as _wb_graph  # type: ignore[import]
        _wb_name = "workbench"
        _wb_description = (
            "Legacy Atlas 5 workbench hard-router (pre-ADR-0001). "
            "Served until ATLAS5_ORCHESTRATOR_V1=true."
        )
        print("[server] Legacy workbench graph loaded at /workbench")
    except Exception as _wb_err:
        _wb_graph = None
        print(f"[server] WARNING: legacy workbench graph also failed: {_wb_err}")

if _wb_graph is not None:
    try:
        workbench_agent = LangGraphAgent(
            name=_wb_name,
            graph=_wb_graph,
            description=_wb_description,
        )
        add_langgraph_fastapi_endpoint(app, workbench_agent, path="/workbench")
        print(f"[server] {_wb_name.upper()} registered at /workbench")
    except Exception as _wb_reg_err:
        print(f"[server] WARNING: /workbench registration failed: {_wb_reg_err}")


# ---------------------------------------------------------------------------
# EVAL — /eval/run, /eval/battery (Phase B observability)
# ---------------------------------------------------------------------------

try:
    from agents.eval.routes import router as _eval_router
    app.include_router(_eval_router)
    print("[server] Eval routes registered at /eval/*")
except Exception as _eval_err:
    print(f"[server] WARNING: eval routes failed to load: {_eval_err}")


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
