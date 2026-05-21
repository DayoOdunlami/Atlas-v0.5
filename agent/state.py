from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Union, Literal
from enum import Enum
from datetime import datetime

# class IconType(str, Enum):
#     users = "users"
#     mrr = "mrr"
#     conversion = "conversion"
#     churn = "churn"
#     custom = "custom"


# A single metric description in the dashboard spec, matching src/lib/types.ts
class Metric(BaseModel):
    """A single metric in the dashboard state, should always have a unique id."""

    id: str
    title: str
    value: str
    hint: Optional[str] = None
    # icon: Optional[IconType] = None


# Flexible record for chart data rows: keys are column names, values are string or number
ChartDataRecord = Dict[str, Union[str, float, int]]
ChartDataMap = Dict[str, List[ChartDataRecord]]


class Chart(BaseModel):
    """A single chart description in the dashboard spec."""

    type: Literal["line", "bar", "pie"] = Field(
        description='Chart type: "line" | "bar" | "pie"'
    )
    title: str
    x: Optional[str] = None
    y: Optional[str] = None
    data: List[ChartDataRecord] = Field(default_factory=list)


class Dashboard(BaseModel):
    """A dashboard spec matching the UI shape."""

    title: str
    pinnedMetrics: List[Metric] = Field(default_factory=list)
    charts: List[Chart] = Field(default_factory=list)


# ── Atlas v5 contracts (mirror of src/lib/types.ts) ─────────────────────────

ConfidenceTier = Literal["Speculative", "Indicative", "Supported", "Robust"]


class CorpusCitation(BaseModel):
    id: str
    title: str
    organisation: str
    score: float


class HiveCitation(BaseModel):
    article_id: str
    chunk_id: Optional[str] = None
    title: str
    score: float


class SurfaceState(BaseModel):
    mode: Literal["chat", "artifact", "canvas"] = "artifact"
    activeAgent: Literal["ATLAS", "JARVIS", "CICERONE", "HYVE"] = "ATLAS"
    lens: Literal["CPC", "Atlas", "Ecosystem", "Funder", "Mode"] = "CPC"
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat())


class ArtifactBlock(BaseModel):
    type: Literal["brief", "evidence", "chart"] = "brief"
    sections: Optional[Dict[str, str]] = None
    corpus_citations: Optional[List[CorpusCitation]] = None
    hive_citations: Optional[List[HiveCitation]] = None
    npv_value: Optional[float] = None
    discount_rate: Optional[float] = None
    confidence_tier: ConfidenceTier = "Speculative"
    chart_spec: Optional[Dict] = None


class DecisionSpine(BaseModel):
    decision: str
    recommendation: str
    confidence_tier: ConfidenceTier
    key_assumption: str
    next_action: str
    framework: Optional[str] = None
    strongest_objection: Optional[str] = None
    would_change_if: Optional[str] = None
