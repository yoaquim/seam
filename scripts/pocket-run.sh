#!/usr/bin/env bash
#
# Seam — orchestration script (cron entrypoint)
#
# 1. Pulls new recordings from Pocket API
# 2. Analyzes ALL recordings missing analysis — not just new ones
#

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"

# Source .env if it exists
if [ -f "$ROOT/.env" ]; then
    set -a
    source "$ROOT/.env"
    set +a
fi

PULL_SCRIPT="$SCRIPT_DIR/pocket_pull.py"
ANALYSIS_DIR="$ROOT/.seam/analysis"
RECORDINGS_DIR="$ROOT/.seam/recordings"
PROMPT_FILE="$ROOT/prompts/analyze.md"
LOG_FILE="$ROOT/.seam/seam.log"

log() {
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" | tee -a "$LOG_FILE"
}

mkdir -p "$ANALYSIS_DIR"

log "=== Seam sync starting ==="

# ── Phase 1: Pull ──────────────────────────────────────────────
PULL_EXIT=0

log "Running pocket_pull.py..."

# Run with line-buffered output so dashboard sees lines in real time
python3 -u "$PULL_SCRIPT" 2>&1 | tee -a "$LOG_FILE" || PULL_EXIT=${PIPESTATUS[0]}

if [ $PULL_EXIT -ne 0 ]; then
    log "Pull script failed (exit $PULL_EXIT). Invoking Claude to debug..."

    claude -p "The Pocket API pull script at $PULL_SCRIPT failed with exit code $PULL_EXIT.

The script pulls recordings from the Pocket AI API (https://public.heypocketai.com/api/v1).
API key is in the POCKET_API_KEY env var.
It should list recordings, fetch details with transcripts and summarizations, and write to $RECORDINGS_DIR.

Read the script, check the log at $LOG_FILE for error details, debug the issue and complete the sync." \
        --allowedTools "Bash,Read,Write,Glob,Grep" \
        2>&1 | tee -a "$LOG_FILE"
fi

log "Pull phase complete."

# ── Phase 2: Analyze ALL unanalyzed recordings ────────────────
# Scan every recording dir — if it has recording.json but no analysis.json, analyze it.

if [ ! -f "$PROMPT_FILE" ]; then
    log "WARNING: No analyze prompt at $PROMPT_FILE. Skipping analysis."
    log "=== Seam sync complete ==="
    exit 0
fi

ANALYZE_PROMPT=$(cat "$PROMPT_FILE")
PEOPLE_FILE="$ROOT/.seam/people.json"
PEOPLE_DATA="{}"
if [ -f "$PEOPLE_FILE" ]; then
    PEOPLE_DATA=$(cat "$PEOPLE_FILE")
fi

# Find all recordings missing analysis
UNANALYZED=()
for rec_dir in "$RECORDINGS_DIR"/*/; do
    [ ! -d "$rec_dir" ] && continue
    dir_name=$(basename "$rec_dir")
    [ "$dir_name" = ".gitkeep" ] && continue

    REC_JSON="$rec_dir/recording.json"
    ANALYSIS_JSON="$ANALYSIS_DIR/$dir_name/analysis.json"

    if [ -f "$REC_JSON" ] && [ ! -f "$ANALYSIS_JSON" ]; then
        UNANALYZED+=("$dir_name")
    fi
done

MAX_PARALLEL=5

if [ ${#UNANALYZED[@]} -eq 0 ]; then
    log "All recordings have been analyzed."
else
    log "Found ${#UNANALYZED[@]} recording(s) missing analysis. (max $MAX_PARALLEL parallel)"

    analyze_one() {
        local dir_name="$1"
        local REC_JSON="$RECORDINGS_DIR/$dir_name/recording.json"
        local ANALYSIS_OUT_DIR="$ANALYSIS_DIR/$dir_name"

        mkdir -p "$ANALYSIS_OUT_DIR"

        log "  Analyzing: $dir_name"

        local RECORDING_DATA
        RECORDING_DATA=$(cat "$REC_JSON")

        claude -p "You are analyzing a Pocket AI recording. Output TWO files and nothing else.

$ANALYZE_PROMPT

---

Here is the recording data:

$RECORDING_DATA

---

Here are the known people (use these to infer speakers in the transcript):

$PEOPLE_DATA

---

Write the analysis markdown to: $ANALYSIS_OUT_DIR/analysis.md
Write the structured JSON to: $ANALYSIS_OUT_DIR/analysis.json

Use the Write tool to create both files. Do not output anything else." \
            --allowedTools "Write" \
            >> "$LOG_FILE" 2>&1

        # Verify analysis was created
        if [ -f "$ANALYSIS_OUT_DIR/analysis.json" ]; then
            log "  Done: $dir_name"
        else
            log "  FAILED: $dir_name (analysis.json not created)"
        fi
    }

    RUNNING=0
    for dir_name in "${UNANALYZED[@]}"; do
        analyze_one "$dir_name" &
        RUNNING=$((RUNNING + 1))

        # Wait for a slot if we hit the limit
        if [ "$RUNNING" -ge "$MAX_PARALLEL" ]; then
            wait -n 2>/dev/null || wait  # wait -n waits for any one job (bash 4.3+)
            RUNNING=$((RUNNING - 1))
        fi
    done

    # Wait for remaining jobs
    wait
    log "All analysis jobs complete."
fi

# Clean up old manifest if it exists
rm -f "$ROOT/.seam/.last-pull-manifest"

# ── Phase 3: Rebuild dashboard manifest ───────────────────────
log "Rebuilding dashboard manifest..."
python3 -u "$SCRIPT_DIR/build-manifest.py" 2>&1 | tee -a "$LOG_FILE"

log "=== Seam sync complete ==="
