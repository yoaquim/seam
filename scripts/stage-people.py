#!/usr/bin/env python3
"""Stage inferred speakers from analyses into people-pending.json.

Scans .seam/analysis/*/analysis.json for speaker_map entries, filters out
generic labels, and stages new names for user confirmation. Does NOT
auto-add to people.json — the dashboard UI handles confirm/merge/dismiss.

Safe to re-run: skips names already in people.json, people-pending.json,
or the dismissed list.
"""
from __future__ import annotations

import json
import re
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / ".seam"
ANALYSIS_DIR = DATA_DIR / "analysis"
PEOPLE_FILE = DATA_DIR / "people.json"
PENDING_FILE = DATA_DIR / "people-pending.json"
DISMISSED_FILE = DATA_DIR / "dismissed-speakers.txt"

# Universally generic — never a real name
GENERIC_LABELS = {
    "unknown", "speaker", "narrator", "host", "facilitator", "moderator",
    "chair", "participant", "interviewer", "interviewee",
    "guest", "attendee", "caller", "member", "team",
}

SPEAKER_NUM_RE = re.compile(r"^speaker\s*\d+$", re.IGNORECASE)


def load_generic_labels() -> set[str]:
    """Load universal generics + user-defined exclusions."""
    labels = GENERIC_LABELS.copy()
    custom_file = DATA_DIR / "generic-speakers.txt"
    if custom_file.exists():
        for line in custom_file.read_text().splitlines():
            word = line.strip().lower()
            if word and not word.startswith("#"):
                labels.add(word)
    return labels


def load_dismissed() -> set[str]:
    """Load dismissed speaker names (lowercase)."""
    if DISMISSED_FILE.exists():
        return {line.strip().lower() for line in DISMISSED_FILE.read_text().splitlines() if line.strip()}
    return set()


def is_generic(name: str, labels: set[str]) -> bool:
    n = name.strip()
    if not n or n.lower() == "unknown":
        return True
    if SPEAKER_NUM_RE.match(n):
        return True
    # Strip trailing parenthetical: "Mark (Speaker 01)" → test "Mark"
    base = re.sub(r"\s*\([^)]*\)\s*$", "", n).strip()
    if base != n and not is_generic(base, labels):
        return False
    # All tokens are generic → skip
    tokens = [t.lower() for t in re.split(r"[\s\-/]+", n) if t]
    if tokens and all(t in labels or t.isdigit() for t in tokens):
        return True
    return False


def canonical(name: str) -> str:
    return re.sub(r"\s*\([^)]*\)\s*$", "", name).strip()


def main() -> int:
    if not ANALYSIS_DIR.exists():
        print("No analysis directory found.", file=sys.stderr)
        return 1

    labels = load_generic_labels()
    dismissed = load_dismissed()

    # Load existing people names (including aliases) — case-insensitive
    existing_names: set[str] = set()
    if PEOPLE_FILE.exists():
        try:
            people = json.loads(PEOPLE_FILE.read_text()).get("people", [])
            for p in people:
                existing_names.add(p["name"].lower())
                for alias in p.get("aliases", []):
                    existing_names.add(alias.lower())
        except (OSError, json.JSONDecodeError):
            pass

    # Load already-pending names
    pending_names: set[str] = set()
    pending_entries: list[dict] = []
    if PENDING_FILE.exists():
        try:
            pending_entries = json.loads(PENDING_FILE.read_text()).get("pending", [])
            for p in pending_entries:
                pending_names.add(p["name"].lower())
        except (OSError, json.JSONDecodeError):
            pass

    # Scan analyses for speaker_map entries
    # Track: canonical name → {display variants, recordings seen in}
    found: dict[str, dict] = {}
    for analysis_path in sorted(ANALYSIS_DIR.glob("*/analysis.json")):
        try:
            data = json.loads(analysis_path.read_text())
        except (OSError, json.JSONDecodeError):
            continue

        recording_dir = analysis_path.parent.name
        speaker_map = data.get("speaker_map") or {}

        for raw in speaker_map.values():
            if not isinstance(raw, str):
                continue
            name = raw.strip()
            if is_generic(name, labels):
                continue
            key = canonical(name).lower()
            if not key:
                continue
            if key in existing_names or key in pending_names or key in dismissed:
                continue

            if key not in found:
                found[key] = {"variants": {}, "recordings": set()}
            found[key]["variants"][name] = found[key]["variants"].get(name, 0) + 1
            found[key]["recordings"].add(recording_dir)

    # Build pending entries
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    added = 0
    for key, info in sorted(found.items()):
        # Pick best display name: most frequent, then longest
        best = sorted(info["variants"].items(), key=lambda kv: (-kv[1], -len(kv[0])))[0][0]
        pending_entries.append({
            "id": str(uuid.uuid4()),
            "name": best,
            "seenIn": sorted(info["recordings"]),
            "count": sum(info["variants"].values()),
            "suggestedMatch": None,  # UI can populate this
            "createdAt": now,
        })
        added += 1

    # Write pending file
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    PENDING_FILE.write_text(json.dumps({"pending": pending_entries}, indent=2) + "\n")
    print(f"Staged {added} new speaker(s) for review (total pending: {len(pending_entries)})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
