# Seam

Open-source Pocket AI companion — pulls recordings via API, analyzes with Claude, displays in a local dashboard.

## Stack

- **Dashboard**: React + TypeScript + Vite + Tailwind v4 + shadcn/ui (base-ui)
- **Mind maps**: @xyflow/react (React Flow)
- **Pull script**: Python 3 (stdlib only, no deps)
- **Orchestration**: Bash
- **Analysis**: Headless Claude Code
- **API server**: Express (TypeScript)

## Project structure

- `scripts/pocket_pull.py` — pulls recordings from Pocket API, writes to `.seam/recordings/`
- `scripts/pocket-run.sh` — orchestration: pull → analyze all unanalyzed → rebuild manifest
- `scripts/build-manifest.py` — aggregates all recordings + analyses into `public/manifest.json`
- `prompts/analyze.md` — prompt template for Claude analysis (includes speaker inference)
- `server/index.ts` — Express API (sync, people CRUD, action toggle, speaker assignment, delete)
- `src/` — React dashboard
- `.seam/recordings/` — structured recording data (gitignored)
- `.seam/analysis/` — Claude analysis output (gitignored)
- `.seam/people.json` — known people registry (gitignored)
- `.seam/sync-history.json` — sync history (gitignored)

## Commands

- `npm run dev` — start API server + dashboard dev server
- `npm run build` — production build
- `npm test` — run all tests (vitest + pytest)
- `./scripts/pocket-run.sh` — full sync (pull + analyze + rebuild)
- `python3 scripts/build-manifest.py` — rebuild dashboard manifest

## Config

- `.env` — `POCKET_API_KEY=pk_xxx`
- `.pocket-last-sync` — timestamp of last successful sync (auto-managed)
