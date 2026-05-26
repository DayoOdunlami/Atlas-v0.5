"""Innovate UK / Innovation Funding Service adapter.

Scrapes open competitions from apply-for-innovation-funding.service.gov.uk
and normalises them to NormalizedRow.

Upgrades vs legacy ingest_ukri_competitions.py:
  - Haiku relevance classification (not just keyword filter)
  - Classification produces relevance_tag + relevance_reason
  - Embedding done inline via core.embed (not a separate pass)
  - COALESCE upsert: refreshes deadline/status, preserves existing tags
  - last_synced_at tracked
  - Yields skipped rows so counters are accurate

Env:
  DATABASE_URL
  OPENAI_API_KEY
  ANTHROPIC_API_KEY
"""

from __future__ import annotations

import re
from datetime import date, datetime
from typing import Iterator, Optional

import requests
from bs4 import BeautifulSoup

from ..core.models import NormalizedRow

BASE_URL = "https://apply-for-innovation-funding.service.gov.uk"
SEARCH_URL = f"{BASE_URL}/competition/search"
HEADERS = {"User-Agent": "Mozilla/5.0 (InnovationAtlas/4.0; contact@cpc.org.uk)"}

# L1 keyword filter — kept for cheap pre-screening before Haiku call
L1_KEYWORDS = [
    "transport", "autonomous", "connected", "decarbonisation", "decarbonization",
    "built environment", "infrastructure", "mobility", "clean maritime",
    "zero emission", "rail", "aviation", "highway", "maritime", "hydrogen",
    "electrification", "drone", "logistics", "freight",
]


def l1_pass(text: str) -> bool:
    lower = text.lower()
    return any(kw in lower for kw in L1_KEYWORDS)


def _parse_funding(text: str) -> Optional[str]:
    m = re.search(
        r"((?:up to |a share of (?:up to )?)?[£$€]\s*[\d,\.]+\s*(?:million|billion|m\b|bn\b)?)",
        text,
        re.IGNORECASE,
    )
    return m.group(1).strip()[:500] if m else None


def _parse_date(text: str) -> Optional[date]:
    text = text.strip()
    for fmt in ("%d %B %Y", "%d %b %Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def _parse_page(soup: BeautifulSoup) -> list[dict]:
    competitions = []
    for link in soup.find_all("a", href=lambda x: x and "/overview/" in str(x)):
        href = link.get("href", "")
        title = link.get_text(strip=True)
        if not title or not href:
            continue
        source_url = BASE_URL + href if href.startswith("/") else href
        li = link.find_parent("li")
        if not li:
            continue
        desc_div = li.find("div", class_="wysiwyg-styles")
        description = desc_div.get_text(strip=True) if desc_div else li.get_text(separator=" ", strip=True)
        funding = _parse_funding(description)
        closes_date: Optional[date] = None
        dl = li.find("dl")
        if dl:
            for dt, dd in zip(dl.find_all("dt"), dl.find_all("dd")):
                if "closes" in dt.get_text(strip=True).lower():
                    closes_date = _parse_date(dd.get_text(strip=True))
        competitions.append({
            "title": title[:2000],
            "description": description[:8000],
            "funding_amount": funding,
            "deadline": closes_date,
            "source_url": source_url[:4000],
        })
    return competitions


def _scrape_all_pages() -> list[dict]:
    all_comps: list[dict] = []
    seen_urls: set[str] = set()
    page = 1
    while True:
        print(f"  [iuk] Fetching page {page}...", flush=True)
        resp = requests.get(SEARCH_URL, headers=HEADERS, params={"page": str(page)}, timeout=30)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        if page == 1:
            count_text = soup.find(
                string=lambda t: t and "competition" in t.lower() and any(c.isdigit() for c in str(t))
            )
            if count_text:
                print(f"  [iuk] Page reports: {count_text.strip()}", flush=True)
        page_comps = _parse_page(soup)
        new = [c for c in page_comps if c["source_url"] not in seen_urls]
        if not new:
            break
        for c in new:
            seen_urls.add(c["source_url"])
        all_comps.extend(new)
        print(f"  [iuk] Page {page}: {len(new)} competitions (total: {len(all_comps)})", flush=True)
        if len(page_comps) < 10:
            break
        page += 1
    print(f"  [iuk] Scraped {len(all_comps)} competitions.", flush=True)
    return all_comps


def fetch(existing_urls: set[str]) -> Iterator[NormalizedRow]:
    """Yield NormalizedRow for IUK competitions passing the L1 keyword filter.

    existing_urls: source_urls already stored for source='innovate_uk'
    Yields all rows (including skipped) for accurate counter tracking.
    """
    comps = _scrape_all_pages()
    for c in comps:
        match_text = f"{c['title']} {c['description']}"
        if not l1_pass(match_text):
            continue

        row = NormalizedRow(
            title=c["title"],
            description=c["description"] or None,
            funder="Innovate UK",
            deadline=c["deadline"],
            funding_amount=c["funding_amount"],
            source_url=c["source_url"],
            source="innovate_uk",
            status="open",
            doc_type="live_call",
        )
        if row.source_url in existing_urls:
            row.raw_metadata["_skipped"] = True
        yield row


def is_skipped(row: NormalizedRow) -> bool:
    return bool(row.raw_metadata.get("_skipped"))
