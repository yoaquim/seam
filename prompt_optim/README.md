# prompt_optim — GEPA-based optimization for `prompts/analyze.md`

Optimizes the recording-analysis prompt using [GEPA](https://github.com/gepa-ai/gepa)
without paying Anthropic API tokens. All model calls go through the `claude`
CLI, which uses your Max subscription's OAuth keychain auth.

## Why this isn't billed against the API

The `claude` CLI authenticates via the same OAuth/keychain login you use for
interactive sessions. Calls made via `claude -p` consume your Max
subscription's quota — not API credits. The wrapper at
[`claude_cli_lm.py`](claude_cli_lm.py) shells out to `claude -p
--output-format json` and unsets `ANTHROPIC_API_KEY` defensively to keep
billing on the subscription.

## Files

| File                     | Purpose                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `claude_cli_lm.py`       | Subprocess wrapper around `claude -p`. Serial semaphore (Max is one auth bucket), exponential backoff on usage-limit errors, persistent telemetry at `.seam/prompt-optim-state.json` (calls, tokens, cost-proxy, by-model).                                                                                                                                        |
| `metric.py`              | Reference-free deterministic metric. See [Metric components](#metric-components) below.                                                                                                                                                                                                                                                                            |
| `adapter.py`             | Custom `GEPAAdapter`. Wraps the candidate prompt in the same delimiters used by `scripts/pocket-run.sh`, asks Claude to emit raw JSON to stdout (vs. the production prompt which writes via the Write tool), parses the response, scores it, and assembles reflective trajectories. Optionally re-runs the first batch example a second time to score consistency. |
| `optimize.py`            | CLI driver. `python -m prompt_optim.optimize --budget 20`.                                                                                                                                                                                                                                                                                                         |
| `_seed_people_bridge.py` | Bridge that imports `is_generic`/`load_generic_labels` from `scripts/seed-people.py` so the metric and the production scripts share one definition of "generic name".                                                                                                                                                                                              |
| `_smoke_adapter.py`      | Single-example end-to-end smoke test of the adapter without the GEPA loop.                                                                                                                                                                                                                                                                                         |

## Metric components

All components are deterministic, derived from `recording.json`,
`people.json`, and `.seam/generic-speakers.txt` (if present). No
gold-standard analyses, no LLM-as-judge.

### Hard gate

| Component | Behavior                                                                                                                                                              |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schema`  | Output JSON must conform to the schema in `prompts/analyze.md`. If it fails, the metric short-circuits to 0 — none of the others matter when the structure is broken. |

### Quality components (weighted sum if the gate passes)

| Component                 | Weight | What it measures                                                                                                                                                                                                                                   |
| ------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `speaker_grounding`       | 0.15   | Every name in `speaker_map.values()` is in `people.json` and not generic (per `scripts/seed-people.py:GENERIC_LABELS` + `.seam/generic-speakers.txt`).                                                                                             |
| `participant_consistency` | 0.05   | `participants[]` ⊆ `people.json` ∪ `speaker_map.values()`, no generics. Catches invented participants.                                                                                                                                             |
| `attribution_grounding`   | 0.15   | Aggregate grounding across `speaker_map`, `decisions[].by`, `key_quotes[].speaker`, `action_items[].owner`.                                                                                                                                        |
| `quote_grounding`         | 0.15   | Each `key_quotes[].text` must appear as a substring (whitespace-fuzzed) in the transcript. The single biggest failure mode of the current prompt — average across the dataset is ~0.29.                                                            |
| `coverage_spread`         | 0.05   | Quote timestamps should hit all 3 thirds of the recording.                                                                                                                                                                                         |
| `takeaway_quality`        | 0.20   | Average of two sub-checks: pairwise Jaccard < 0.6 between takeaway content-word sets (non-redundancy) + each takeaway shares ≥ 2 content words with the transcript (grounding). Mostly a regression guard today — the current prompt is good here. |
| `mind_map_quality`        | 0.10   | Average of: edge-endpoint integrity, single connected component, root branching factor in 3..7, ≥ 2 distinct node types.                                                                                                                           |
| `output_economy`          | 0.10   | Sigmoid penalty on `len(json.dumps(analysis))`. Calibrated against the existing 178-analysis distribution: 14 kB (current median) → 0.5, 11 kB → 0.73, 16 kB → 0.31.                                                                               |
| `consistency`             | 0.05   | **Gated on `--consistency`.** Re-runs the first batch example a second time and scores Jaccard over takeaway content-words and `speaker_map` value sets. When disabled, its 0.05 is redistributed pro-rata across the others.                      |

### Why this set

- **No LLM-as-judge** in v1: doubles subscription burn; judge and task share blind spots.
- **No reference-similarity to existing analyses**: those were produced by the prompt we're optimizing, so they're not gold standard. Optimizing toward them caps the result at "looks like the current output."
- **Reuses `is_generic` from `scripts/seed-people.py`** so the metric and the production speaker-staging pipeline agree on what counts as a generic role label. Tweak `.seam/generic-speakers.txt` once and both pick it up.

## Quick start

One-time setup (creates a venv outside the project tree pollutes nothing):

```bash
python3 -m venv .venv-gepa
.venv-gepa/bin/pip install -r prompt_optim/requirements.txt
```

Tiny smoke test of the CLI wrapper:

```bash
.venv-gepa/bin/python3 -m prompt_optim.claude_cli_lm
# expect: response containing "OK"
```

Smoke test the adapter (one Sonnet call, ~1–2 min):

```bash
SEAM_DATA_DIR=/path/to/.seam .venv-gepa/bin/python3 -m prompt_optim._smoke_adapter
# expect: score ~0.9 with subscores per component
```

Run a tiny optimization (budget=20, ~30–90 min on Max sub):

```bash
SEAM_DATA_DIR=/path/to/.seam .venv-gepa/bin/python3 -m prompt_optim.optimize --budget 20
# writes prompts/analyze.optimized.md
```

## Production-quality run

Once you've confirmed the wiring works:

```bash
SEAM_DATA_DIR=/path/to/.seam .venv-gepa/bin/python3 -m prompt_optim.optimize \
    --budget 150 \
    --task-model sonnet \
    --reflection-model opus \
    --consistency \
    --train 2026-02-23_team-sync-update \
            2026-03-05_thyroid-medication-adjustment \
            2026-03-17_vision-and-execution-strategy \
            2026-02-24_cancun-and-project-management \
            ...
```

`--consistency` is **off by default** because it adds one extra LM call per
`evaluate()`. Enable it on production-strength runs (`--budget >= 100`) where
the extra cost is justified.

### Telemetry

Every successful CLI call appends to `.seam/prompt-optim-state.json`:

```json
{
  "calls": 13,
  "rate_limit_hits": 0,
  "total_cost_usd_proxy": 0.27,
  "total_input_tokens": 9,
  "total_output_tokens": 7788,
  "total_cache_read_input_tokens": 96221,
  "by_model": { "sonnet": { ... }, "opus": { ... } }
}
```

`total_cost_usd_proxy` is **not a real charge** under Max-subscription auth — there's
no API billing event. Treat it as a relative indicator of subscription burn.
`optimize.py` prints a summary at end of run.

Plan for **1–3 days wall clock** against Max caps. The wrapper persists state
at `.seam/prompt-optim-state.json` so a multi-day run can be resumed by
re-invoking the same command — GEPA itself starts fresh, but the rate-limit
backoff state and call counters are preserved.

## Reviewing & promoting an optimized prompt

`prompts/analyze.optimized.md` is **never auto-promoted**. After a run:

1. Eyeball the diff: `diff prompts/analyze.md prompts/analyze.optimized.md`.
2. **Re-test in production tool-writing mode**, not just optimization JSON
   mode. The optimized prompt was scored against direct-JSON output; the
   production path uses `--allowedTools "Write"`. Manually edit
   [`scripts/pocket-run.sh`](../scripts/pocket-run.sh) to reference
   `analyze.optimized.md` for one run, regenerate analyses for 3 recordings,
   and diff the resulting `analysis.json` files against current ones. Look
   for: more grounded `speaker_map` entries, no hallucinated names,
   `key_quotes` that match transcript text.
3. Only after that passes manual review, copy `analyze.optimized.md` over
   `analyze.md` and open a PR.

## Design notes

- **Metric is reference-free**: the 178 existing analyses in `.seam/analysis/`
  were produced by the prompt we're optimizing, so they're not a clean gold
  standard. Instead the metric scores against the source recording
  (transcript substrings, speaker names in `people.json`) and the schema.
- **Serial execution**: Max is one auth bucket. Parallel calls don't increase
  throughput, just burn the bucket faster. The wrapper enforces serial calls
  via a global lock.
- **Rate-limit retry**: when the CLI returns a usage-limit error, the wrapper
  sleeps with exponential backoff (cap 1h) and retries up to `max_retries`
  times. Counters persist to the state file.
- **Optimization-time prompt drift**: at optimization time the wrapped prompt
  emits raw JSON; at production time it uses the Write tool. Functionally
  equivalent for what the metric scores, but the optimized prompt **must** be
  re-tested in production mode before promotion (see step 2 above).
- **No LLM-as-judge**: would double Max-quota spend and create a
  feedback loop where judge and task share blind spots.
- **`is_generic` is sourced from `scripts/seed-people.py`**: the metric and
  the production speaker-staging pipeline share one definition. To extend
  the rejection list, edit `.seam/generic-speakers.txt` (one label per line)
  and both pick it up automatically.
- **Output-economy sigmoid is calibrated to the existing dataset**: median
  current output is ~14 kB, so the curve is centered at 14 kB. Optimization
  has real gradient toward smaller outputs without immediately killing the
  seed prompt's score.
