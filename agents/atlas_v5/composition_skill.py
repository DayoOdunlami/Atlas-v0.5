"""Load visual composition skill for deep pass."""

from __future__ import annotations

from pathlib import Path

_SKILL_PATH = Path(__file__).resolve().parents[2] / "skills" / "atlas-visual-composition.md"


def load_visual_composition_skill() -> str:
    if _SKILL_PATH.is_file():
        return _SKILL_PATH.read_text(encoding="utf-8")
    return ""
