"""Probe Supabase Postgres session-mode URIs (redacted stdout)."""
from __future__ import annotations

import os
import re
from urllib.parse import urlparse, urlunparse

from pathlib import Path

import psycopg2
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env.local", override=True)

raw = (os.getenv("POSTGRES_URL") or os.getenv("DATABASE_URL") or "").strip()
if not raw:
    raise SystemExit("POSTGRES_URL not set")


def redact(uri: str) -> str:
    p = urlparse(uri)
    host = p.hostname or ""
    port = p.port or 5432
    user = p.username or ""
    q = f"?{p.query}" if p.query else ""
    return f"{p.scheme}://{user}:****@{host}:{port}{p.path or '/postgres'}{q}"


def try_connect(name: str, uri: str) -> bool:
    conn_str = re.sub(r"[?&]sslmode=[^&]*", "", uri)
    try:
        conn = psycopg2.connect(conn_str, sslmode="require", connect_timeout=12)
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*)::int FROM atlas.projects")
        n = cur.fetchone()[0]
        conn.close()
        print(f"OK  {name}: {redact(uri)}  atlas.projects={n}")
        return True
    except Exception as exc:
        print(f"FAIL {name}: {redact(uri)}  {str(exc)[:140]}")
        return False


p = urlparse(raw)
print(f"current: {redact(raw)}")

variants: list[tuple[str, str]] = []
if p.port == 6543:
    variants.append(
        (
            "pooler_session_5432",
            urlunparse(p._replace(netloc=p.netloc.replace(":6543", ":5432"))),
        )
    )
if p.username and "." in (p.username or "") and p.password:
    ref = p.username.split(".", 1)[1]
    pwd = p.password
    variants.append(
        (
            "direct_db_5432",
            f"postgresql://postgres:{pwd}@db.{ref}.supabase.co:5432/postgres?sslmode=require",
        )
    )

winner: str | None = None
for name, uri in variants:
    if try_connect(name, uri):
        winner = uri
        break

if winner:
    print(f"WINNER={redact(winner)}")
else:
    raise SystemExit(1)
