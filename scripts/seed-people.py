#!/usr/bin/env python3
"""Seed .seam/people.json from existing analyses' speaker_maps.

Scans every .seam/analysis/*/analysis.json, collects unique speakers from
speaker_map, filters out generic role labels, and writes them to
.seam/people.json with source="inferred". Skips names that already exist
(case-insensitive) so it's safe to re-run.
"""
from __future__ import annotations

import json
import re
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ANALYSIS_DIR = ROOT / ".seam" / "analysis"
PEOPLE_FILE = ROOT / ".seam" / "people.json"

GENERIC_TOKENS = {
    "unknown", "speaker", "narrator", "host", "facilitator", "moderator",
    "chair", "manager", "lead", "engineer", "developer", "designer",
    "analyst", "patient", "caller", "partner", "peer", "team", "member",
    "physician", "doctor", "nurse", "guide", "tour", "father", "mother",
    "parent", "child", "interviewer", "interviewee", "participant",
    "guest", "attendee", "client", "customer", "user", "tech",
    "platform", "analytics", "ela", "ent", "yc", "new",
}

SPEAKER_NUM_RE = re.compile(r"^speaker\s*\d+$", re.IGNORECASE)


def is_generic(name: str) -> bool:
    n = name.strip()
    if not n or n.lower() == "unknown":
        return True
    # Trailing parenthetical: "Mark (Speaker 01)" -> strip and re-test base
    base = re.sub(r"\s*\([^)]*\)\s*$", "", n).strip()
    if base != n and not is_generic(base):
        return False  # has a real name before the paren
    if SPEAKER_NUM_RE.match(n):
        return True
    # All tokens are generic role words → skip
    tokens = [t.lower() for t in re.split(r"[\s\-/]+", n) if t]
    if tokens and all(t in GENERIC_TOKENS or t.isdigit() for t in tokens):
        return True
    return False


def canonical(name: str) -> str:
    """Strip trailing parentheticals so 'Mark (Speaker 01)' merges with 'Mark'."""
    return re.sub(r"\s*\([^)]*\)\s*$", "", name).strip()


def main() -> int:
    if not ANALYSIS_DIR.exists():
        print(f"No analysis directory at {ANALYSIS_DIR}", file=sys.stderr)
        return 1

    # Tally by canonical name → keep the longest variant as display name
    # (e.g. prefer "Chris Woodson" over "Chris" when both appear).
    variants: dict[str, dict[str, int]] = {}
    for analysis_path in sorted(ANALYSIS_DIR.glob("*/analysis.json")):
        try:
            data = json.loads(analysis_path.read_text())
        except (OSError, json.JSONDecodeError):
            continue
        speaker_map = data.get("speaker_map") or {}
        for raw in speaker_map.values():
            if not isinstance(raw, str):
                continue
            name = raw.strip()
            if is_generic(name):
                continue
            key = canonical(name).lower()
            if not key:
                continue
            variants.setdefault(key, {})[name] = variants.setdefault(key, {}).get(name, 0) + 1

    # Pick a display name per canonical key: most-used, breaking ties by length.
    chosen: list[str] = []
    for key, counts in variants.items():
        best = sorted(counts.items(), key=lambda kv: (-kv[1], -len(kv[0])))[0][0]
        chosen.append(best)
    chosen.sort()

    # Load existing people, skip duplicates by name (case-insensitive).
    existing: list[dict] = []
    if PEOPLE_FILE.exists():
        try:
            existing = json.loads(PEOPLE_FILE.read_text()).get("people", [])
        except (OSError, json.JSONDecodeError):
            existing = []
    existing_names = {p["name"].lower() for p in existing if "name" in p}

    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    added = 0
    for name in chosen:
        if name.lower() in existing_names:
            continue
        existing.append({
            "id": str(uuid.uuid4()),
            "name": name,
            "source": "inferred",
            "createdAt": now,
        })
        existing_names.add(name.lower())
        added += 1

    PEOPLE_FILE.parent.mkdir(parents=True, exist_ok=True)
    PEOPLE_FILE.write_text(json.dumps({"people": existing}, indent=2) + "\n")
    print(f"Seeded {added} new person(s) (total: {len(existing)}) -> {PEOPLE_FILE}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
