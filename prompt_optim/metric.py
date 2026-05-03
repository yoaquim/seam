"""Reference-free deterministic metric for analyze.md outputs.

Derived only from the source recording + people.json + the recording's own
transcript. No gold-standard analyses required.

Component anatomy:

  Hard gate (binary; if 0 the rest are short-circuited)
    schema_score              JSON parses + matches the schema in analyze.md

  Quality components (weighted sum if the gate passes)
    speaker_grounding_score   speaker_map names ⊆ people.json AND not generic
    participant_consistency   participants ⊆ people.json ∪ speaker_map vals,
                              no generics
    attribution_grounding     speaker_map + decisions[].by + key_quotes[].speaker
                              + action_items[].owner all grounded
    quote_grounding_score     key_quote .text appears as substring in transcript
    coverage_spread_score     quote timestamps cover all 3 thirds of the recording
    takeaway_quality_score    pairwise non-redundancy (Jaccard) + transcript
                              grounding for each takeaway
    mind_map_quality_score    integrity + connectivity + branching + node-type
                              variety
    output_economy_score      sigmoid penalty on bloated analysis.json
    consistency_score         optional, set externally via score_consistency()

Weights (sum to 1.0 with consistency disabled):

    speaker_grounding         0.15
    participant_consistency   0.05
    attribution_grounding     0.15
    quote_grounding           0.15
    coverage_spread           0.05
    takeaway_quality          0.20
    mind_map_quality          0.10
    output_economy            0.10
    consistency               0.05  (when enabled; weights re-normalize)

When consistency is disabled, its 0.05 is redistributed pro-rata across the
other components so the total still ranges over [0, 1].
"""

from __future__ import annotations

import json
import math
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

_REPO_ROOT = Path(__file__).resolve().parent.parent

# Import is_generic / load_generic_labels from scripts/seed_people.py so the
# metric and production speaker-staging pipeline share one definition.
import sys as _sys

_sys.path.insert(0, str(_REPO_ROOT / "scripts"))
from seed_people import is_generic, load_generic_labels  # noqa: E402

_sys.path.pop(0)


def _default_seam_dir() -> Path:
    """Resolve the .seam/ data directory.

    Honors $SEAM_DATA_DIR if set (useful for git worktrees that don't have
    their own .seam/), else defaults to the repo's .seam/.
    """
    import os

    env = os.environ.get("SEAM_DATA_DIR")
    if env:
        return Path(env).expanduser().resolve()
    return _REPO_ROOT / ".seam"


def _people_path() -> Path:
    return _default_seam_dir() / "people.json"


_REQUIRED_TOP_LEVEL = {
    "recording_id",
    "title",
    "date",
    "duration_seconds",
    "type",
    "participants",
    "executive_summary",
    "takeaways",
    "decisions",
    "action_items",
    "open_questions",
    "key_quotes",
    "topics",
    "mind_map",
    "sentiment",
    "tags_suggested",
    "speaker_map",
}

_VALID_TYPES = {"meeting", "brainstorm", "interview", "lecture", "conversation", "other"}
_VALID_SENTIMENTS = {"positive", "neutral", "negative", "mixed"}
_VALID_NODE_TYPES = {"topic", "subtopic", "decision", "action", "question"}

# Stopwords used for takeaway grounding & Jaccard. Small built-in list to keep
# stdlib-only.
_STOPWORDS = {
    "a", "an", "the", "and", "or", "but", "of", "in", "on", "at", "to", "for",
    "with", "from", "by", "is", "was", "be", "are", "were", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "should",
    "could", "may", "might", "must", "shall", "can", "this", "that", "these",
    "those", "i", "you", "he", "she", "it", "we", "they", "me", "him", "her",
    "us", "them", "my", "your", "his", "its", "our", "their", "as", "if",
    "so", "not", "no", "yes", "than", "then", "there", "here", "what", "when",
    "where", "why", "how", "all", "any", "some", "more", "most", "much",
    "many", "very", "also", "too", "just", "only", "about", "into", "out",
    "over", "up", "down", "off", "now", "well", "really", "like", "going",
    "going to", "want", "need", "think", "thought", "say", "says", "said",
    "okay", "ok", "yeah", "right", "good", "great",
}


# ---------- helpers ----------------------------------------------------------


@dataclass
class MetricResult:
    total: float
    subscores: dict[str, float]
    feedback: str
    issues: list[str] = field(default_factory=list)


def _normalize_name(s: str) -> str:
    return re.sub(r"\s+", " ", s.strip().lower())


def _whitespace_fuzz(s: str) -> str:
    return re.sub(r"\s+", " ", s.strip().lower())


def _content_words(s: str, exclude: set[str] | None = None) -> set[str]:
    """Lowercase content tokens (>3 chars, not stopwords, not in exclude)."""
    excl = exclude or set()
    out: set[str] = set()
    for w in re.split(r"\W+", s.lower()):
        if len(w) <= 3 or w in _STOPWORDS or w in excl:
            continue
        out.add(w)
    return out


def _load_people_names(path: Path | None = None) -> set[str]:
    p = path or _people_path()
    if not p.exists():
        return set()
    try:
        data = json.loads(p.read_text())
    except json.JSONDecodeError:
        return set()
    names: set[str] = set()
    for p_ in data.get("people", []):
        n = p_.get("name")
        if isinstance(n, str) and n.strip():
            names.add(_normalize_name(n))
    return names


def _is_grounded_name(
    name: str | None,
    people: set[str],
    generics: set[str],
) -> tuple[bool, str | None]:
    """Returns (grounded, reason_if_not). 'Unknown' counts as grounded."""
    if name is None:
        return True, None
    if not isinstance(name, str) or not name.strip():
        return False, "empty"
    if is_generic(name, generics):
        return False, "generic"
    if _normalize_name(name) in people:
        return True, None
    return False, "not_in_people_json"


# ---------- components -------------------------------------------------------


def _schema_score(analysis: dict[str, Any], issues: list[str]) -> float:
    if not isinstance(analysis, dict):
        issues.append("output is not a JSON object")
        return 0.0
    missing = _REQUIRED_TOP_LEVEL - set(analysis.keys())
    if missing:
        issues.append(f"missing required fields: {sorted(missing)}")
        return 0.0
    typ = analysis.get("type")
    if typ not in _VALID_TYPES:
        issues.append(f"type {typ!r} not in {sorted(_VALID_TYPES)}")
        return 0.0
    sent = analysis.get("sentiment")
    if sent not in _VALID_SENTIMENTS:
        issues.append(f"sentiment {sent!r} not in {sorted(_VALID_SENTIMENTS)}")
        return 0.0
    for k in ("takeaways", "open_questions", "tags_suggested", "participants"):
        if not isinstance(analysis.get(k), list):
            issues.append(f"{k} is not a list")
            return 0.0
    for k in ("decisions", "action_items", "key_quotes", "topics"):
        v = analysis.get(k)
        if not isinstance(v, list):
            issues.append(f"{k} is not a list")
            return 0.0
    mm = analysis.get("mind_map")
    if not isinstance(mm, dict) or not isinstance(mm.get("nodes"), list) or not isinstance(mm.get("edges"), list):
        issues.append("mind_map missing nodes/edges arrays")
        return 0.0
    sm = analysis.get("speaker_map")
    if not isinstance(sm, dict):
        issues.append("speaker_map is not an object")
        return 0.0
    return 1.0


def _speaker_grounding_score(
    analysis: dict[str, Any],
    people: set[str],
    generics: set[str],
    issues: list[str],
) -> float:
    sm = analysis.get("speaker_map", {})
    if not sm:
        return 1.0
    grounded = 0
    total = 0
    bad: dict[str, list[str]] = {}
    for _idx, name in sm.items():
        if not isinstance(name, str):
            continue
        total += 1
        ok, reason = _is_grounded_name(name, people, generics)
        if ok:
            grounded += 1
        else:
            bad.setdefault(reason or "unknown", []).append(name)
    if total == 0:
        return 1.0
    if bad:
        for reason, names in sorted(bad.items()):
            issues.append(
                f"speaker_map: {len(names)} {reason} name(s), e.g. {sorted(set(names))[:3]}"
            )
    return grounded / total


def _participant_consistency_score(
    analysis: dict[str, Any],
    people: set[str],
    generics: set[str],
    issues: list[str],
) -> float:
    parts = analysis.get("participants") or []
    if not parts:
        return 1.0
    sm_vals = {
        _normalize_name(v) for v in analysis.get("speaker_map", {}).values()
        if isinstance(v, str)
    }
    total = 0
    grounded = 0
    bad: list[str] = []
    for p in parts:
        if not isinstance(p, str) or not p.strip():
            continue
        total += 1
        norm = _normalize_name(p)
        if norm == "unknown":
            grounded += 1
            continue
        if is_generic(p, generics):
            bad.append(f"{p!r} (generic)")
            continue
        if norm in people or norm in sm_vals:
            grounded += 1
        else:
            bad.append(f"{p!r} (not in people.json or speaker_map)")
    if total == 0:
        return 1.0
    if bad:
        issues.append(f"participants: {len(bad)} ungrounded: {sorted(set(bad))[:3]}")
    return grounded / total


def _attribution_grounding_score(
    analysis: dict[str, Any],
    people: set[str],
    generics: set[str],
    issues: list[str],
) -> float:
    """Aggregate grounding across speaker_map, decisions[].by, key_quotes[].speaker,
    action_items[].owner. Each non-null name is one observation; score is the
    fraction grounded.
    """
    grounded = 0
    total = 0
    bad: dict[str, list[str]] = {}

    def _check(field_path: str, name: str | None) -> None:
        nonlocal grounded, total
        if name is None:
            return
        if not isinstance(name, str) or not name.strip():
            return
        total += 1
        ok, reason = _is_grounded_name(name, people, generics)
        if ok:
            grounded += 1
        else:
            bad.setdefault(field_path, []).append(name)

    for _i, n in (analysis.get("speaker_map") or {}).items():
        _check("speaker_map", n)
    for d in analysis.get("decisions") or []:
        if isinstance(d, dict):
            _check("decisions[].by", d.get("by"))
    for q in analysis.get("key_quotes") or []:
        if isinstance(q, dict):
            _check("key_quotes[].speaker", q.get("speaker"))
    for it in analysis.get("action_items") or []:
        if isinstance(it, dict):
            _check("action_items[].owner", it.get("owner"))

    if total == 0:
        return 1.0
    for field_path, names in sorted(bad.items()):
        issues.append(
            f"{field_path}: {len(names)} ungrounded, e.g. {sorted(set(names))[:3]}"
        )
    return grounded / total


def _quote_groundedness_score(
    analysis: dict[str, Any], recording: dict[str, Any], issues: list[str]
) -> float:
    quotes = analysis.get("key_quotes") or []
    if not quotes:
        return 1.0
    transcript = recording.get("transcript") or []
    haystack_pieces: list[str] = []
    for seg in transcript:
        for k in ("text", "originalText"):
            v = seg.get(k)
            if isinstance(v, str):
                haystack_pieces.append(_whitespace_fuzz(v))
    haystack = " ||| ".join(haystack_pieces)
    if not haystack:
        return 1.0
    grounded = 0
    samples: list[str] = []
    for q in quotes:
        text = q.get("text") if isinstance(q, dict) else None
        if not isinstance(text, str) or not text.strip():
            continue
        if _whitespace_fuzz(text) in haystack:
            grounded += 1
        else:
            if len(samples) < 3:
                samples.append(text[:80])
    total = len(quotes)
    if grounded < total and samples:
        issues.append(
            f"key_quotes: {total - grounded}/{total} not in transcript "
            f"(samples: {samples})"
        )
    return grounded / total if total else 1.0


def _coverage_spread_score(
    analysis: dict[str, Any], recording: dict[str, Any], issues: list[str]
) -> float:
    """Quote timestamps should cover all 3 thirds of the recording."""
    quotes = analysis.get("key_quotes") or []
    if not quotes:
        return 1.0
    duration = recording.get("duration") or 0
    if not duration or duration < 60:
        # Recording too short to meaningfully spread across thirds.
        return 1.0
    timestamps = [
        q.get("timestamp_seconds")
        for q in quotes
        if isinstance(q, dict) and isinstance(q.get("timestamp_seconds"), (int, float))
    ]
    if not timestamps:
        # Quotes exist but none have timestamps. Penalize lightly — model
        # didn't invest the effort to attribute them.
        issues.append("coverage_spread: no quote has a timestamp")
        return 0.5
    third = duration / 3.0
    thirds_hit = {min(int(t / third), 2) for t in timestamps}
    score = len(thirds_hit) / 3.0
    if score < 1.0:
        missing = sorted({0, 1, 2} - thirds_hit)
        names = {0: "first", 1: "middle", 2: "last"}
        issues.append(
            f"coverage_spread: quotes only cover {len(thirds_hit)}/3 thirds; "
            f"missing {[names[i] for i in missing]}"
        )
    return score


def _takeaway_quality_score(
    analysis: dict[str, Any], recording: dict[str, Any], people: set[str], issues: list[str]
) -> float:
    """Non-redundancy + transcript grounding.

    redundancy: pairwise Jaccard on content-word sets; pairs with J > 0.6 are
    redundant. Score = 1 - (redundant_pairs / max_pairs).

    grounding: each takeaway should share >= 2 content words with the
    transcript. Score = grounded / total.

    Combined as the average of the two sub-scores.
    """
    takeaways = analysis.get("takeaways") or []
    takeaways = [t for t in takeaways if isinstance(t, str) and t.strip()]
    if not takeaways:
        # Schema gate ensured the field is a list; empty isn't a hard fail
        # here (some recordings genuinely have nothing to say) but we score
        # neutral 0.5 to avoid rewarding empty outputs.
        return 0.5

    name_tokens = {tok for n in people for tok in n.split()}

    transcript_text = " ".join(
        seg.get("text") or seg.get("originalText") or ""
        for seg in (recording.get("transcript") or [])
        if isinstance(seg, dict)
    )
    transcript_words = _content_words(transcript_text, exclude=name_tokens)

    word_sets = [_content_words(t, exclude=name_tokens) for t in takeaways]

    # Non-redundancy
    n = len(takeaways)
    if n >= 2:
        redundant = 0
        max_pairs = n * (n - 1) // 2
        for i in range(n):
            for j in range(i + 1, n):
                a, b = word_sets[i], word_sets[j]
                if not a or not b:
                    continue
                jacc = len(a & b) / len(a | b)
                if jacc > 0.6:
                    redundant += 1
        nonredundancy = 1.0 - (redundant / max_pairs) if max_pairs else 1.0
        if redundant:
            issues.append(
                f"takeaways: {redundant}/{max_pairs} pair(s) redundant (Jaccard > 0.6)"
            )
    else:
        nonredundancy = 1.0

    # Grounding
    if not transcript_words:
        grounding = 1.0
    else:
        grounded = 0
        ungrounded_samples: list[str] = []
        for t, ws in zip(takeaways, word_sets, strict=True):
            shared = ws & transcript_words
            if len(shared) >= 2:
                grounded += 1
            else:
                if len(ungrounded_samples) < 3:
                    ungrounded_samples.append(t[:80])
        grounding = grounded / len(takeaways)
        if grounded < len(takeaways) and ungrounded_samples:
            issues.append(
                f"takeaways: {len(takeaways) - grounded}/{len(takeaways)} "
                f"not grounded in transcript (samples: {ungrounded_samples})"
            )

    return (nonredundancy + grounding) / 2.0


def _mind_map_quality_score(
    analysis: dict[str, Any], recording: dict[str, Any], issues: list[str]
) -> float:
    """Integrity + connectivity + branching factor + node-type variety.

    Each sub-check contributes 0.25 to the component (so all four pass = 1.0).
    """
    mm = analysis.get("mind_map", {})
    nodes = mm.get("nodes") or []
    edges = mm.get("edges") or []
    if not nodes:
        issues.append("mind_map: no nodes")
        return 0.0
    node_objs = [n for n in nodes if isinstance(n, dict)]
    node_ids = {n.get("id") for n in node_objs}

    # 1) Integrity: every edge endpoint exists.
    bad_edges = sum(
        1
        for e in edges
        if not isinstance(e, dict)
        or e.get("source") not in node_ids
        or e.get("target") not in node_ids
    )
    integrity = 0.0 if bad_edges else 1.0
    if bad_edges:
        issues.append(f"mind_map: {bad_edges} edge(s) reference missing nodes")

    # 2) Connectivity: undirected components count == 1.
    if len(nodes) == 1:
        connectivity = 1.0
    else:
        adj: dict[str, set[str]] = {nid: set() for nid in node_ids if nid is not None}
        for e in edges:
            if not isinstance(e, dict):
                continue
            s, t = e.get("source"), e.get("target")
            if s in adj and t in adj:
                adj[s].add(t)
                adj[t].add(s)
        seen: set[str] = set()
        components = 0
        for start in adj:
            if start in seen:
                continue
            components += 1
            stack = [start]
            while stack:
                cur = stack.pop()
                if cur in seen:
                    continue
                seen.add(cur)
                stack.extend(adj[cur])
        connectivity = 1.0 if components == 1 else 0.0
        if components > 1:
            issues.append(f"mind_map: {components} disconnected components")

    # 3) Branching factor: prefer 3..7 top-level branches from the most-connected
    #    node (root proxy). Penalize 1 (degenerate) and >12 (giant fan).
    if not adj or len(adj) < 2:
        branching = 1.0
    else:
        # Pick the node with most connections as the root proxy.
        root = max(adj, key=lambda k: len(adj[k]))
        deg = len(adj[root])
        if 3 <= deg <= 7:
            branching = 1.0
        elif deg in (2, 8, 9, 10, 11, 12) or deg == 1:
            branching = 0.5
            issues.append(
                f"mind_map: root branching factor {deg} (prefer 3-7)"
            )
        else:  # > 12
            branching = 0.0
            issues.append(
                f"mind_map: root branching factor {deg} > 12 (giant fan)"
            )

    # 4) Node-type variety: at least 2 distinct types from the valid set.
    types = {n.get("type") for n in node_objs if n.get("type") in _VALID_NODE_TYPES}
    if len(types) >= 2:
        variety = 1.0
    elif len(types) == 1:
        variety = 0.5
        issues.append(
            f"mind_map: all nodes share one type ({next(iter(types))!r}); "
            "expected mix of topic/decision/action/question"
        )
    else:
        variety = 0.0
        issues.append("mind_map: no nodes have a recognized type")

    return (integrity + connectivity + branching + variety) / 4.0


def _output_economy_score(analysis: dict[str, Any]) -> float:
    """Sigmoid penalty on serialized JSON size.

    Calibrated against the existing 178 analyses (size distribution:
    p25=11kB, median=14kB, p75=16kB, max=24kB). Centered at 14 kB so the
    *median current output* scores 0.5 — providing a real gradient toward
    smaller outputs without immediately blowing up the seed prompt's score.

    Approximate scores: ~0.95 at 6 kB, ~0.85 at 8 kB, ~0.73 at 11 kB,
    ~0.50 at 14 kB, ~0.31 at 16 kB, ~0.10 at 20 kB.
    """
    size = len(json.dumps(analysis))
    x = (size - 14000) / 3000
    return 1.0 / (1.0 + math.exp(x))


# ---------- weighting --------------------------------------------------------


_BASE_WEIGHTS = {
    "speaker_grounding": 0.15,
    "participant_consistency": 0.05,
    "attribution_grounding": 0.15,
    "quote_grounding": 0.15,
    "coverage_spread": 0.05,
    "takeaway_quality": 0.20,
    "mind_map_quality": 0.10,
    "output_economy": 0.10,
    "consistency": 0.05,
}


def _weights_for(include_consistency: bool) -> dict[str, float]:
    if include_consistency:
        return dict(_BASE_WEIGHTS)
    # Drop consistency, redistribute its 0.05 pro-rata across the rest.
    rest = {k: v for k, v in _BASE_WEIGHTS.items() if k != "consistency"}
    factor = 1.0 / sum(rest.values())
    return {k: v * factor for k, v in rest.items()}


# ---------- public API -------------------------------------------------------


def score_analysis(
    analysis: dict[str, Any],
    recording: dict[str, Any],
    people: set[str] | None = None,
    consistency_score: float | None = None,
) -> MetricResult:
    if people is None:
        people = _load_people_names()
    generics = load_generic_labels()
    issues: list[str] = []

    schema = _schema_score(analysis, issues)
    if schema == 0.0:
        return MetricResult(
            total=0.0,
            subscores={k: 0.0 for k in _BASE_WEIGHTS},
            feedback="Output failed schema validation. Issues:\n- " + "\n- ".join(issues),
            issues=issues,
        )

    subs: dict[str, float] = {
        "speaker_grounding": _speaker_grounding_score(analysis, people, generics, issues),
        "participant_consistency": _participant_consistency_score(analysis, people, generics, issues),
        "attribution_grounding": _attribution_grounding_score(analysis, people, generics, issues),
        "quote_grounding": _quote_groundedness_score(analysis, recording, issues),
        "coverage_spread": _coverage_spread_score(analysis, recording, issues),
        "takeaway_quality": _takeaway_quality_score(analysis, recording, people, issues),
        "mind_map_quality": _mind_map_quality_score(analysis, recording, issues),
        "output_economy": _output_economy_score(analysis),
    }
    if consistency_score is not None:
        subs["consistency"] = float(consistency_score)

    weights = _weights_for(include_consistency=consistency_score is not None)
    total = sum(weights[k] * subs[k] for k in weights)

    feedback_parts = [
        f"Score: {total:.3f}.",
        "Subscores: " + ", ".join(f"{k}={v:.2f}" for k, v in subs.items()) + ".",
    ]
    if issues:
        feedback_parts.append("Issues:\n- " + "\n- ".join(issues))
    else:
        feedback_parts.append("All quality gates passed.")
    return MetricResult(total=total, subscores=subs, feedback="\n".join(feedback_parts), issues=issues)


# ---------- consistency between two runs -------------------------------------


def _set_jaccard(a: set[str], b: set[str]) -> float:
    if not a and not b:
        return 1.0
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def consistency_score(analysis_a: dict[str, Any], analysis_b: dict[str, Any]) -> float:
    """Score how consistent two analyses of the same recording are.

    Computes Jaccard similarity over content-word sets of takeaways and over
    speaker_map name sets, averaged. Higher is better.
    """
    if not isinstance(analysis_a, dict) or not isinstance(analysis_b, dict):
        return 0.0

    def _takeaway_words(a: dict) -> set[str]:
        ts = a.get("takeaways") or []
        out: set[str] = set()
        for t in ts:
            if isinstance(t, str):
                out |= _content_words(t)
        return out

    def _speaker_set(a: dict) -> set[str]:
        sm = a.get("speaker_map") or {}
        return {
            _normalize_name(v) for v in sm.values()
            if isinstance(v, str) and v.strip()
        }

    j_takeaways = _set_jaccard(_takeaway_words(analysis_a), _takeaway_words(analysis_b))
    j_speakers = _set_jaccard(_speaker_set(analysis_a), _speaker_set(analysis_b))
    return (j_takeaways + j_speakers) / 2.0


# ---------- response parsing -------------------------------------------------


def parse_analysis_from_response(response: str) -> dict[str, Any] | None:
    """Best-effort extraction of an analysis JSON object from a model response."""
    s = response.strip()
    try:
        obj = json.loads(s)
        if isinstance(obj, dict):
            return obj
    except json.JSONDecodeError:
        pass
    m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", s, re.DOTALL)
    if m:
        try:
            obj = json.loads(m.group(1))
            if isinstance(obj, dict):
                return obj
        except json.JSONDecodeError:
            pass
    start = s.find("{")
    end = s.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            obj = json.loads(s[start : end + 1])
            if isinstance(obj, dict):
                return obj
        except json.JSONDecodeError:
            pass
    return None


# ---------- CLI smoke entry --------------------------------------------------


if __name__ == "__main__":
    import sys

    if len(sys.argv) != 3:
        print(
            "usage: python -m prompt_optim.metric "
            "<recording_dir> <analysis.json path>",
            file=sys.stderr,
        )
        sys.exit(2)
    rec_dir = Path(sys.argv[1])
    analysis_path = Path(sys.argv[2])
    recording = json.loads((rec_dir / "recording.json").read_text())
    analysis = json.loads(analysis_path.read_text())
    result = score_analysis(analysis, recording)
    print(f"total: {result.total:.3f}")
    for k, v in result.subscores.items():
        print(f"  {k:24s} {v:.3f}")
    if result.issues:
        print("\nissues:")
        for i in result.issues:
            print(f"  - {i}")
