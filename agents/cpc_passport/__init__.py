"""
agents.cpc_passport — Canonical CPC Entity Passport loader.

Loads the real CPC capability profile from Supabase (not demo fixtures):
  atlas.passports (capability_profile)
  atlas.claims + atlas.profile_claims (cpc_v0_1 corpus)
  atlas.evidence_containers (project evidence, scope-filterable)
"""
from agents.cpc_passport.loader import (
    CPC_PASSPORT_ID,
    load_cpc_passport,
    load_cpc_passport_for_query,
    sync_cpc_live_call_matches,
)

__all__ = [
    "CPC_PASSPORT_ID",
    "load_cpc_passport",
    "load_cpc_passport_for_query",
    "sync_cpc_live_call_matches",
]
