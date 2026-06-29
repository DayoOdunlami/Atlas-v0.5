"""
Atlas v5 — AnswerSpec contract (brain / GATE 0a).

Python mirror of src/lib/atlas/contracts/answer-spec.schema.ts
Keep in sync manually until codegen is wired (CLAUDE.md Commit 0.5 pattern).
"""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, HttpUrl

ConfidenceTier = Literal["Speculative", "Indicative", "Supported", "Robust"]
OutcomeMode = Literal["Orient", "Connect", "Diagnose", "Act", "Defend", "FindPath"]
TrustScope = Literal["corpus", "web", "synthesized", "declared"]
BlindspotSign = Literal["undercount", "absence"]
ReconciliationNoteType = Literal[
    "corroborate", "conflict", "discover", "external_primary"
]
LaneMode = Literal["corpus_only", "corpus_primary", "dual", "external_primary"]
AnswerSpecStatus = Literal["partial", "final", "error"]

TIER_CEILING_FRACTION: dict[str, float] = {
    "Speculative": 0.28,
    "Indicative": 0.44,
    "Supported": 0.66,
    "Robust": 0.88,
}


class CorpusCitation(BaseModel):
    id: str  # atlas.projects.id UUID
    title: str
    score: float | None = None
    organisation: str | None = None
    source_type: str | None = None


class HiveCitation(BaseModel):
    article_id: str  # hive.articles.id UUID
    title: str
    score: float | None = None
    chunk_id: str | None = None


class WebEvidence(BaseModel):
    id: str
    title: str
    url: str = ""
    publisher: str | None = None
    snippet: str | None = None
    retrieval_tool: str | None = None
    verification_state: Literal["verified", "candidate"] = "candidate"
    provenance: Literal["external"] = "external"


class Claim(BaseModel):
    id: str
    text: str
    source: TrustScope
    trust: str
    tier: ConfidenceTier
    caveat: str | None = None
    provId: str | None = None
    corpus_id: str | None = None
    web_id: str | None = None


class ProvenanceEntry(BaseModel):
    ref: str
    scope: str
    trust: TrustScope
    trustNote: str
    row: str
    url: str | None = None
    corpus_id: str | None = None


class RetrievalMeta(BaseModel):
    lane_mode: LaneMode
    corpus_count: int = 0
    external_count: int = 0
    candidate_count: int = 0
    corpus_ms: float | None = None
    external_ms: float | None = None
    errors: list[str] = Field(default_factory=list)
    external_skipped: bool = False
    govuk_count: int | None = None
    exa_count: int | None = None
    conflict_count: int = 0
    corpus_thin: bool | None = None
    external_led: bool | None = None
    dual_peer: bool | None = None
    corpus_substantive: bool | None = None
    web_substantive: bool | None = None
    corroboration_boost: bool | None = None
    tier_reason: str | None = None
    reconcile_lead: str | None = None
    lead_lane: str | None = None
    corpus_document_count: int | None = None
    project_hit_count: int | None = None
    document_hit_count: int | None = None


class ReconciliationNote(BaseModel):
    type: ReconciliationNoteType
    message: str | None = None
    corpus_signal: str | None = None
    external_signal: str | None = None
    note: str | None = None


class Reconciliation(BaseModel):
    notes: list[ReconciliationNote] = Field(default_factory=list)
    retrieval: RetrievalMeta


class InstrumentHonesty(BaseModel):
    toScale: bool
    label: str | None = None


class Instrument(BaseModel):
    recipe: str
    data: dict[str, Any]
    honesty: InstrumentHonesty | None = None


class CarriedFrom(BaseModel):
    turn: int
    of: int | None = None
    summary: str
    fromTurns: list[int] = Field(default_factory=list)
    evolvedFields: list[str] | None = None


class Verdict(BaseModel):
    sentence: str
    tail: str | None = None


class Stat(BaseModel):
    value: str
    label: str
    provId: str | None = None
    tone: Literal["corpus", "web", "neutral"] | None = None


class BlindspotStructure(BaseModel):
    pattern: str
    implication: str


class Blindspot(BaseModel):
    sign: BlindspotSign
    gap: str
    closable: str | None = None
    secondary: str | None = None
    structure: BlindspotStructure | None = None


class SoWhat(BaseModel):
    lookingAt: str
    oneDecision: str
    gate: str
    primaryAction: str
    turn: str


GateStatus = Literal["pass", "reject", "fallback_recipe", "degrade_prose"]


class CanvasBlock(BaseModel):
    markup: str = ""
    merged_markup: str | None = None
    trust_map: dict[str, str] | None = None
    scale_bindings: dict[str, dict[str, str]] | None = None
    gate_status: GateStatus | None = None
    gate_errors: list[str] = Field(default_factory=list)


ChartKind = Literal["bar", "line", "pie", "network", "heatmap", "sankey"]
ChartRole = Literal[
    "ranking",
    "composition",
    "distribution",
    "flow",
    "coverage",
    "evolution",
    "compare",
    "temporal",
    "theme_stack",
]


class ChartInteractionSpec(BaseModel):
    """Layer B hook — scenario / what-if surface (schema only in v1)."""

    type: Literal["floor_adjust", "filter_category"] = "floor_adjust"
    key: str
    label: str | None = None
    min: float | None = None
    max: float | None = None
    default: float | None = None


class ChartBlock(BaseModel):
    engine: Literal["echarts"] = "echarts"
    kind: ChartKind = "bar"
    title: str | None = None
    role: ChartRole | None = None
    story: str | None = None
    option: dict[str, Any] = Field(default_factory=dict)
    data_keys: list[str] = Field(default_factory=list)
    series_lanes: list[str] = Field(default_factory=list)
    validation_statuses: list[str] = Field(default_factory=list)
    lead_lane: str | None = None
    reconciliation_note: str | None = None
    interaction_spec: ChartInteractionSpec | None = None
    gate_status: GateStatus | None = "pass"
    gate_errors: list[str] = Field(default_factory=list)


class AnswerSpec(BaseModel):
    specVersion: Literal["0.2.1"] = "0.2.1"
    object: str
    scope: str
    mode: OutcomeMode
    tier: ConfidenceTier
    tierCapReason: str | None = None
    verdict: Verdict
    stats: list[Stat] | None = None
    blindspot: Blindspot | None = None
    instrument: Instrument | None = None
    chart: ChartBlock | None = None
    charts: list[ChartBlock] = Field(default_factory=list)
    canvas: CanvasBlock | None = None
    claims: list[Claim] = Field(default_factory=list)
    corpus_citations: list[CorpusCitation] = Field(default_factory=list)
    hive_citations: list[HiveCitation] = Field(default_factory=list)
    web_evidence: list[WebEvidence] = Field(default_factory=list)
    provenance: dict[str, ProvenanceEntry] = Field(default_factory=dict)
    reconciliation: Reconciliation | None = None
    carriedFrom: CarriedFrom | None = None
    soWhat: SoWhat
    query: str | None = None
    thread_id: str | None = None


class AnswerSpecEnvelope(BaseModel):
    revision: int
    status: AnswerSpecStatus
    spec: dict[str, Any] | None = None
    error: str | None = None
