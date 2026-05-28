"""
Enhanced smoke test: send a real AG-UI RunAgentInput to JARVIS and print
the full structured state (citations, confidence_tier, analysis prose).
"""
import sys
import json
import httpx

URL = "http://localhost:8001/jarvis"
QUERY = "What CPC projects relate to autonomous freight corridors in the UK?"

payload = {
    "thread_id": "test-jarvis-v2-001",
    "run_id": "run-v2-001",
    "messages": [
        {"id": "msg-v2-001", "role": "user", "content": QUERY}
    ],
    "state": {},
    "tools": [],
    "context": [],
    "forwardedProps": {},
}

print(f"Testing JARVIS at {URL}")
print(f"Query: {QUERY}\n")

with httpx.Client(timeout=120.0) as client:
    with client.stream("POST", URL, json=payload, headers={"Accept": "text/event-stream"}) as resp:
        print(f"Status: {resp.status_code}")
        if resp.status_code != 200:
            print(f"Error: {resp.read().decode()[:500]}")
            sys.exit(1)

        event_types = []
        text_fragments = []
        state_snapshot = {}
        state_deltas = []
        run_finished = False

        for line in resp.iter_lines():
            if not line or line.startswith(":"):
                continue
            if line.startswith("data: "):
                data_str = line[6:]
                try:
                    event = json.loads(data_str)
                    t = event.get("type", "?")
                    event_types.append(t)
                    if t == "TEXT_MESSAGE_CONTENT":
                        text_fragments.append(event.get("delta", ""))
                    elif t == "STATE_SNAPSHOT":
                        snapshot = event.get("snapshot", {})
                        if snapshot:
                            state_snapshot = snapshot
                    elif t == "STATE_DELTA":
                        state_deltas.append(event.get("delta", {}))
                    elif t == "RUN_FINISHED":
                        run_finished = True
                except json.JSONDecodeError:
                    pass

        print(f"Events received: {len(event_types)}")
        print(f"Event types: {', '.join(dict.fromkeys(event_types))}")

        # Full analysis text
        full_text = "".join(text_fragments)
        print(f"\n--- Analysis Text ({len(full_text)} chars) ---")
        print(full_text[:600] or "(none)")

        print(f"\nRun finished: {run_finished}")

        # Merge state deltas
        merged = dict(state_snapshot)
        for d in state_deltas:
            merged.update(d)

        # Print structured results
        print(f"\n--- Structured Results ---")
        if "confidence_tier" in merged:
            print(f"Confidence tier: {merged['confidence_tier']}")

        citations = merged.get("corpus_citations", [])
        print(f"\nCorpus citations ({len(citations)}):")
        for c in citations[:10]:
            cid = c.get("id", "?")
            title = c.get("title", "?")
            org = c.get("organisation", "?")
            note = c.get("relevance_note", "")[:80]
            print(f"  [{cid[:8]}...] {title[:50]}")
            print(f"    Org: {org}")
            print(f"    Note: {note}")

        if "error" in merged and merged["error"]:
            print(f"\nError: {merged['error']}")

        print(f"\nState keys: {list(merged.keys())}")

print("\nSMOKE TEST COMPLETE" if run_finished else "\nWARNING: RUN_FINISHED not received")
