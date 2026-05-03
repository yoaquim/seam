"""Print the worst-scoring real recordings as a trainset shortlist.

Each row is annotated with type, duration, speaker setup, and dominant
failure mode. Use the table to hand-pick 4 recordings spanning multiple
failure modes / speaker setups / types — see TRAINSET.md.

Usage (from the worktree root):

    .venv-gepa/bin/python3 -m prompt_optim._pick_trainset
    .venv-gepa/bin/python3 -m prompt_optim._pick_trainset --top 50
    SEAM_DATA_DIR=/path/to/.seam .venv-gepa/bin/python3 -m prompt_optim._pick_trainset
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from prompt_optim.metric import _load_people_names, score_analysis


def _seam_dir() -> Path:
    env = os.environ.get("SEAM_DATA_DIR")
    if env:
        return Path(env).expanduser().resolve()
    # Default: worktree root's .seam (parent.parent because this file lives
    # in prompt_optim/).
    return Path(__file__).resolve().parent.parent / ".seam"


def _classify_speakers(transcript: list[dict]) -> str:
    speakers = {seg.get("speaker") for seg in transcript if isinstance(seg, dict)}
    speakers.discard(None)
    if not speakers:
        return "empty"
    if speakers <= {"Unknown"}:
        return "unknown_only"
    if all(isinstance(s, str) and s.startswith("SPEAKER_") for s in speakers):
        return "labeled_only"
    if "Unknown" in speakers and any(
        isinstance(s, str) and s.startswith("SPEAKER_") for s in speakers
    ):
        return "mixed"
    return "named"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--top", type=int, default=25, help="how many rows to print")
    ap.add_argument(
        "--min-segments",
        type=int,
        default=8,
        help="skip recordings with fewer transcript segments than this",
    )
    ap.add_argument(
        "--include-pending",
        action="store_true",
        help="include 'pending-<uuid>' duplicate-style recordings",
    )
    args = ap.parse_args()

    seam = _seam_dir()
    rec_dir = seam / "recordings"
    an_dir = seam / "analysis"
    if not rec_dir.exists():
        print(f"ERROR: no recordings dir at {rec_dir}", file=sys.stderr)
        return 1

    people = _load_people_names()

    rows: list[dict] = []
    for rd in sorted(rec_dir.iterdir()):
        if not rd.is_dir():
            continue
        rj = rd / "recording.json"
        aj = an_dir / rd.name / "analysis.json"
        if not rj.exists() or not aj.exists():
            continue
        if "pending-" in rd.name and not args.include_pending:
            continue
        try:
            rec = json.loads(rj.read_text())
            an = json.loads(aj.read_text())
        except (OSError, json.JSONDecodeError):
            continue
        transcript = rec.get("transcript") or []
        if len(transcript) < args.min_segments:
            continue

        result = score_analysis(an, rec, people)
        if result.total == 0:
            continue  # schema-failed; no gradient

        speaker_kind = _classify_speakers(transcript)
        dominant_name, dominant_score = min(
            result.subscores.items(), key=lambda kv: kv[1]
        )
        rows.append(
            {
                "name": rd.name,
                "score": result.total,
                "type": an.get("type") or "-",
                "duration_min": int((rec.get("duration") or 0) / 60),
                "speakers": speaker_kind,
                "dominant_failure": f"{dominant_name}={dominant_score:.2f}",
            }
        )

    if not rows:
        print("No qualifying recordings found.", file=sys.stderr)
        return 1

    rows.sort(key=lambda r: r["score"])

    header = (
        f"{'score':>5}  {'type':<12} {'min':>4}  "
        f"{'speakers':<13} {'dominant_failure':<32}  name"
    )
    print(header)
    print("-" * len(header))
    for r in rows[: args.top]:
        print(
            f"{r['score']:.3f}  {r['type']:<12} {r['duration_min']:>4}  "
            f"{r['speakers']:<13} {r['dominant_failure']:<32}  {r['name']}"
        )

    print()
    print(f"({len(rows)} qualifying recordings; showing worst {min(args.top, len(rows))})")
    print(
        "\nNext: hand-pick 4 names from this table covering multiple "
        "dominant_failure types, speaker setups, and recording types. "
        "See TRAINSET.md for the picking criteria. Then:"
    )
    print(
        "\n  .venv-gepa/bin/python3 -m prompt_optim.optimize \\\n"
        "    --budget 150 --task-model sonnet --reflection-model opus --consistency \\\n"
        "    --train <name1> <name2> <name3> <name4>"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
