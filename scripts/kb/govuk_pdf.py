"""Resolve GovUK publication pages to primary PDF attachment URLs."""

from __future__ import annotations

import json
import re
import urllib.request
from urllib.parse import urlparse


def is_govuk_publication_url(url: str) -> bool:
    parsed = urlparse(url or "")
    return parsed.netloc.endswith("gov.uk") and "/government/publications/" in parsed.path


def resolve_govuk_pdf_url(publication_url: str) -> str | None:
    """Return direct PDF URL for a GovUK publication page, or None."""
    parsed = urlparse(publication_url.strip())
    path = parsed.path.rstrip("/")
    if not is_govuk_publication_url(publication_url):
        return None
    api_url = f"https://www.gov.uk/api/content{path}"
    headers = {"User-Agent": "InnovationAtlas/5.0 KB-Maintain (mailto:support@cpcatapult.co.uk)"}
    req = urllib.request.Request(api_url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
    except Exception:
        return None

    attachments = (data.get("details") or {}).get("attachments") or []
    pdfs = [
        att
        for att in attachments
        if att.get("content_type") == "application/pdf"
        and att.get("url", "").startswith("http")
        and "executive summary" not in (att.get("title") or "").lower()
        and "easy read" not in (att.get("title") or "").lower()
        and "large print" not in (att.get("title") or "").lower()
    ]
    if not pdfs:
        return None
    # Prefer main strategy doc (largest page count, then file size)
    pdfs.sort(
        key=lambda a: (
            int(a.get("number_of_pages") or 0),
            int(a.get("file_size") or 0),
        ),
        reverse=True,
    )
    return str(pdfs[0]["url"])


def normalize_title_key(title: str) -> str:
    t = re.sub(r"\s+", " ", (title or "").strip().lower())
    t = re.sub(r"[^\w\s-]", "", t)
    return t[:80]
