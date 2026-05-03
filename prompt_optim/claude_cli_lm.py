"""Claude CLI subprocess wrapper for GEPA.

Routes every model call through `claude -p --output-format json` so the
optimizer uses the user's Max-subscription auth (CLI keychain OAuth) instead
of an Anthropic API key. One auth bucket means we serialize calls and back
off on usage-limit errors.

The wrapper exposes a single class, ``ClaudeCliLM``, callable in two shapes:

  - ``lm(messages)`` where messages is a list of ``{"role", "content"}`` dicts
    (matches GEPA's ``ChatCompletionCallable`` protocol used by ``task_lm``).
  - ``lm(prompt)`` where prompt is a string (matches GEPA's ``LanguageModel``
    protocol used by ``reflection_lm``).
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import threading
import time
from collections.abc import Sequence
from pathlib import Path
from typing import Any

_REPO_ROOT = Path(__file__).resolve().parent.parent


def _state_path() -> Path:
    env = os.environ.get("SEAM_DATA_DIR")
    base = Path(env).expanduser().resolve() if env else _REPO_ROOT / ".seam"
    return base / "prompt-optim-state.json"

# Single global lock — Max is one auth bucket, parallelism just burns it faster.
_CALL_LOCK = threading.Lock()

# Patterns the CLI emits when the subscription cap is hit. Matched against the
# JSON envelope's `result` / `error` fields case-insensitively.
_RATE_LIMIT_PATTERNS = (
    "usage limit",
    "rate limit",
    "rate_limit",
    "too many requests",
    "quota exceeded",
    "5-hour limit",
    "weekly limit",
)


def _looks_rate_limited(envelope: dict[str, Any]) -> bool:
    if envelope.get("is_error"):
        subtype = (envelope.get("subtype") or "").lower()
        if "rate" in subtype or "limit" in subtype or "quota" in subtype:
            return True
    blob = json.dumps(envelope).lower()
    return any(pat in blob for pat in _RATE_LIMIT_PATTERNS)


def _flatten_messages(messages: Sequence[dict[str, str]]) -> tuple[str | None, str]:
    """Split a messages list into (system_prompt, user_prompt).

    The Claude CLI takes a single positional prompt string plus an optional
    --append-system-prompt. We pull all system messages into the system slot
    (joined) and all user/assistant messages into the user slot (joined with
    role markers, since the CLI is single-turn in -p mode).
    """
    system_parts: list[str] = []
    convo_parts: list[str] = []
    for m in messages:
        role = m.get("role", "user")
        content = m.get("content", "")
        if role == "system":
            system_parts.append(content)
        elif role == "user":
            convo_parts.append(content)
        elif role == "assistant":
            convo_parts.append(f"[Assistant previously said]\n{content}")
        else:
            convo_parts.append(f"[{role}]\n{content}")
    system_prompt = "\n\n".join(system_parts) if system_parts else None
    user_prompt = "\n\n".join(convo_parts) if convo_parts else ""
    return system_prompt, user_prompt


def _load_state() -> dict[str, Any]:
    if _state_path().exists():
        try:
            return json.loads(_state_path().read_text())
        except json.JSONDecodeError:
            pass
    return {
        "calls": 0,
        "rate_limit_hits": 0,
        "last_error": None,
        "total_cost_usd_proxy": 0.0,
        "total_input_tokens": 0,
        "total_output_tokens": 0,
        "total_cache_read_input_tokens": 0,
        "total_cache_creation_input_tokens": 0,
        "total_duration_ms": 0,
        "by_model": {},  # model -> {"calls", "input_tokens", "output_tokens", "cost_proxy"}
    }


def _save_state(state: dict[str, Any]) -> None:
    _state_path().parent.mkdir(parents=True, exist_ok=True)
    _state_path().write_text(json.dumps(state, indent=2))


def _accumulate_telemetry(
    state: dict[str, Any], model: str, envelope: dict[str, Any]
) -> None:
    """Pull cost/usage fields from the CLI envelope into the state file.

    Note: under Max-subscription auth (OAuth/keychain), the `total_cost_usd`
    field is *not* a real dollar charge — there's no API billing event. It's
    still a useful proxy of subscription burn, so we record it as
    ``total_cost_usd_proxy``.
    """
    cost = envelope.get("total_cost_usd")
    if isinstance(cost, (int, float)):
        state["total_cost_usd_proxy"] = state.get("total_cost_usd_proxy", 0.0) + float(cost)
    usage = envelope.get("usage") or {}
    for src_key, dst_key in (
        ("input_tokens", "total_input_tokens"),
        ("output_tokens", "total_output_tokens"),
        ("cache_read_input_tokens", "total_cache_read_input_tokens"),
        ("cache_creation_input_tokens", "total_cache_creation_input_tokens"),
    ):
        v = usage.get(src_key)
        if isinstance(v, (int, float)):
            state[dst_key] = state.get(dst_key, 0) + int(v)
    dur = envelope.get("duration_ms")
    if isinstance(dur, (int, float)):
        state["total_duration_ms"] = state.get("total_duration_ms", 0) + int(dur)
    by = state.setdefault("by_model", {})
    bucket = by.setdefault(model, {
        "calls": 0,
        "input_tokens": 0,
        "output_tokens": 0,
        "cost_proxy": 0.0,
    })
    bucket["calls"] += 1
    bucket["input_tokens"] += int(usage.get("input_tokens") or 0)
    bucket["output_tokens"] += int(usage.get("output_tokens") or 0)
    if isinstance(cost, (int, float)):
        bucket["cost_proxy"] += float(cost)


class RateLimitError(RuntimeError):
    pass


class ClaudeCliLM:
    """Subprocess wrapper around `claude -p --output-format json`.

    Args:
        model: claude alias (e.g. "sonnet", "opus", "haiku") or full model id.
        timeout: per-call subprocess timeout (seconds).
        max_retries: how many times to retry on transient errors.
        max_rate_limit_wait: cap on a single backoff sleep (seconds).
    """

    def __init__(
        self,
        model: str = "sonnet",
        timeout: int = 600,
        max_retries: int = 8,
        max_rate_limit_wait: int = 3600,
        verbose: bool = True,
    ):
        self.model = model
        self.timeout = timeout
        self.max_retries = max_retries
        self.max_rate_limit_wait = max_rate_limit_wait
        self.verbose = verbose

    def __call__(self, prompt_or_messages: str | Sequence[dict[str, str]]) -> str:
        if isinstance(prompt_or_messages, str):
            system_prompt, user_prompt = None, prompt_or_messages
        else:
            system_prompt, user_prompt = _flatten_messages(prompt_or_messages)
        return self._complete(system_prompt, user_prompt)

    def _complete(self, system_prompt: str | None, user_prompt: str) -> str:
        attempt = 0
        backoff = 30.0
        while True:
            with _CALL_LOCK:
                envelope = self._invoke(system_prompt, user_prompt)
            if envelope.get("is_error") is False and "result" in envelope:
                state = _load_state()
                state["calls"] = state.get("calls", 0) + 1
                _accumulate_telemetry(state, self.model, envelope)
                _save_state(state)
                return envelope["result"]

            # Error path: figure out if it's rate-limit (retry with backoff)
            # or something else (bounded retries).
            attempt += 1
            if attempt > self.max_retries:
                raise RuntimeError(
                    f"Claude CLI failed after {self.max_retries} retries: "
                    f"{json.dumps(envelope)[:500]}"
                )

            if _looks_rate_limited(envelope):
                state = _load_state()
                state["rate_limit_hits"] = state.get("rate_limit_hits", 0) + 1
                state["last_error"] = envelope.get("result") or envelope.get("error")
                _save_state(state)
                wait = min(backoff, self.max_rate_limit_wait)
                if self.verbose:
                    print(
                        f"[claude_cli_lm] rate-limit hit (attempt {attempt}); "
                        f"sleeping {wait:.0f}s then retrying",
                        file=sys.stderr,
                    )
                time.sleep(wait)
                backoff = min(backoff * 2, self.max_rate_limit_wait)
                continue

            # Non-rate-limit error: short backoff and try again.
            if self.verbose:
                print(
                    f"[claude_cli_lm] transient error (attempt {attempt}): "
                    f"{json.dumps(envelope)[:200]}",
                    file=sys.stderr,
                )
            time.sleep(min(5 * attempt, 60))

    def _invoke(self, system_prompt: str | None, user_prompt: str) -> dict[str, Any]:
        cmd = [
            "claude",
            "-p",
            user_prompt,
            "--output-format",
            "json",
            "--model",
            self.model,
        ]
        if system_prompt:
            cmd.extend(["--append-system-prompt", system_prompt])

        env = os.environ.copy()
        # Defensive: if an ANTHROPIC_API_KEY happens to be set, unset it so the
        # CLI uses the keychain OAuth (Max subscription) instead of API billing.
        env.pop("ANTHROPIC_API_KEY", None)

        try:
            proc = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=self.timeout,
                env=env,
                check=False,
            )
        except subprocess.TimeoutExpired as e:
            return {
                "is_error": True,
                "subtype": "timeout",
                "result": f"timed out after {self.timeout}s",
                "stderr": (e.stderr or "")[-500:] if isinstance(e.stderr, str) else "",
            }

        if proc.returncode != 0:
            return {
                "is_error": True,
                "subtype": "nonzero_exit",
                "returncode": proc.returncode,
                "result": (proc.stderr or proc.stdout or "")[-1000:],
            }

        # The CLI prints one JSON object on stdout in --output-format json mode.
        try:
            return json.loads(proc.stdout)
        except json.JSONDecodeError:
            return {
                "is_error": True,
                "subtype": "bad_json",
                "result": proc.stdout[-1000:],
                "stderr": proc.stderr[-500:],
            }


def make_lm(model: str = "sonnet", **kwargs: Any) -> ClaudeCliLM:
    """Convenience factory."""
    return ClaudeCliLM(model=model, **kwargs)


if __name__ == "__main__":
    # Smoke test: a tiny round-trip via haiku.
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="haiku")
    ap.add_argument("--prompt", default="Reply with exactly the word OK and nothing else.")
    args = ap.parse_args()

    lm = ClaudeCliLM(model=args.model, timeout=60, max_retries=2, verbose=True)
    out = lm([{"role": "user", "content": args.prompt}])
    print(f"--- response ---\n{out}\n--- end ---")
