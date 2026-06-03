# Golden Example — Act (Five Case)

Use this shape for Green Book / Five Case investment briefs.

```json
{
  "headline": "Commission a £3m port inspection drone demonstrator — NPV positive at STPR 3.5% with manageable commercial risk.",
  "insight_card": "Three corpus projects and two live calls corroborate demand for automated port inspection. NPV is positive under central assumptions but the Commercial Case rests on a single operator MOU — run Diagnose on operator commitment before raising confidence above Indicative.",
  "confidence_tier": "Indicative",
  "npv_value": 4200000,
  "discount_rate": 0.035,
  "optimism_bias": 0.15,
  "decision_spine": {
    "decision": "Proceed to feasibility with conditional approval gate.",
    "recommendation": "Approve £3m demonstrator funding subject to signed operator participation and updated safety case.",
    "confidence_tier": "Indicative",
    "key_assumption": "At least one Tier-1 port operator commits to trial participation within 6 months.",
    "next_action": "Issue feasibility RFP and lock operator MOU before Full Business Case."
  },
  "sections": {
    "Strategic Case": "Port inspection drones address labour shortages and safety risks in confined structures...",
    "Economic Case": "Central NPV £4.2m at 3.5% STPR; sensitivity shows viability down to -15% demand..."
  },
  "section_scores": {
    "Strategic Case": 78,
    "Economic Case": 65,
    "Commercial Case": 52,
    "Financial Case": 60,
    "Management Case": 70
  }
}
```

Every number in insight_card or sections must cite a corpus ID or be labelled ASSUMPTION.
