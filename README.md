<p align="center">
  <img src="public/logo.svg" alt="Seam" width="60" />
</p>

<h1 align="center">Seam</h1>

<p align="center">
  Open-source companion for <a href="https://heypocketai.com">Pocket AI</a>.<br/>
  Pull your recordings via the API, analyze them with Claude, and browse everything in a local dashboard — no Pro subscription needed.
</p>

## Screenshots

| Home                               | Summary                                         | Actions                                         |
| ---------------------------------- | ----------------------------------------------- | ----------------------------------------------- |
| ![Home](docs/screenshots/home.png) | ![Summary](docs/screenshots/detail-summary.png) | ![Actions](docs/screenshots/detail-actions.png) |

| Transcript                                            | Mind Map                                         |
| ----------------------------------------------------- | ------------------------------------------------ |
| ![Transcript](docs/screenshots/detail-transcript.png) | ![Mind Map](docs/screenshots/detail-mindmap.png) |

## Features

- **Automatic sync** — pulls recordings from the Pocket API with real-time log streaming
- **AI analysis** — Claude analyzes each recording: summaries, action items, decisions, open questions, key quotes, topic breakdown, mind maps, and sentiment
- **Parallel analysis** — up to 5 concurrent Claude sessions for fast bulk processing
- **Speaker inference** — Claude maps "Unknown" speakers to known people using names, roles, and context
- **Interactive mind maps** — visual topic graphs with color-coded nodes (React Flow)
- **People management** — create people with aliases, tags, roles, and notes for speaker attribution
- **Colored tags** — auto-assigned color palette for people and recording tags
- **Speaker assignment** — manually rename speakers in transcripts (single block or all segments)
- **Action items** — toggle completion, copy individual items or entire sections
- **Copy to clipboard** — structured copy for action items, decisions, open questions, key quotes
- **Search** — full-text search across recordings, transcripts, and analyses
- **Sort & filter** — by date, duration, title, recording type, and tags
- **Date grouping** — timeline grouped by "Today", "Yesterday", day name
- **Recording dates** — uses actual recording time, not processing time
- **Sync page** — real-time log streaming, sync history with expandable logs, stop/cancel with cleanup
- **Delete tracking** — deleted recordings won't re-sync
- **File-based storage** — portable `.seam/` directory, no database required

## Prerequisites

- **Node.js** 20+
- **Python** 3.10+
- **Claude Code** CLI (for analysis step) — [install](https://docs.anthropic.com/en/docs/claude-code)
- **Pocket API key** — get from [Pocket Settings → API Keys](https://app.heypocket.com/app/settings/api-keys)

## Quick start

```bash
git clone https://github.com/yoaquim/seam.git
cd seam
npm install

# Add your Pocket API key
cp .env.example .env
# Edit .env → POCKET_API_KEY=pk_your_key_here

# Start the dashboard (API server + frontend)
npm run dev
# Open http://localhost:5173

# Click "Sync" in the dashboard to pull and analyze recordings
# Or run manually: ./scripts/pocket-run.sh
```

## How it works

### Sync (`scripts/pocket-run.sh`)

1. **Pull** — `pocket_pull.py` calls the Pocket API, fetches recordings (transcripts + summaries), writes to `.seam/recordings/`
2. **Analyze** — Scans all recordings missing analysis. Runs up to 5 parallel `claude -p` sessions with the analysis prompt + known people list. Claude writes structured JSON + markdown to `.seam/analysis/`
3. **Manifest** — Rebuilds `public/manifest.json` for the dashboard

### Analysis prompt (`prompts/analyze.md`)

Claude produces per recording:

- Executive summary, key takeaways, decisions, action items
- Open questions, key quotes, topic breakdown
- Mind map graph (nodes + edges)
- Speaker inference map (attributes "Unknown" transcript segments to known people)
- Sentiment analysis

### Dashboard

React + TypeScript + Tailwind + shadcn/ui + React Flow.

- **Home** — Recording grid with sort/filter by date, duration, type, tags. Grouped by date. Colored tag badges.
- **Detail page** — 4 tabs:
  - **Summary** — executive summary, sentiment, key takeaways, topics grid, key quotes with copy
  - **Actions** — toggleable action items, decisions with rationale, open questions. Copy individual or all.
  - **Transcript** — speaker filter pills, manual speaker assignment (all segments or single block), [edit] inline
  - **Mind Map** — interactive graph with zoom, pan, minimap, color-coded node types
- **People** — manage people with name, role, aliases (for speaker matching), colored tags, and notes. Click card to view/edit.
- **Sync** — start/stop sync, real-time streaming logs, history of past syncs with expandable log viewer

### People & speaker inference

Add people at `/people` with name, role, aliases, tags, and notes. Aliases let you map variations ("Joaquin" → "Yoaquim") so the same person is recognized across recordings. During analysis, Claude uses this list to infer who is speaking. You can also manually reassign speakers in the transcript view — choose to rename all segments from that speaker or just a single block.

## Project structure

```
seam/
├── scripts/
│   ├── pocket_pull.py        # Pulls recordings from Pocket API
│   ├── pocket-run.sh         # Orchestration: pull → analyze (5 parallel) → rebuild
│   └── build-manifest.py     # Aggregates data for the dashboard
├── prompts/
│   └── analyze.md            # Claude analysis prompt template
├── server/
│   └── index.ts              # Express API (sync, people, actions, speakers, delete)
├── src/                      # React dashboard
├── .seam/                    # Local data (gitignored, created on first sync)
│   ├── recordings/           # Structured recording data
│   ├── analysis/             # Claude analysis output
│   ├── people.json           # Known people registry
│   └── sync-history.json     # Sync run history
└── .env.example
```

## Tests

```bash
npm test          # Runs vitest (TS) + pytest (Python) — 52 tests
npm run test:ts   # TypeScript only
npm run test:py   # Python only
```

## Cron (optional)

```bash
# Example crontab — runs at 2am daily
0 2 * * * cd /path/to/seam && ./scripts/pocket-run.sh >> .seam/seam.log 2>&1
```

On macOS, launchd runs missed jobs on wake.

## License

MIT
