"""Unit tests for workbench patch extraction and last_output wiring."""

import json
import sys
from pathlib import Path

# Ensure agents package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from agents.workbench.graph import (  # noqa: E402
    _extract_json_object,
    _strip_json_from_chat,
    _with_last_output,
    _auto_wrap_as_card,
    _extract_headline,
    _is_substantive,
    _normalize_stage_metadata,
    _looks_like_empty_response,
    _strip_markdown,
    _build_corpus_table_patch,
    _build_network_map_patch,
    _build_transfer_lanes_patch,
    _looks_like_landscape_query,
    _verdict_to_transfer_outcome,
    _empty_corpus_chat,
)


def test_extract_fenced_model_patch():
    raw = '''Done.

```json
{"model_patch": {"rationale": "add swot", "ops": [], "confidence_tier": "Indicative", "corpus_citations": []}}
```
'''
    obj, start, end = _extract_json_object(raw, "model_patch")
    assert obj is not None
    assert "model_patch" in obj
    assert start >= 0
    chat = _strip_json_from_chat(raw, start, end)
    assert "model_patch" not in chat
    assert "Done" in chat


def test_extract_unfenced_model_patch():
    raw = (
        'Here is the patch:\n'
        '{"model_patch": {"rationale": "x", "ops": [{"op": "add_block", "block": {"type": "ComparisonMatrix"}}], '
        '"confidence_tier": "Indicative", "corpus_citations": []}}\n'
        'Done.'
    )
    obj, start, end = _extract_json_object(raw, "model_patch")
    assert obj is not None
    patch = obj.get("model_patch", obj)
    assert patch.get("rationale") == "x"
    chat = _strip_json_from_chat(raw, start, end)
    assert "model_patch" not in chat


def test_with_last_output_mirrors_top_level():
    result = _with_last_output(
        {
            "chat_response": "Done.",
            "model_patch": {"rationale": "x", "ops": []},
            "confidence_tier": "Indicative",
            "reasoning_trace": [],
        },
        "propose",
    )
    assert result["route"] == "propose"
    assert result["last_output"]["model_patch"]["rationale"] == "x"
    assert result["last_output"]["chat_response"] == "Done."


# ---------------------------------------------------------------------------
# Tier 1B — auto-wrap tests
# ---------------------------------------------------------------------------


def test_short_response_stays_in_chat():
    """A short greeting must NOT become a card."""
    narration, patch = _auto_wrap_as_card("Hi there!", "conversational", "hi")
    assert narration == "Hi there!"
    assert patch is None


def test_substantive_response_becomes_card():
    """A long answer must be wrapped into a ContextCard add_block patch."""
    text = (
        "## Corpus Overview\n\n"
        "The CPC corpus contains roughly 200 projects across rail, road, air, "
        "maritime, and energy sectors. Most projects are funded by Innovate UK "
        "or DfT, with delivery dates between 2020-2024."
    )
    narration, patch = _auto_wrap_as_card(text, "explore", "whats in the corpus")
    assert patch is not None
    assert patch["ops"][0]["op"] == "add_block"
    block = patch["ops"][0]["block"]
    assert block["type"] == "ContextCard"
    assert block["state"] == "core"
    assert block["visual"] == "paired_context_cards"
    # Headline extracted from H2 markdown heading
    assert block["headline"] == "Corpus Overview"
    # Full body lands in the card
    assert "200 projects" in block["content"]["body"]
    # Chat narration is short
    assert len(narration) < 200
    assert "Corpus Overview" in narration or "canvas" in narration.lower()


def test_search_response_includes_citations():
    """search route must propagate corpus_citations into the patch."""
    text = "Found 3 relevant CPC projects on rail inspection. " * 5  # long
    citations = [
        {"id": "abc-123", "title": "RAPPID", "organisation": "Monirail", "score": 0.82},
    ]
    _narration, patch = _auto_wrap_as_card(text, "search", "rail inspection", citations)
    assert patch is not None
    assert patch["corpus_citations"] == citations


def test_is_substantive_thresholds():
    """Heuristic: short single-line answers are not substantive."""
    long_text = ("This long single-line answer easily exceeds the threshold "
                 "for substantive content and should be classified as worth "
                 "wrapping into its own canvas card on the workbench.")
    assert len(long_text) > 120
    assert _is_substantive(long_text) is True
    assert _is_substantive("Short.") is False
    assert _is_substantive("") is False
    # Multi-line content always substantive
    assert _is_substantive("line one\nline two") is True


def test_extract_headline_prefers_markdown_heading():
    assert _extract_headline("# My Heading\nSome body", "query") == "My Heading"
    assert _extract_headline("## Smaller\nSome body", "query") == "Smaller"
    # Bold span fallback
    assert _extract_headline("**Bold Title** and more text", "query") == "Bold Title"
    # First sentence fallback
    assert _extract_headline("This is a sentence. Another follows.", "fallback") == "This is a sentence."
    # Query fallback
    assert _extract_headline("", "fallback query") == "fallback query"


# ---------------------------------------------------------------------------
# M3 — stage_intent + role normalisation
# ---------------------------------------------------------------------------


def test_normalize_stage_defaults_to_extend():
    """Missing stage_intent must default to extend (safest, additive)."""
    patch = {"rationale": "x", "ops": []}
    out = _normalize_stage_metadata(patch)
    assert out["stage_intent"] == "extend"
    assert out["stage_narration"] == "x"


def test_normalize_stage_rejects_invalid_intent():
    """Unknown stage_intent values fall back to extend."""
    patch = {"rationale": "x", "stage_intent": "nonsense", "ops": []}
    out = _normalize_stage_metadata(patch)
    assert out["stage_intent"] == "extend"


def test_normalize_stage_preserves_valid_intent():
    for intent in ("extend", "pivot", "recompose", "branch"):
        out = _normalize_stage_metadata({"rationale": "x", "stage_intent": intent, "ops": []})
        assert out["stage_intent"] == intent


def test_normalize_stage_defaults_block_role_to_focus():
    """New blocks without an explicit role default to focus."""
    patch = {
        "rationale": "add x",
        "ops": [
            {
                "op": "add_block",
                "block": {"id": "x", "type": "ContextCard", "headline": "Hi"},
            }
        ],
    }
    out = _normalize_stage_metadata(patch)
    assert out["ops"][0]["block"]["role"] == "focus"


def test_normalize_stage_respects_explicit_role():
    """If the agent already set a valid role, keep it."""
    patch = {
        "rationale": "x",
        "ops": [
            {
                "op": "add_block",
                "block": {"id": "x", "type": "ContextCard", "role": "context"},
            }
        ],
    }
    out = _normalize_stage_metadata(patch)
    assert out["ops"][0]["block"]["role"] == "context"


def test_normalize_stage_invalid_block_role_falls_back():
    """Invalid role on a new block falls back to focus."""
    patch = {
        "rationale": "x",
        "ops": [
            {
                "op": "add_block",
                "block": {"id": "x", "type": "ContextCard", "role": "junk"},
            }
        ],
    }
    out = _normalize_stage_metadata(patch)
    assert out["ops"][0]["block"]["role"] == "focus"


def test_normalize_stage_invalid_set_block_role_falls_back():
    """Invalid role on set_block_role op falls back to context (safer than focus)."""
    patch = {
        "rationale": "x",
        "ops": [{"op": "set_block_role", "block_id": "x", "role": "junk"}],
    }
    out = _normalize_stage_metadata(patch)
    assert out["ops"][0]["role"] == "context"


def test_normalize_stage_narration_uses_rationale_when_missing():
    patch = {"rationale": "Added a SWOT card", "ops": []}
    out = _normalize_stage_metadata(patch)
    assert out["stage_narration"] == "Added a SWOT card"


def test_normalize_stage_narration_truncates_long_rationale():
    patch = {"rationale": "x" * 200, "ops": []}
    out = _normalize_stage_metadata(patch)
    assert out["stage_narration"].endswith("...")
    assert len(out["stage_narration"]) <= 143  # 140 + "..."


def test_auto_wrap_emits_stage_intent_extend():
    """Auto-wrap MUST always emit stage_intent=extend (never branch)."""
    text = ("A reasonably long substantive answer that meets the threshold for "
            "auto-wrap into a context card on the workbench canvas surface.")
    _, patch = _auto_wrap_as_card(text, "explore", "test query")
    assert patch is not None
    assert patch["stage_intent"] == "extend"
    assert "stage_narration" in patch


def test_auto_wrap_emits_focus_role_on_block():
    text = ("A reasonably long substantive answer that meets the threshold for "
            "auto-wrap into a context card on the workbench canvas surface.")
    _, patch = _auto_wrap_as_card(text, "explore", "test query")
    assert patch is not None
    assert patch["ops"][0]["block"]["role"] == "focus"


# ---------------------------------------------------------------------------
# Round 2 polish — "no results" suppression + clean headlines + corpus table
# ---------------------------------------------------------------------------


def test_empty_response_detector_catches_user_screenshot_phrases():
    """The exact phrases from the user's reported screenshot must be detected."""
    samples = [
        # From the screenshot: "I wasn't able to find any maritime decarbonisation projects in the corpus results returned for this query"
        ("I wasn't able to find any maritime decarbonisation projects in the corpus "
         "results returned for this query — the search returned no matching projects."),
        # From the screenshot: "Based on the corpus results returned for this query, no matching projects were"
        ("Based on the corpus results returned for this query, no matching projects "
         "were found in the current corpus. I'm not able to identify specific projects."),
        # Variations
        "I couldn't find any matching projects in the corpus.",
        "The search returned no matching results for that query.",
        "No matching projects were returned. Try broadening the search.",
        "I'm not able to identify specific projects on this topic.",
    ]
    for s in samples:
        assert _looks_like_empty_response(s) is True, f"Should detect: {s[:60]!r}"


def test_empty_response_detector_does_not_false_positive():
    """Substantive answers must NOT be flagged as empty."""
    substantive = [
        ("The CPC portfolio covers rail, road, maritime, and energy projects. "
         "Notable themes include autonomous mobility, decarbonisation, and digital twins."),
        ("Five projects in the corpus match this query, with the top hit at 87% "
         "similarity. The strongest themes are predictive maintenance and AI inspection."),
        "The SWOT analysis shows three strengths and four threats worth considering.",
    ]
    for s in substantive:
        assert _looks_like_empty_response(s) is False, f"False positive on: {s[:60]!r}"


def test_auto_wrap_suppresses_empty_responses():
    """The user's exact 'no results' wall of text must NOT become a card."""
    no_results = (
        "I wasn't able to find any maritime decarbonisation projects in the corpus "
        "results returned for this query — the search returned no matching projects.\n\n"
        "This could mean:\n"
        "- No projects with that focus are currently indexed\n"
        "- The topic may be captured under different terminology"
    )
    narration, patch = _auto_wrap_as_card(no_results, "explore", "maritime")
    assert patch is None, "Empty/negative responses must NOT auto-wrap"
    assert narration == no_results, "Original response stays in chat"


def test_strip_markdown_removes_punctuation():
    assert _strip_markdown("**Bold** _italic_ `code`") == "Bold italic code"
    assert _strip_markdown("# Heading") == "Heading"
    # Brackets/parens are stripped — leaves a slight squish, acceptable for a headline
    out = _strip_markdown("- Item [link](url)")
    assert "**" not in out and "[" not in out and "(" not in out
    assert "Item" in out and "link" in out


def test_headline_never_cuts_mid_sentence():
    """The user-reported truncation 'no matching projects were' must NOT recur."""
    # First sentence is 110 chars — clean cut at 80 would slice the middle.
    long_first = (
        "Based on the corpus results returned for this query, no matching projects "
        "were found in the current corpus."
    )
    headline = _extract_headline(long_first, "what does CPC cover?")
    # Either it falls back to the query (preferred) or returns the full ≤80 chars
    assert not headline.startswith("Based on the corpus results returned for this query, no matching projects were"), \
        "Must not produce mid-sentence truncation"
    # Falls back to the query (sanitised + capped)
    assert "CPC" in headline or len(headline) <= 80


def test_headline_strips_markdown_from_first_sentence():
    text = "**Five Case** analysis is complete. Verdict positive."
    headline = _extract_headline(text, "what is the npv?")
    assert "**" not in headline
    # Leading bold extraction wins
    assert headline.startswith("Five Case")


def test_headline_uses_h1_when_present():
    text = "# Corpus Overview\n\nLots of detail here..."
    assert _extract_headline(text, "anything") == "Corpus Overview"


def test_corpus_table_patch_shape():
    """Verify the structured OpportunityList shape produced by the helper."""
    verified = [
        {"id": "a-1", "title": "Project Alpha", "organisation": "Org A", "score": 0.92},
        {"id": "b-2", "title": "Project Beta",  "organisation": "Org B", "score": 0.81},
        {"id": "c-3", "title": "Project Gamma", "organisation": "Org C", "score": 0.74},
    ]
    narration, patch = _build_corpus_table_patch(verified, "rail inspection", "explore")
    # Patch shape
    assert patch["stage_intent"] == "extend"
    assert patch["corpus_citations"] == verified
    op = patch["ops"][0]
    assert op["op"] == "add_block"
    block = op["block"]
    assert block["type"] == "OpportunityList"
    assert block["visual"] in ("evidence_bar", "match_score_bar")
    assert block["role"] == "focus"
    # Rows preserve order + shape
    assert len(block["content"]) == 3
    assert block["content"][0]["id"] == "a-1"
    assert block["content"][0]["title"] == "Project Alpha"
    assert block["content"][0]["organisation"] == "Org A"
    assert block["content"][0]["score"] == 0.92
    # Narration mentions the count + top score
    assert "3" in narration
    assert "92%" in narration


def test_landscape_query_detector():
    assert _looks_like_landscape_query("show me the landscape of rail AI") is True
    assert _looks_like_landscape_query("list rail projects") is False


def test_network_map_patch_shape():
    verified = [
        {"id": "p1", "title": "Alpha", "organisation": "Org A", "score": 0.9},
        {"id": "p2", "title": "Beta", "organisation": "Org B", "score": 0.8},
        {"id": "p3", "title": "Gamma", "organisation": "Org A", "score": 0.7},
    ]
    narration, patch = _build_network_map_patch(verified, "rail AI landscape", "explore")
    block = patch["ops"][0]["block"]
    assert block["type"] == "NetworkMap"
    assert block["visual"] == "knowledge_graph"
    assert len(block["content"]["nodes"]) >= 4  # theme + 3 projects + org
    assert len(block["content"]["edges"]) >= 3
    assert "network" in narration.lower() or "landscape" in narration.lower()


def test_verdict_to_transfer_outcome():
    assert _verdict_to_transfer_outcome("strong", "verified") == "travels-as-is"
    assert _verdict_to_transfer_outcome("partial", "inferred") == "needs-reframing"
    assert _verdict_to_transfer_outcome("judgement", "unknown") == "not-credible-here"
    assert _verdict_to_transfer_outcome("not mapped", "unknown") == "evidence-needed"


def test_transfer_lanes_patch_shape():
    items = [
        {
            "id": "e1",
            "claim_text": "Demonstrated in rail context",
            "verdict": "strong",
            "evidence_state": "verified",
            "provenance": "stored",
            "judgement": "Strong fit",
        },
        {
            "id": "e2",
            "claim_text": "Needs reframing for maritime",
            "verdict": "partial",
            "evidence_state": "inferred",
            "provenance": "derived",
        },
    ]
    summary = {"source_label": "Passport A", "target_label": "Call B", "confidence_tier": "Indicative"}
    narration, patch = _build_transfer_lanes_patch(items, summary, "does this transfer?")
    block = patch["ops"][0]["block"]
    assert block["type"] == "TransferLanes"
    assert block["visual"] == "four_lane_board"
    assert len(block["content"]) == 2
    assert block["content"][0]["transfer_outcome"] == "travels-as-is"
    assert "2" in narration


def test_corpus_table_caps_at_12_rows():
    """Long result sets must cap visually but keep all citations available."""
    verified = [
        {"id": f"p-{i}", "title": f"Project {i}", "organisation": "Org", "score": 0.5}
        for i in range(20)
    ]
    _, patch = _build_corpus_table_patch(verified, "x", "search")
    rows = patch["ops"][0]["block"]["content"]
    assert len(rows) == 12, "Table caps at 12 rows for visual sanity"
    assert len(patch["corpus_citations"]) == 20, "Full citation list still attached"


def test_empty_corpus_chat_is_helpful():
    """The polite fallback message must guide the user without dumping JSON."""
    msg = _empty_corpus_chat("maritime decarbonisation")
    assert "maritime decarbonisation" in msg
    assert "json" not in msg.lower()
    assert "{" not in msg
    # Suggests action
    assert "try" in msg.lower() or "broaden" in msg.lower() or "swap" in msg.lower()


if __name__ == "__main__":
    # Tier 1
    test_extract_fenced_model_patch()
    test_extract_unfenced_model_patch()
    test_with_last_output_mirrors_top_level()
    # Tier 1B
    test_short_response_stays_in_chat()
    test_substantive_response_becomes_card()
    test_search_response_includes_citations()
    test_is_substantive_thresholds()
    test_extract_headline_prefers_markdown_heading()
    # M3 — stage normalisation
    test_normalize_stage_defaults_to_extend()
    test_normalize_stage_rejects_invalid_intent()
    test_normalize_stage_preserves_valid_intent()
    test_normalize_stage_defaults_block_role_to_focus()
    test_normalize_stage_respects_explicit_role()
    test_normalize_stage_invalid_block_role_falls_back()
    test_normalize_stage_invalid_set_block_role_falls_back()
    test_normalize_stage_narration_uses_rationale_when_missing()
    test_normalize_stage_narration_truncates_long_rationale()
    test_auto_wrap_emits_stage_intent_extend()
    test_auto_wrap_emits_focus_role_on_block()
    # Round 2 polish
    test_empty_response_detector_catches_user_screenshot_phrases()
    test_empty_response_detector_does_not_false_positive()
    test_auto_wrap_suppresses_empty_responses()
    test_strip_markdown_removes_punctuation()
    test_headline_never_cuts_mid_sentence()
    test_headline_strips_markdown_from_first_sentence()
    test_headline_uses_h1_when_present()
    test_corpus_table_patch_shape()
    test_corpus_table_caps_at_12_rows()
    test_landscape_query_detector()
    test_network_map_patch_shape()
    test_verdict_to_transfer_outcome()
    test_transfer_lanes_patch_shape()
    test_empty_corpus_chat_is_helpful()
    print("All workbench patch tests passed.")
