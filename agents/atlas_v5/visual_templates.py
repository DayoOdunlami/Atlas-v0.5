"""Deterministic GenUI templates when the model omits canvas_markup."""

from __future__ import annotations

import html
import re

from agents.atlas_v5.judgement_models import JudgementFieldsOutput, SwotQuadrants
from agents.atlas_v5.keyed_figures import KeyedFigureIndex
from agents.atlas_v5.visual_intent import VisualForm, detect_visual_form, is_case_file_swot_query, is_journey_orient_query


def _esc(text: str) -> str:
    return html.escape(text.strip())


def _bullets(items: list[str], *, material: str = "inferred") -> str:
    if not items:
        return f'<p data-material="{material}" style="font-size:12px;color:#5A5249;margin:0">Thin evidence — analyst synthesis only.</p>'
    lis = "".join(
        f'<li data-material="{material}" style="margin:0 0 6px;font-size:12.5px;line-height:1.45;color:#2E2A24">{_esc(item)}</li>'
        for item in items[:5]
    )
    return f'<ul style="margin:0;padding-left:16px">{lis}</ul>'


def _default_swot_from_judgement(j: JudgementFieldsOutput) -> SwotQuadrants:
    """Derive quadrant bullets from verdict + claims when model skipped swot field."""
    base = j.verdict.sentence
    tail = j.verdict.tail or ""
    claims = [c.text for c in (j.claims or []) if getattr(c, "text", None)][:4]
    return SwotQuadrants(
        strengths=[base] if base else ["Corpus-backed innovation portfolio"],
        weaknesses=[tail] if tail else ["Corpus coverage gaps — see blindspot"],
        opportunities=claims[:2] or ["Cross-mode bridge opportunities from corpus patterns"],
        threats=["National programme spend under-represented in corpus"]
        if j.blindspot
        else ["External policy shifts not captured in corpus-only lane"],
    )


def _swot_from_declared_claims(claims: list) -> SwotQuadrants | None:
    if not claims:
        return None
    by_kind: dict[str, list[str]] = {}
    for c in claims:
        kind = getattr(c, "kind", None) or "fact"
        text = getattr(c, "text", None)
        if text:
            by_kind.setdefault(str(kind), []).append(str(text))
    return SwotQuadrants(
        strengths=by_kind.get("fact", [])[:3] or by_kind.get("domain", [])[:3] or [claims[0].text],
        weaknesses=by_kind.get("constraint", [])[:3]
        or by_kind.get("uncertainty", [])[:2]
        or ["Constraints or gaps in the stated case"],
        opportunities=by_kind.get("hypothesis", [])[:3]
        or ["Clarify goals with corpus-backed analogues"],
        threats=by_kind.get("uncertainty", [])[:3]
        or ["Unstated assumptions may block fit"],
    )


def build_swot_markup(
    judgement: JudgementFieldsOutput,
    index: KeyedFigureIndex,
    *,
    declared_mode: bool = False,
    declared_claims: list | None = None,
) -> str:
    if declared_mode and declared_claims:
        swot = (
            judgement.swot
            or _swot_from_declared_claims(declared_claims)
            or _default_swot_from_judgement(judgement)
        )
    else:
        swot = judgement.swot or _default_swot_from_judgement(judgement)
    header = (
        "SWOT · declared case file · corpus supports only"
        if declared_mode
        else "SWOT · analyst synthesis · corpus stats owned"
    )
    stats_row = ""
    if not declared_mode and index.get("stats.project_count"):
        stats_row = f"""
        <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:18px">
          <span data-material="owned" data-key="stats.project_count" style="font-family:Georgia,serif;font-size:22px;color:#3F7A52">{{{{stats.project_count}}}}</span>
          <span style="font-size:11px;color:#56524C;font-family:ui-monospace,monospace">projects · corpus</span>
          <span data-material="owned" data-key="stats.funding_floor_gbp" style="font-family:Georgia,serif;font-size:22px;color:#3F7A52">{{{{stats.funding_floor_gbp}}}}</span>
          <span style="font-size:11px;color:#56524C;font-family:ui-monospace,monospace">known funding · floor</span>
        </div>"""

    return f"""
<section data-testid="swot-quadrant" class="swot-grid" style="max-width:720px">
  <div style="font-family:ui-monospace,monospace;font-size:10px;letter-spacing:0.12em;color:#56524C;text-transform:uppercase;margin-bottom:10px">
    {header}
  </div>
          {stats_row}
          <p style="font-family:ui-monospace,monospace;font-size:9px;color:#94908A;margin:0 0 14px">
            Charts below use the same keyed stats — click chart keys for provenance
          </p>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
    <div style="border:1px solid #3F7A52;background:#EEF4EE;padding:14px;border-radius:6px">
      <div style="font-family:ui-monospace,monospace;font-size:10px;color:#3F7A52;margin-bottom:8px">STRENGTHS</div>
      {_bullets(swot.strengths, material="owned")}
    </div>
    <div style="border:1px solid #B07A2E;background:#FBF4E8;padding:14px;border-radius:6px">
      <div style="font-family:ui-monospace,monospace;font-size:10px;color:#B07A2E;margin-bottom:8px">WEAKNESSES</div>
      {_bullets(swot.weaknesses, material="inferred")}
    </div>
    <div style="border:1px dashed #3E6B8C;background:#EDF1F6;padding:14px;border-radius:6px">
      <div style="font-family:ui-monospace,monospace;font-size:10px;color:#3E6B8C;margin-bottom:8px">OPPORTUNITIES</div>
      {_bullets(swot.opportunities, material="borrowed")}
    </div>
    <div style="border:1px solid #94908A;background:#F3F2EF;padding:14px;border-radius:6px">
      <div style="font-family:ui-monospace,monospace;font-size:10px;color:#56524C;margin-bottom:8px">THREATS</div>
      {_bullets(swot.threats, material="absent")}
    </div>
  </div>
</section>""".strip()


def build_journey_orient_markup(
    judgement: JudgementFieldsOutput,
    index: KeyedFigureIndex,
    *,
    object_label: str = "Rail decarbonisation",
) -> str:
    """North Star Journey 1 orient — stat strip + two-tier narrative."""
    web_tier = ""
    if index.get("web.programme_upper_gbp"):
        web_tier = """
    <div style="border:1px dashed #3E6B8C;background:#EDF1F6;padding:12px;border-radius:6px;margin-bottom:12px">
      <div style="font-family:ui-monospace,monospace;font-size:10px;color:#3E6B8C;margin-bottom:6px">NATIONAL PROGRAMME · WEB</div>
      <div data-material="borrowed" data-key="web.programme_upper_gbp" style="font-family:Georgia,serif;font-size:22px;color:#3E6B8C">{{{{web.programme_upper_gbp}}}}</div>
      <div style="font-size:11px;color:#56524C;margin-top:4px">TDNS-scale candidate · borrowed context</div>
    </div>"""

    return f"""
<section data-testid="journey-orient" class="journey-orient" style="max-width:720px">
  <div style="font-family:ui-monospace,monospace;font-size:10px;letter-spacing:0.12em;color:#56524C;text-transform:uppercase;margin-bottom:14px">
    Journey orient · {_esc(object_label)} · corpus owned · web dashed
  </div>
  <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:20px">
    <div style="border:1px solid #3F7A52;background:#EEF4EE;padding:12px;border-radius:6px">
      <div data-material="owned" data-key="stats.project_count" style="font-family:Georgia,serif;font-size:24px;color:#3F7A52">{{{{stats.project_count}}}}</div>
      <div style="font-family:ui-monospace,monospace;font-size:10px;color:#56524C;margin-top:4px">projects</div>
    </div>
    <div style="border:1px solid #3F7A52;background:#EEF4EE;padding:12px;border-radius:6px">
      <div data-material="owned" data-key="stats.funding_floor_gbp" style="font-family:Georgia,serif;font-size:24px;color:#3F7A52">{{{{stats.funding_floor_gbp}}}}</div>
      <div style="font-family:ui-monospace,monospace;font-size:10px;color:#56524C;margin-top:4px">known funding · floor</div>
    </div>
    <div style="border:1px solid #3F7A52;background:#EEF4EE;padding:12px;border-radius:6px">
      <div data-material="owned" data-key="stats.live_since_2024" style="font-family:Georgia,serif;font-size:24px;color:#3F7A52">{{{{stats.live_since_2024}}}}</div>
      <div style="font-family:ui-monospace,monospace;font-size:10px;color:#56524C;margin-top:4px">live since 2024</div>
    </div>
    <div style="border:1px solid #3F7A52;background:#EEF4EE;padding:12px;border-radius:6px">
      <div data-material="owned" data-key="stats.org_count" style="font-family:Georgia,serif;font-size:24px;color:#3F7A52">{{{{stats.org_count}}}}</div>
      <div style="font-family:ui-monospace,monospace;font-size:10px;color:#56524C;margin-top:4px">lead orgs</div>
    </div>
  </div>
  {web_tier}
  <div style="border-left:3px solid #3F7A52;padding-left:14px">
    <p style="font-family:Georgia,serif;font-size:17px;line-height:1.45;color:#1A1714;margin:0 0 10px">{_esc(judgement.verdict.sentence)}</p>
    <p style="font-size:13px;line-height:1.5;color:#56524C;margin:0">{_esc(judgement.verdict.tail or "")}</p>
  </div>
</section>""".strip()


def build_template_markup(
    query: str,
    judgement: JudgementFieldsOutput,
    index: KeyedFigureIndex,
    *,
    object_label: str = "Rail decarbonisation",
    outcome: str = "orient",
    session_claims: list | None = None,
) -> str | None:
    form: VisualForm = detect_visual_form(query, outcome=outcome)
    if form == "swot":
        return build_swot_markup(
            judgement,
            index,
            declared_mode=is_case_file_swot_query(query),
            declared_claims=session_claims,
        )
    if form == "journey_orient":
        return build_journey_orient_markup(
            judgement, index, object_label=object_label
        )
    return None
