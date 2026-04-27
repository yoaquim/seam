# Seam

Open-source Pocket AI companion — pulls recordings via API, analyzes with Claude, displays in a local dashboard.

## Stack

- **Dashboard**: React + TypeScript + Vite + Tailwind v4 + shadcn/ui (base-ui)
- **Mind maps**: @xyflow/react (React Flow)
- **Pull script**: Python 3 (stdlib only, no deps)
- **Orchestration**: Bash (xargs -P for parallelism)
- **Analysis**: Headless Claude Code
- **API server**: Express (TypeScript)
- **Landing page**: Vite + React + Magic UI + shadcn/ui (separate app in `landing/`)

## Project structure

- `scripts/pocket_pull.py` — pulls recordings from Pocket API, writes to `.seam/recordings/`
- `scripts/pocket-run.sh` — orchestration: pull → analyze (5 parallel) → stage people → rebuild manifest
- `scripts/build-manifest.py` — aggregates all recordings + analyses into `public/manifest.json`
- `scripts/stage-people.py` — scans analyses for speaker names, stages for user review
- `scripts/seed-people.py` — seeds people.json from existing analyses (contributed via PR)
- `prompts/analyze.md` — prompt template for Claude analysis (includes speaker inference)
- `server/index.ts` — Express API (sync, people, pending people, actions, speakers, settings)
- `server/s3.ts` — S3 sync module (optional backup, used by server after mutations)
- `src/` — React dashboard
- `landing/` — landing page (separate Vite app, builds to `docs/landing/`, deployed via GitHub Pages)
- `.seam/` — local data directory (gitignored)

## Commands

- `npm run dev` — start API server + dashboard dev server
- `npm run build` — production build
- `npm test` — run all tests (vitest + pytest)
- `npm run test:ts` — TypeScript tests only
- `npm run test:py` — Python tests only
- `npm run lint` — ESLint
- `npm run format` — Prettier (write)
- `npm run format:check` — Prettier (check only)
- `./scripts/pocket-run.sh` — full sync (pull + analyze + rebuild)

## Config

- `.env` — `POCKET_API_KEY=pk_xxx`, plus optional `S3_BUCKET`, `S3_PREFIX`, `AWS_PROFILE`
- `.pocket-last-sync` — timestamp of last successful sync (auto-managed)
- `.seam/generic-speakers.txt` — user-defined speaker exclusion list (one per line)

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

- No direct pushes to main — PRs only, squash merge
- **NEVER use `--no-verify`** — pre-commit hooks exist to catch issues before CI
- Pre-commit hook (husky) runs: `format:check` → `lint` → `test`
- **Before every commit**, verify locally: `npm run format:check && npm run lint && npm test`
- If any of these fail, fix them before committing — do not bypass
- Branches: `feature/`, `fix/`, `chore/`
- Commit messages: imperative, describe the "what" and "why"
- `landing/` and `docs/landing/` are excluded from root prettier and eslint (separate project)
