"""Custom GEPAAdapter for the Seam analyze prompt.

The component under optimization is a single string, ``analyze_prompt``,
corresponding to the contents of ``prompts/analyze.md``.

DataInst shape (a plain dict — no TypedDict required, GEPA treats DataInst as
opaque):
    {
        "recording_dir": str,    # absolute path to a .seam/recordings/<dir>
        "recording": dict,       # parsed recording.json contents
    }

The adapter wraps the candidate prompt with the same delimiters used in
``scripts/pocket-run.sh`` (recording data + people data) and adds an
optimization-time instruction telling Claude to emit raw JSON to stdout
instead of writing files (the production prompt uses the Write tool — that
mode is harder to score deterministically). The optimized prompt should be
tested in the production tool-writing path before promotion.
"""

from __future__ import annotations

import json
import re
import traceback
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any

from gepa.core.adapter import EvaluationBatch, GEPAAdapter

from prompt_optim.claude_cli_lm import ClaudeCliLM
from prompt_optim.metric import (
    MetricResult,
    consistency_score,
    parse_analysis_from_response,
    score_analysis,
)


COMPONENT_NAME = "analyze_prompt"


def _build_user_message(
    recording_data_json: str,
    people_data_json: str,
) -> str:
    return (
        "You are analyzing a Pocket AI recording. "
        "Output ONLY the analysis.json contents as a single raw JSON object. "
        "Do not write files, do not include any prose, do not wrap in markdown fences.\n\n"
        "---\n\n"
        "Here is the recording data:\n\n"
        f"{recording_data_json}\n\n"
        "---\n\n"
        "Here are the known people (use these to infer speakers in the transcript):\n\n"
        f"{people_data_json}\n\n"
        "---\n\n"
        "Emit the analysis.json now. Begin your response with `{` and end with `}`."
    )


def _truncate(s: str, n: int = 1500) -> str:
    if len(s) <= n:
        return s
    return s[: n - 100] + "\n\n... [truncated] ...\n\n" + s[-100:]


class SeamAnalyzeAdapter(GEPAAdapter[dict, dict, dict]):
    """Custom adapter that runs the analyze prompt via the Claude CLI.

    Args:
        lm: ClaudeCliLM wrapping a chosen task model.
        people_json_path: path to .seam/people.json for grounding the metric.
        enable_consistency: when True, the first example in each batch is run
            twice and the two outputs scored via metric.consistency_score().
            Doubles the LM calls for that one example. Default False.
    """

    def __init__(
        self,
        lm: ClaudeCliLM,
        people_json_path: str | Path,
        enable_consistency: bool = False,
    ):
        self.lm = lm
        self.enable_consistency = enable_consistency
        people_path = Path(people_json_path)
        if people_path.exists():
            self.people_data_json = people_path.read_text()
            data = json.loads(self.people_data_json)
            self.people_names = {
                self._norm(p["name"]) for p in data.get("people", []) if p.get("name")
            }
        else:
            self.people_data_json = "{}"
            self.people_names = set()

    @staticmethod
    def _norm(s: str) -> str:
        return re.sub(r"\s+", " ", s.strip().lower())

    def _run_once(
        self, candidate_prompt: str, recording: dict
    ) -> tuple[str, dict | None, str | None]:
        """Single LM call. Returns (raw_response, parsed_analysis_or_None, error_or_None)."""
        recording_data_json = json.dumps(recording)
        user_msg = _build_user_message(recording_data_json, self.people_data_json)
        messages = [
            {"role": "system", "content": candidate_prompt},
            {"role": "user", "content": user_msg},
        ]
        try:
            response = self.lm(messages)
        except Exception as e:
            tb = traceback.format_exc(limit=3)
            return ("", None, f"LM call failed: {e}\n{tb}")
        analysis = parse_analysis_from_response(response)
        if analysis is None:
            return (response, None, "json_parse_failed")
        return (response, analysis, None)

    def _evaluate_one(
        self,
        data: dict,
        candidate_prompt: str,
        consistency_for_this_example: bool,
    ) -> tuple[dict, float, dict]:
        """Run one example. Returns (output, score, trajectory).

        If ``consistency_for_this_example`` is True, runs the LM a second time
        on the same input and adds a consistency_score component.
        """
        recording = data["recording"]
        traj_meta = {
            "recording_dir": data.get("recording_dir"),
            "recording_title": recording.get("title"),
        }

        response, analysis, err = self._run_once(candidate_prompt, recording)
        if err == "json_parse_failed":
            traj = {
                "data": traj_meta,
                "response": _truncate(response),
                "feedback": (
                    "Output could not be parsed as JSON. The candidate prompt must "
                    "produce a single raw JSON object as the entire response (no "
                    "markdown fences, no prose). First 200 chars: "
                    + repr(response[:200])
                ),
                "score": 0.0,
                "subscores": {"schema": 0.0},
                "issues": ["json_parse_failed"],
            }
            return ({"full_assistant_response": response}, 0.0, traj)
        if err is not None:
            traj = {
                "data": traj_meta,
                "response": "",
                "feedback": err,
                "score": 0.0,
                "subscores": {},
                "issues": [f"lm_error: {err.splitlines()[0][:200]}"],
            }
            return ({"full_assistant_response": ""}, 0.0, traj)

        consistency = None
        if consistency_for_this_example:
            response_b, analysis_b, err_b = self._run_once(candidate_prompt, recording)
            if analysis_b is not None:
                consistency = consistency_score(analysis, analysis_b)
            else:
                # Second run failed; treat as zero consistency (the candidate
                # prompt isn't reliably producing valid output).
                consistency = 0.0

        result: MetricResult = score_analysis(
            analysis, recording, self.people_names, consistency_score=consistency
        )
        traj = {
            "data": traj_meta,
            "response": _truncate(response),
            "feedback": result.feedback,
            "score": result.total,
            "subscores": result.subscores,
            "issues": result.issues,
        }
        return ({"full_assistant_response": response}, result.total, traj)

    def evaluate(
        self,
        batch: list[dict],
        candidate: dict[str, str],
        capture_traces: bool = False,
    ) -> EvaluationBatch[dict, dict]:
        candidate_prompt = candidate.get(COMPONENT_NAME, "")
        if not candidate_prompt:
            raise ValueError(
                f"candidate is missing component {COMPONENT_NAME!r}; got {list(candidate)}"
            )

        outputs: list[dict] = []
        scores: list[float] = []
        trajectories: list[dict] = []
        for i, data in enumerate(batch):
            # Only run the consistency double-eval on the first example per
            # batch, to keep cost bounded (1 extra LM call per evaluate()).
            consistency_here = self.enable_consistency and i == 0
            output, score, traj = self._evaluate_one(
                data, candidate_prompt, consistency_here
            )
            outputs.append(output)
            scores.append(score)
            trajectories.append(traj)

        return EvaluationBatch(
            outputs=outputs,
            scores=scores,
            trajectories=trajectories if capture_traces else None,
        )

    def make_reflective_dataset(
        self,
        candidate: dict[str, str],
        eval_batch: EvaluationBatch[dict, dict],
        components_to_update: list[str],
    ) -> Mapping[str, Sequence[Mapping[str, Any]]]:
        assert components_to_update == [COMPONENT_NAME], (
            f"only {COMPONENT_NAME!r} is optimized, got {components_to_update}"
        )
        trajectories = eval_batch.trajectories
        assert trajectories is not None, "trajectories required for reflection"

        items: list[dict] = []
        for traj in trajectories:
            items.append(
                {
                    "Inputs": {
                        "recording_title": traj["data"].get("recording_title", ""),
                    },
                    "Generated Outputs": traj["response"],
                    "Feedback": traj["feedback"],
                }
            )
        if not items:
            raise RuntimeError("no trajectories to build reflective dataset from")
        return {COMPONENT_NAME: items}
