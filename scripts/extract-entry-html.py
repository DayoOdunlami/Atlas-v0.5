"""Extract entry page structure to JSON for rebuild."""
import json
import re
from pathlib import Path

html = Path("experiments/ui-discovery/Atlas Entry - Canvas at Rest v3 (standalone).html").read_text(
    encoding="utf-8"
)
m = re.search(r'<script type="__bundler/template">(.*?)</script>', html, re.S)
template = json.loads(m.group(1))

out = Path("experiments/ui-discovery/_entry_extract.txt")
chunks = []

for pat in [
    "What do you want",
    "atlas-cmd",
    "atlas-starter",
    "atlas-q-input",
    "atlas-canvas",
    "atlas-entry",
    "atlasPulse",
    "starters",
    "starter",
    "100vh",
    "1200",
    "960",
    "canvas at rest",
    "CORPUS",
    "nodes",
    "edges",
    "position:absolute",
    "gridTemplate",
    "flexDirection",
]:
    idx = 0
    while True:
        i = template.find(pat, idx)
        if i < 0:
            break
        chunks.append(f"\n=== {pat} @ {i} ===\n")
        chunks.append(template[max(0, i - 150) : i + 450])
        idx = i + len(pat)

# extract full style block from helmet
style_m = re.search(r"<style>(.*?)</style>", template, re.S)
if style_m:
    chunks.append("\n=== STYLES ===\n")
    chunks.append(style_m.group(1)[:8000])

out.write_text("".join(chunks), encoding="utf-8")
print("Wrote", out, "len", out.stat().st_size)

layout_idx = template.find("width:1440px")
if layout_idx >= 0:
    layout_out = Path("experiments/ui-discovery/_entry_layout.txt")
    layout_out.write_text(template[layout_idx : layout_idx + 14000], encoding="utf-8")
    print("Wrote", layout_out)

