"""Tiny bridge to import is_generic / load_generic_labels from
``scripts/seed-people.py`` (which has a hyphen in its filename, blocking
normal import). Single source of truth for what counts as a "generic" name —
the metric and the production scripts must agree.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from typing import TYPE_CHECKING, Callable

_REPO_ROOT = Path(__file__).resolve().parent.parent
_SEED_PATH = _REPO_ROOT / "scripts" / "seed-people.py"


def _load() -> tuple[Callable[..., bool], Callable[[], set[str]]]:
    if not _SEED_PATH.exists():
        # Worktree fallback — scripts/ may live in the parent repo. Walk up
        # until we find it.
        cur = _REPO_ROOT
        for _ in range(5):
            cand = cur / "scripts" / "seed-people.py"
            if cand.exists():
                path = cand
                break
            cur = cur.parent
        else:
            raise FileNotFoundError(
                f"could not locate scripts/seed-people.py from {_REPO_ROOT}"
            )
    else:
        path = _SEED_PATH

    spec = importlib.util.spec_from_file_location("_seed_people", path)
    if spec is None or spec.loader is None:
        raise ImportError(f"could not load spec for {path}")
    mod = importlib.util.module_from_spec(spec)
    sys.modules["_seed_people"] = mod
    spec.loader.exec_module(mod)
    return mod.is_generic, mod.load_generic_labels


is_generic, load_generic_labels = _load()


__all__ = ["is_generic", "load_generic_labels"]
