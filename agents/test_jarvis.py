"""
Smoke test: send a real AG-UI RunAgentInput to JARVIS on port 8001
and print the streaming events + final state.
"""
import sys
import json
import httpx

URL = "http://localhost:8001/jarvis"
QUERY = "What CPC projects relate to autonomous freight corridors in the UK?"

payload = {
    "thread_id": "test-jarvis-001",
    "run_id": "run-001",
    "messages": [
        {"id": "msg-001", "role": "user", "content": QUERY}
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
                    elif t == "STATE_DELTA":
                        state_deltas.append(event.get("delta", {}))
                    elif t == "RUN_FINISHED":
                        run_finished = True
                except json.JSONDecodeError:
                    pass

        print(f"\nEvents received: {len(event_types)}")
        print(f"Event types: {', '.join(dict.fromkeys(event_types))}")
        print(f"\nText content: {''.join(text_fragments)[:300] or '(none)'}")
        print(f"\nRun finished: {run_finished}")

        if state_deltas:
            merged = {}
            for d in state_deltas:
                merged.update(d)
            print(f"\nState delta keys: {list(merged.keys())}")
            if "corpus_citations" in merged:
                cites = merged["corpus_citations"]
                print(f"  corpus_citations ({len(cites)}):")
                for c in cites[:3]:
                    print(f"    - {c.get('id', '?')[:8]}... {c.get('title', '')[:50]}")
            if "confidence_tier" in merged:
                print(f"  confidence_tier: {merged['confidence_tier']}")

print("\n✓ Smoke test complete" if run_finished else "\n⚠ RUN_FINISHED not received")
