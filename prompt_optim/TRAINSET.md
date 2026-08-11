# Picking trainset inputs for GEPA optimization

Pick recordings that **expose the prompt's weaknesses**, not its strengths.
GEPA optimizes whatever the metric flags — if your trainset is recordings
the seed already handles well, GEPA has no signal to chase. Conversely,
picking only the worst recordings can produce a prompt over-fit to
pathological cases.

The right framing: you're assembling a **failure-mode portfolio**, where
each recording is chosen to stress one of the metric's components.

## Criteria, ordered by importance

### 1. Score below the median on the current prompt

If `score_analysis` returns 0.85 on a recording, GEPA can't push it much
higher — there's no gradient. The dataset-distribution command in
[COMMANDS.md](COMMANDS.md) shows the median; pick from below it.

### 2. Cover the dominant failure modes

Look at which subscores are dragging totals down. From the dataset today:

| Component                 | Mean across dataset | Notes                                                             |
| ------------------------- | ------------------- | ----------------------------------------------------------------- |
| `quote_grounding`         | ~0.29               | Verbatim-quote substring failure. Dominant.                       |
| `attribution_grounding`   | ~0.68               | Owners/by/speaker fields with role descriptions instead of names. |
| `output_economy`          | varies              | Bloat above ~14 kB.                                               |
| `participant_consistency` | varies              | Invented or generic participants.                                 |

A trainset where every recording fails on quote_grounding will only
optimize quotes. A mix of failure types forces GEPA to find improvements
that **generalize**.

### 3. Diverse speaker setups

Where the prompt's hardest work happens:

- One **all-Unknown** transcript (model must infer everyone from content).
- One with **labeled speakers** but no names (`SPEAKER_00`, `SPEAKER_01`).
- One with **mixed** Unknown + named.
- One with **correct labels already** — regression guard so the prompt
  doesn't break the easy case.

### 4. Diverse recording types

The schema's `type` field is `meeting | brainstorm | interview | lecture |
conversation | other`. Behavior on a 60-min meeting differs from a 2-min
voice memo. Sample at least 2–3 distinct types.

### 5. Length spread

Include one short (<5 min), one medium (15–30 min), one long (60+ min).
Long recordings stress `output_economy`; short recordings stress whether
the model handles thin content gracefully.

### 6. Avoid duplicates and near-duplicates

The dataset has many `pending-<uuid>` entries that mirror named
recordings. Skip those — they don't add information, just multiply cost.

## What to avoid

- **All recordings from the same context.** If your whole trainset is
  internal team standups, you'll optimize a "standup" prompt, not a
  general analysis prompt.
- **Recordings where the metric scores 0.0** (schema gate failure). These
  tell GEPA "produce _anything_ valid"; once schema is satisfied, the
  gradient evaporates. You want recordings the seed handles structurally
  but suboptimally.
- **Recordings where you're not sure of ground truth.** If you don't know
  who's actually speaking, you can't sanity-check the optimized prompt by
  eye after the run.
- **Too many recordings.** Each one multiplies cost per metric call. With
  `--budget 150` and 8 recordings, GEPA only evaluates ~18 candidates.
  4 recordings × 37 candidates beats 8 × 18 — prompt-space exploration
  matters more than dataset breadth at this scale.

## Picker script

Run [`_pick_trainset.py`](_pick_trainset.py) — it prints the worst-scoring
real recordings (non-pending, non-trivial), annotated with type, duration,
speaker setup, and dominant failure mode, plus a directly-pasteable
`--train` line at the bottom.

```bash
.venv-gepa/bin/python3 -m prompt_optim._pick_trainset
```

Useful flags:

```bash
.venv-gepa/bin/python3 -m prompt_optim._pick_trainset --top 50
.venv-gepa/bin/python3 -m prompt_optim._pick_trainset --include-pending
.venv-gepa/bin/python3 -m prompt_optim._pick_trainset --min-segments 20
SEAM_DATA_DIR=/path/to/.seam .venv-gepa/bin/python3 -m prompt_optim._pick_trainset
```

Sample output (top 8 from the current dataset):

```
score  type          min  speakers      dominant_failure                  name
0.445  meeting        31  labeled_only  speaker_grounding=0.00            2026-03-17_ai-agents-for-workplace-efficiency
0.474  meeting       122  labeled_only  speaker_grounding=0.00            2026-04-14_agentic-workflow-planning-and-pr-automation
0.541  meeting        47  labeled_only  output_economy=0.06               2026-03-09_project-updates-and-travel-plans
0.577  meeting        30  labeled_only  quote_grounding=0.20              2026-02-20_project-updates-and-tooling-integration
0.579  meeting        80  named         quote_grounding=0.00              2026-03-26_ai-driven-insurance-analytics-onboarding
0.581  meeting        23  labeled_only  participant_consistency=0.17      2026-03-17_trade-show-retrospective
0.583  meeting        95  labeled_only  attribution_grounding=0.22        2026-03-17_company-vision-and-strategy-session
0.591  conversation   21  labeled_only  attribution_grounding=0.11        2026-03-06_calebs-pediatrician-appointment
```

## How to read the output and pick 4 recordings

Scan the table top-down (worst scores first) and assemble a portfolio that
checks these boxes:

1. **At least 3 different `dominant_failure` values across your 4 picks.**
   Don't take 4 recordings all failing on `quote_grounding`.
2. **At least 3 different `speakers` categories.** Include the `unknown_only`
   case (hardest) and ideally one `mixed` for the regression guard.
3. **At least 2 different `type` values.** Don't take 4 meetings.
4. **A length spread.** At least one < 10 min, at least one > 30 min.
5. **All scores between ~0.5 and ~0.78** — meaningfully below median, but
   not schema-broken.

Then paste the four directory names into `optimize.py`:

```bash
.venv-gepa/bin/python3 -m prompt_optim.optimize \
  --budget 150 \
  --task-model sonnet \
  --reflection-model opus \
  --consistency \
  --train <name1> <name2> <name3> <name4>
```

## When to revisit

- **After your first production-strength run finishes:** re-run the picker.
  The optimized prompt's dataset-wide score distribution will look
  different. Recordings that _now_ score worst are the new failure modes
  to target in a second optimization pass.
- **When you change the metric:** if you adjust weights or add a component,
  your dominant-failure column changes — re-pick.
- **When you add new recordings:** if 50 new recordings come in via Pocket,
  some will likely surface failure modes the current trainset doesn't
  cover.

## Notes for later

- `optimize.py` currently passes `valset=trainset` (same set for train and
  val). For a real production-strength run we'll want to hold out 2–3
  recordings as a true valset. Tracked separately.
