"""End-to-end smoke test for SeamAnalyzeAdapter on a single recording.

Run from the repo root with the venv:

    SEAM_DATA_DIR=/path/to/.seam .venv-gepa/bin/python3 -m prompt_optim._smoke_adapter

It runs ONE evaluate() call against the seed prompt + 1 trainset example,
prints the score breakdown, and exits non-zero on hard failures.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from prompt_optim.adapter import COMPONENT_NAME, SeamAnalyzeAdapter
from prompt_optim.claude_cli_lm import ClaudeCliLM


def main() -> int:
    repo_root = Path(__file__).resolve().parent.parent
    seam_dir = Path(os.environ.get("SEAM_DATA_DIR") or repo_root / ".seam")
    prompt_path = repo_root / "prompts" / "analyze.md"
    rec_dir = seam_dir / "recordings" / "2026-02-23_team-sync-update"

    if not prompt_path.exists():
        print(f"ERROR: missing seed prompt at {prompt_path}", file=sys.stderr)
        return 1
    if not rec_dir.exists():
        print(
            f"ERROR: missing recording dir at {rec_dir} "
            f"(set SEAM_DATA_DIR to a .seam containing this recording)",
            file=sys.stderr,
        )
        return 1

    seed_prompt = prompt_path.read_text()
    recording = json.loads((rec_dir / "recording.json").read_text())

    lm = ClaudeCliLM(model="sonnet", timeout=300, max_retries=2, verbose=True)
    adapter = SeamAnalyzeAdapter(lm=lm, people_json_path=seam_dir / "people.json")

    batch = [{"recording_dir": str(rec_dir), "recording": recording}]
    candidate = {COMPONENT_NAME: seed_prompt}

    print(f"[smoke] Evaluating seed prompt on {rec_dir.name} ...")
    eb = adapter.evaluate(batch, candidate, capture_traces=True)

    print(f"[smoke] score: {eb.scores[0]:.3f}")
    if eb.trajectories:
        traj = eb.trajectories[0]
        print(f"[smoke] subscores: {traj['subscores']}")
        if traj["issues"]:
            print("[smoke] issues:")
            for i in traj["issues"]:
                print(f"  - {i}")
        # Confirm the reflective dataset assembles cleanly.
        rd = adapter.make_reflective_dataset(candidate, eb, [COMPONENT_NAME])
        items = rd[COMPONENT_NAME]
        print(f"[smoke] reflective dataset has {len(items)} item(s)")

    print("[smoke] OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
