#!/usr/bin/env python3
"""
Seam — build a manifest.json for the dashboard.
Reads all recordings and analyses, outputs a single JSON file
that the dashboard can fetch.
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RECORDINGS_DIR = ROOT / ".seam" / "recordings"
ANALYSIS_DIR = ROOT / ".seam" / "analysis"
OUTPUT = ROOT / "public" / "manifest.json"


def main():
    recordings = []

    if not RECORDINGS_DIR.exists():
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT.write_text(json.dumps({"recordings": []}, indent=2))
        return

    for rec_dir in sorted(RECORDINGS_DIR.iterdir()):
        if not rec_dir.is_dir() or rec_dir.name.startswith("."):
            continue

        rec_json = rec_dir / "recording.json"
        rec_md = rec_dir / "recording.md"
        analysis_json = ANALYSIS_DIR / rec_dir.name / "analysis.json"
        analysis_md = ANALYSIS_DIR / rec_dir.name / "analysis.md"

        if not rec_json.exists():
            continue

        entry = {
            "dirName": rec_dir.name,
            "data": json.loads(rec_json.read_text()),
            "analysis": json.loads(analysis_json.read_text()) if analysis_json.exists() else None,
            "markdown": rec_md.read_text() if rec_md.exists() else "",
            "analysisMarkdown": analysis_md.read_text() if analysis_md.exists() else None,
        }
        recordings.append(entry)

    # Sort newest first
    recordings.sort(key=lambda r: r["data"].get("created_at", ""), reverse=True)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps({"recordings": recordings}, indent=2))
    print(f"Built manifest with {len(recordings)} recording(s) -> {OUTPUT}")


if __name__ == "__main__":
    main()
