"""Dump corpus-field JS from bundled entry HTML."""
import json
import re
from pathlib import Path

html = Path("experiments/ui-discovery/Atlas Entry - Canvas at Rest v3 (standalone).html").read_text(
    encoding="utf-8"
)
m = re.search(r'<script type="__bundler/template">(.*?)</script>', html, re.S)
template = json.loads(m.group(1))

# find the x-dc script block
m2 = re.search(r'<script type="text/x-dc".*?>(.*?)</script>', template, re.S)
if m2:
    script = m2.group(1)
    # unescape html entities minimally
    script = script.replace("&quot;", '"').replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
    out = Path("experiments/ui-discovery/_entry_corpus_field.js")
    out.write_text(script, encoding="utf-8")
    print("Wrote", out, len(script))
