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
- `scripts/pocket-run.sh` — orchestration: pull → analyze (5 parallel) → stage people → rebuild manifest
- `scripts/build-manifest.py` — aggregates all recordings + analyses into `public/manifest.json`
- `scripts/stage-people.py` — scans analyses for speaker names, stages for user review
- `prompts/analyze.md` — prompt template for Claude analysis (includes speaker inference)
- `server/index.ts` — Express API (sync, people, pending people, actions, speakers, delete)
- `src/` — React dashboard
- `.seam/` — local data directory (gitignored)

## Commands

- `npm run dev` — start API server + dashboard dev server
- `npm run build` — production build
- `npm test` — run all tests (vitest + pytest)
- `npm run test:ts` — TypeScript tests only
- `npm run test:py` — Python tests only
- `./scripts/pocket-run.sh` — full sync (pull + analyze + rebuild)

## Config

- `.env` — `POCKET_API_KEY=pk_xxx`
- `.pocket-last-sync` — timestamp of last successful sync (auto-managed)

## Practices

### TDD (mandatory)

Red-green-refactor for all implementation tasks:

1. **RED** — write a failing test for the expected behavior
2. **GREEN** — write minimal code to make it pass
3. **REFACTOR** — clean up while keeping tests green

Tests must pass before committing. No feature code without tests.

**Test types:**
- Unit: individual functions in isolation (vitest for TS, pytest for Python)
- Integration: API endpoints with supertest
- Component: React Testing Library (behavior, not implementation)

**File placement:**
- TypeScript: `server/__tests__/`, `src/components/__tests__/`, `src/hooks/__tests__/`
- Python: `scripts/tests/`

**Coverage targets:**
- 80%+ on new code
- Critical paths (sync, people CRUD, speaker assignment): higher
- Don't chase 100% on simple UI components

### React

- Functional components only, named exports matching filename
- Props destructured in function signature
- `useState` for local UI state, lift to nearest common ancestor
- Custom hooks in `src/hooks/` for reusable logic
- Test behavior (what the user sees), not implementation
- `screen.getByRole` / `getByText` over `getByTestId`

### Tailwind

- No custom CSS — Tailwind utilities only
- Project palette: white, `#2b2b2b`, grays. Dark borders.
- Font: Public Sans (`@fontsource-variable/public-sans`)
- `cursor-pointer` on all interactive elements
- `transition-colors` on hover effects

### Git

- No direct pushes to main — PRs only
- Tests must pass before merge
- Branches: `feature/`, `fix/`, `chore/`
- Commit messages: imperative, describe the "what" and "why"
