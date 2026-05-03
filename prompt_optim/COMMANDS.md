# prompt_optim — sample commands

Ordered shortest-to-longest. All paths are relative — **run from the worktree root**.

## Setup notes

- Worktree's `.seam/` is a copy of the main repo's `.seam/` (gitignored).
  State changes (telemetry, generic-speakers tweaks) live in this copy only.
- `.venv-gepa/` holds the GEPA install. Created via:
  ```bash
  python3 -m venv .venv-gepa
  .venv-gepa/bin/pip install -r prompt_optim/requirements.txt
  ```
- The metric and adapter pick up `.seam/` automatically. Override with
  `SEAM_DATA_DIR=/path/to/.seam` if you want to point at a different copy.

---

## 1) Pure-Python tests (no LLM calls; instant)

### Score one analysis

```bash
.venv-gepa/bin/python3 -m prompt_optim.metric \
  .seam/recordings/2026-02-24_cancun-and-project-management \
  .seam/analysis/2026-02-24_cancun-and-project-management/analysis.json
```

### Distribution of metric scores across the whole dataset

Useful for spotting the worst-scoring analyses (where the prompt is failing
hardest) before you invest LLM calls.

```bash
.venv-gepa/bin/python3 -c '
import json
from pathlib import Path
from prompt_optim.metric import score_analysis, _load_people_names
people = _load_people_names()
scores = []
for rd in sorted(Path(".seam/recordings").iterdir()):
    aj = Path(".seam/analysis") / rd.name / "analysis.json"
    if not (rd / "recording.json").exists() or not aj.exists(): continue
    try:
        rec = json.loads((rd / "recording.json").read_text())
        an = json.loads(aj.read_text())
    except: continue
    scores.append((score_analysis(an, rec, people).total, rd.name))
scores.sort()
import statistics
just = [s for s,_ in scores]
print(f"n={len(scores)} min={min(just):.3f} p25={statistics.quantiles(just,n=4)[0]:.3f} median={statistics.median(just):.3f} p75={statistics.quantiles(just,n=4)[2]:.3f} max={max(just):.3f}")
print("\nworst 5:");  [print(f"  {s:.3f}  {n}") for s,n in scores[:5]]
print("\nbest 5:");   [print(f"  {s:.3f}  {n}") for s,n in scores[-5:]]
'
```

---

## 2) Wrapper smoke (1 LM call; ~20s, uses haiku quota)

Confirms `claude` CLI subprocess invocation, JSON envelope parsing, and
Max-subscription auth.

```bash
.venv-gepa/bin/python3 -m prompt_optim.claude_cli_lm
```

Expect: a response containing the literal word `OK`.

---

## 3) Adapter smoke (1 sonnet call; ~1-2 min)

Single-example end-to-end run of the adapter without the GEPA loop.

```bash
.venv-gepa/bin/python3 -m prompt_optim._smoke_adapter
```

Expect: a score in the 0.7–0.9 range with subscores per component.

---

## 4) Tiny GEPA loop (haiku, ~3-5 min, ~10-15 calls)

Confirms the whole pipeline including reflection + mutation + acceptance
test. Won't produce a meaningfully better prompt at this budget — it's
wiring confirmation.

```bash
.venv-gepa/bin/python3 -m prompt_optim.optimize \
  --budget 6 --task-model haiku --reflection-model haiku
```

Output: `prompts/analyze.optimized.md` (likely identical to seed at this
budget — meaning no mutation passed the acceptance test, which is expected).

---

## 5) Production-strength run (sonnet+opus, hours-to-days)

Plan for 1–3 days wall clock against Max caps. The state file at
`.seam/prompt-optim-state.json` persists telemetry across the run, and the
rate-limit retry loop in `claude_cli_lm.py` makes long sleeps recoverable —
but expect the run to spread across multiple sessions if you have a tight
weekly cap.

```bash
.venv-gepa/bin/python3 -m prompt_optim.optimize \
  --budget 150 \
  --task-model sonnet \
  --reflection-model opus \
  --consistency \
  --train 2026-02-23_team-sync-update \
          2026-03-05_thyroid-medication-adjustment \
          2026-03-17_vision-and-execution-strategy \
          2026-02-24_cancun-and-project-management
```

Watch telemetry while the run progresses (separate terminal):

```bash
watch -n 30 'cat .seam/prompt-optim-state.json'
```

After the run finishes, **do not** auto-promote
`prompts/analyze.optimized.md` over `prompts/analyze.md`. Re-test in
production tool-writing mode first — see the "Reviewing & promoting" section
in [README.md](README.md).

---

## Helpers

### Inspect telemetry

```bash
cat .seam/prompt-optim-state.json | python3 -m json.tool
```

### Reset telemetry

Zeroes the counters but leaves recordings/analyses untouched.

```bash
rm .seam/prompt-optim-state.json
```

### Diff seed vs. optimized prompt

```bash
diff prompts/analyze.md prompts/analyze.optimized.md
```

```bash
code --diff prompts/analyze.md prompts/analyze.optimized.md
```

### Run against a different `.seam/`

```bash
SEAM_DATA_DIR=/Users/cwoodson/src/personal/seam/.seam \
  .venv-gepa/bin/python3 -m prompt_optim.optimize --budget 6 ...
```

### Force a specific recording set as trainset

The `--train` flag accepts directory names from `.seam/recordings/`:

```bash
.venv-gepa/bin/python3 -m prompt_optim.optimize \
  --budget 20 \
  --train 2026-02-23_team-sync-update 2026-03-17_vision-and-execution-strategy
```

---

## Reading the output

`optimize.py` prints at the end:

```
[optimize] seed score: 0.7302 -> best score: 0.8154 (12 candidates evaluated)
[optimize] telemetry: 87 calls, rate-limit hits: 2, input tok: 124, output tok: 91,234, cost proxy: $4.73
[optimize]   sonnet: 64 calls, in=82 out=78,109 cost_proxy=$2.91
[optimize]   opus:   23 calls, in=42 out=13,125 cost_proxy=$1.82
```

- **Seed → best score** tells you whether GEPA actually improved the prompt.
- **`rate_limit_hits`** is how many times the wrapper saw a usage-cap error
  and slept; > 0 just means you hit the cap during the run, not that
  anything failed.
- **`cost_proxy`** is **not a real charge** under Max-subscription auth —
  the CLI surfaces the API-equivalent cost number, but no billing event
  occurred. Treat it as a relative indicator of subscription burn.
