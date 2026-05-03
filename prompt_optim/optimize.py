"""GEPA driver for the Seam analyze prompt.

Usage (from repo root, with venv):

    SEAM_DATA_DIR=/path/to/.seam .venv-gepa/bin/python3 -m prompt_optim.optimize \\
        [--budget 20] [--task-model sonnet] [--reflection-model opus] \\
        [--out prompts/analyze.optimized.md]

Defaults are deliberately tiny (budget=20) for the MVP so a first run finishes
in a reasonable time and you can confirm the wiring before scaling up. After
the wiring is confirmed, expand the trainset (see ``_build_trainset``) and
bump ``--budget`` to ~150.

The optimized prompt is written to ``prompts/analyze.optimized.md`` for human
review. The production [prompts/analyze.md] is **never** auto-replaced.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

import gepa

from prompt_optim.adapter import COMPONENT_NAME, SeamAnalyzeAdapter
from prompt_optim.claude_cli_lm import ClaudeCliLM


# Trainset: 2 recordings chosen for variety. Bump after MVP wiring is confirmed.
# - team-sync-update: 27 segments, ~13min, multi-speaker meeting.
# - thyroid-medication-adjustment: 11 segments, ~1min, short conversation.
DEFAULT_TRAIN_DIRS = [
    "2026-02-23_team-sync-update",
    "2026-03-05_thyroid-medication-adjustment",
]


def _load_recording(rec_dir: Path) -> dict:
    return {
        "recording_dir": str(rec_dir),
        "recording": json.loads((rec_dir / "recording.json").read_text()),
    }


def _build_trainset(seam_dir: Path, names: list[str]) -> list[dict]:
    out: list[dict] = []
    for name in names:
        d = seam_dir / "recordings" / name
        if not (d / "recording.json").exists():
            raise FileNotFoundError(
                f"trainset recording missing: {d / 'recording.json'}"
            )
        out.append(_load_recording(d))
    return out


def main() -> int:
    repo_root = Path(__file__).resolve().parent.parent

    ap = argparse.ArgumentParser()
    ap.add_argument("--budget", type=int, default=20, help="max_metric_calls")
    ap.add_argument("--task-model", default="sonnet")
    ap.add_argument("--reflection-model", default="opus")
    ap.add_argument("--task-timeout", type=int, default=300)
    ap.add_argument("--reflection-timeout", type=int, default=600)
    ap.add_argument(
        "--seam-dir",
        default=os.environ.get("SEAM_DATA_DIR") or str(repo_root / ".seam"),
    )
    ap.add_argument("--seed-prompt", default=str(repo_root / "prompts" / "analyze.md"))
    ap.add_argument(
        "--out", default=str(repo_root / "prompts" / "analyze.optimized.md")
    )
    ap.add_argument(
        "--train",
        nargs="*",
        default=DEFAULT_TRAIN_DIRS,
        help="recording dir names under <seam_dir>/recordings/",
    )
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument(
        "--consistency",
        action="store_true",
        help=(
            "Enable the consistency metric component: re-runs the first batch "
            "example a second time per evaluate() and scores Jaccard over "
            "takeaways/speaker_map. Adds ~1 LM call per evaluate(); intended "
            "for production-strength runs (--budget >= 100)."
        ),
    )
    args = ap.parse_args()

    seam_dir = Path(args.seam_dir).expanduser().resolve()
    seed_prompt_path = Path(args.seed_prompt)
    out_path = Path(args.out)

    if not seed_prompt_path.exists():
        print(f"ERROR: seed prompt not found: {seed_prompt_path}", file=sys.stderr)
        return 1
    if not seam_dir.exists():
        print(f"ERROR: seam data dir not found: {seam_dir}", file=sys.stderr)
        return 1

    print(f"[optimize] seed prompt:   {seed_prompt_path}")
    print(f"[optimize] seam dir:      {seam_dir}")
    print(f"[optimize] task model:    {args.task_model}")
    print(f"[optimize] reflection:    {args.reflection_model}")
    print(f"[optimize] budget:        {args.budget} metric calls")
    print(f"[optimize] trainset:      {args.train}")
    print(f"[optimize] consistency:   {'on' if args.consistency else 'off'}")
    print(f"[optimize] output:        {out_path}")

    seed_prompt = seed_prompt_path.read_text()
    trainset = _build_trainset(seam_dir, args.train)

    task_lm = ClaudeCliLM(
        model=args.task_model,
        timeout=args.task_timeout,
        max_retries=8,
        verbose=True,
    )
    reflection_lm = ClaudeCliLM(
        model=args.reflection_model,
        timeout=args.reflection_timeout,
        max_retries=8,
        verbose=True,
    )

    adapter = SeamAnalyzeAdapter(
        lm=task_lm,
        people_json_path=seam_dir / "people.json",
        enable_consistency=args.consistency,
    )

    seed_candidate = {COMPONENT_NAME: seed_prompt}

    result = gepa.optimize(
        seed_candidate=seed_candidate,
        trainset=trainset,
        valset=trainset,  # MVP: train=val; introduce a real valset post-MVP
        adapter=adapter,
        reflection_lm=reflection_lm,
        max_metric_calls=args.budget,
        seed=args.seed,
        display_progress_bar=False,
        # task_lm is unused when adapter is provided (adapter holds its own LM).
    )

    best = result.best_candidate
    optimized_prompt = best[COMPONENT_NAME] if isinstance(best, dict) else best
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(optimized_prompt)
    print(f"[optimize] wrote optimized prompt to {out_path}")

    try:
        best_score = result.val_aggregate_scores[result.best_idx]
        seed_score = result.val_aggregate_scores[0]
        print(
            f"[optimize] seed score: {seed_score:.4f} -> "
            f"best score: {best_score:.4f} "
            f"({len(result.val_aggregate_scores)} candidates evaluated)"
        )
    except (IndexError, AttributeError) as e:
        print(f"[optimize] (could not summarize scores: {e})")

    # Telemetry summary from the LM state file.
    state_path = seam_dir / "prompt-optim-state.json"
    if state_path.exists():
        try:
            state = json.loads(state_path.read_text())
            print(
                f"[optimize] telemetry: "
                f"{state.get('calls', 0)} calls, "
                f"rate-limit hits: {state.get('rate_limit_hits', 0)}, "
                f"input tok: {state.get('total_input_tokens', 0):,}, "
                f"output tok: {state.get('total_output_tokens', 0):,}, "
                f"cost proxy: ${state.get('total_cost_usd_proxy', 0.0):.2f}"
            )
            by_model = state.get("by_model") or {}
            for model_name, b in sorted(by_model.items()):
                print(
                    f"[optimize]   {model_name}: {b['calls']} calls, "
                    f"in={b['input_tokens']:,} out={b['output_tokens']:,} "
                    f"cost_proxy=${b['cost_proxy']:.2f}"
                )
        except (OSError, json.JSONDecodeError):
            pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
