"""Ingest tier-1 strategy PDFs — delegates to kb_maintain manifest sync."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "kb_maintain.py"), "--backfill-limit", "5"],
        cwd=str(ROOT),
        check=False,
    )


if __name__ == "__main__":
    main()
