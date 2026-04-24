#!/usr/bin/env python3
"""Generate sample recording + analysis data for dashboard development."""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RECORDINGS_DIR = ROOT / ".seam" / "recordings"
ANALYSIS_DIR = ROOT / ".seam" / "analysis"

SAMPLES = [
    {
        "dir": "2026-04-22_weekly-standup",
        "recording": {
            "id": "rec_001",
            "title": "Weekly Standup",
            "description": "Monday team standup",
            "duration": 1247,
            "language": "en",
            "created_at": "2026-04-22T09:00:00Z",
            "tags": [{"name": "standup"}, {"name": "team"}],
            "transcript": [
                {"speaker": "Alice", "text": "Good morning everyone. Let's go around. What did you work on last week?", "start": 0, "end": 5},
                {"speaker": "Bob", "text": "I finished the auth migration. It's in review now. Should merge today.", "start": 6, "end": 12},
                {"speaker": "Alice", "text": "Great. Any blockers?", "start": 13, "end": 14},
                {"speaker": "Bob", "text": "Just waiting on the security team to approve the token rotation changes.", "start": 15, "end": 20},
                {"speaker": "Carol", "text": "I've been working on the dashboard redesign. Got the mockups approved by design. Starting implementation today.", "start": 21, "end": 28},
                {"speaker": "Alice", "text": "Nice. Carol, can you sync with Bob on the auth changes? The dashboard will need to handle the new token format.", "start": 29, "end": 36},
                {"speaker": "Carol", "text": "Sure, I'll set up a meeting this afternoon.", "start": 37, "end": 40},
                {"speaker": "Dave", "text": "I'm still debugging the memory leak in the worker process. I think it's related to the connection pool not being cleaned up.", "start": 41, "end": 50},
                {"speaker": "Alice", "text": "How long do you think that'll take?", "start": 51, "end": 53},
                {"speaker": "Dave", "text": "Hopefully today. If not, I'll escalate to the infrastructure team.", "start": 54, "end": 59},
                {"speaker": "Alice", "text": "Sounds good. Let's make sure we close out the sprint items by Thursday. We have the demo on Friday.", "start": 60, "end": 68},
            ],
            "summary": {
                "summary": {
                    "title": "Weekly Standup — Sprint Progress",
                    "emoji": "🏃",
                    "markdown": "Team standup covering auth migration progress, dashboard redesign kickoff, and worker memory leak investigation.",
                    "bulletPoints": [
                        "Auth migration in review, pending security approval",
                        "Dashboard redesign mockups approved, implementation starting",
                        "Memory leak in worker being debugged"
                    ]
                },
                "action_items": {
                    "actionItems": [
                        {"id": "ai_1", "title": "Merge auth migration PR", "status": "TODO", "isCompleted": False},
                        {"id": "ai_2", "title": "Carol sync with Bob on token format", "dueDate": "2026-04-22", "status": "TODO", "isCompleted": False},
                        {"id": "ai_3", "title": "Fix worker memory leak", "status": "TODO", "isCompleted": False}
                    ]
                },
                "mind_map": {"nodes": [], "edges": []},
                "processing_status": "completed"
            }
        },
        "analysis": {
            "recording_id": "rec_001",
            "title": "Weekly Standup",
            "date": "2026-04-22",
            "duration_seconds": 1247,
            "type": "meeting",
            "participants": ["Alice", "Bob", "Carol", "Dave"],
            "executive_summary": "Monday standup covering sprint progress. Auth migration near completion, dashboard redesign entering implementation, and an active memory leak investigation in the worker process.",
            "takeaways": [
                "Auth migration is code-complete and in review, blocked only on security team approval",
                "Dashboard redesign has design sign-off and enters implementation immediately",
                "Worker memory leak suspected to be connection pool related, may need infra team escalation",
                "Sprint demo is Friday — all items must close by Thursday",
                "Carol and Bob need to coordinate on new token format for dashboard"
            ],
            "decisions": [
                {"decision": "Sprint items must be closed by Thursday", "by": "Alice", "rationale": "Demo scheduled for Friday"},
                {"decision": "Carol to sync with Bob on auth token changes", "by": "Alice", "rationale": "Dashboard needs to handle new token format"}
            ],
            "action_items": [
                {"task": "Merge auth migration PR after security approval", "owner": "Bob", "due": "2026-04-22", "completed": False},
                {"task": "Sync with Bob on new token format for dashboard", "owner": "Carol", "due": "2026-04-22", "completed": False},
                {"task": "Fix worker memory leak (escalate to infra if not resolved today)", "owner": "Dave", "due": "2026-04-22", "completed": False},
                {"task": "Close all sprint items", "owner": "Team", "due": "2026-04-24", "completed": False}
            ],
            "open_questions": [
                "Will security team approve token rotation changes today?",
                "Is the memory leak caused by the connection pool or something else?",
                "Does the new token format require dashboard API changes?"
            ],
            "key_quotes": [
                {"text": "I finished the auth migration. It's in review now. Should merge today.", "speaker": "Bob", "timestamp_seconds": 6},
                {"text": "I think it's related to the connection pool not being cleaned up.", "speaker": "Dave", "timestamp_seconds": 41},
                {"text": "Let's make sure we close out the sprint items by Thursday.", "speaker": "Alice", "timestamp_seconds": 60}
            ],
            "topics": [
                {"name": "Auth Migration", "duration_minutes": 5, "description": "Status update on auth migration — in review, pending security approval"},
                {"name": "Dashboard Redesign", "duration_minutes": 3, "description": "Mockups approved, implementation starting, needs auth token coordination"},
                {"name": "Worker Memory Leak", "duration_minutes": 3, "description": "Active debugging, connection pool suspected, may need escalation"},
                {"name": "Sprint Planning", "duration_minutes": 2, "description": "Demo Friday, all items due Thursday"}
            ],
            "mind_map": {
                "nodes": [
                    {"id": "root", "label": "Weekly Standup", "type": "topic"},
                    {"id": "auth", "label": "Auth Migration", "type": "topic"},
                    {"id": "auth-review", "label": "In Review", "type": "subtopic"},
                    {"id": "auth-security", "label": "Security Approval", "type": "action"},
                    {"id": "dashboard", "label": "Dashboard Redesign", "type": "topic"},
                    {"id": "dash-mockups", "label": "Mockups Approved", "type": "subtopic"},
                    {"id": "dash-impl", "label": "Implementation Starting", "type": "action"},
                    {"id": "dash-token", "label": "Token Format Sync", "type": "action"},
                    {"id": "worker", "label": "Worker Memory Leak", "type": "topic"},
                    {"id": "worker-pool", "label": "Connection Pool", "type": "subtopic"},
                    {"id": "worker-escalate", "label": "May Escalate to Infra", "type": "question"},
                    {"id": "sprint", "label": "Sprint Demo Friday", "type": "decision"},
                    {"id": "sprint-thu", "label": "Close Items by Thursday", "type": "action"}
                ],
                "edges": [
                    {"source": "root", "target": "auth", "label": None},
                    {"source": "root", "target": "dashboard", "label": None},
                    {"source": "root", "target": "worker", "label": None},
                    {"source": "root", "target": "sprint", "label": None},
                    {"source": "auth", "target": "auth-review", "label": None},
                    {"source": "auth", "target": "auth-security", "label": "blocked by"},
                    {"source": "dashboard", "target": "dash-mockups", "label": None},
                    {"source": "dashboard", "target": "dash-impl", "label": None},
                    {"source": "dashboard", "target": "dash-token", "label": "needs"},
                    {"source": "dash-token", "target": "auth", "label": "depends on"},
                    {"source": "worker", "target": "worker-pool", "label": "suspected"},
                    {"source": "worker", "target": "worker-escalate", "label": None},
                    {"source": "sprint", "target": "sprint-thu", "label": None}
                ]
            },
            "sentiment": "neutral",
            "tags_suggested": ["standup", "sprint", "auth", "dashboard", "debugging"]
        }
    },
    {
        "dir": "2026-04-21_product-brainstorm",
        "recording": {
            "id": "rec_002",
            "title": "Product Brainstorm — Notifications",
            "description": "Brainstorm session for notification system redesign",
            "duration": 2834,
            "language": "en",
            "created_at": "2026-04-21T14:00:00Z",
            "tags": [{"name": "product"}, {"name": "brainstorm"}],
            "transcript": [
                {"speaker": "Eve", "text": "So the main problem is users are getting too many notifications and ignoring all of them.", "start": 0, "end": 6},
                {"speaker": "Frank", "text": "Right. Our data shows only 12% of push notifications are opened. That's terrible.", "start": 7, "end": 13},
                {"speaker": "Eve", "text": "What if we moved to a digest model? Bundle notifications and send them at optimal times.", "start": 14, "end": 21},
                {"speaker": "Grace", "text": "I like that. We could use ML to figure out when each user is most likely to engage.", "start": 22, "end": 28},
                {"speaker": "Frank", "text": "The risk is that time-sensitive notifications get buried in a digest.", "start": 29, "end": 35},
                {"speaker": "Eve", "text": "Good point. We need a priority system. Critical notifications go immediately, everything else gets batched.", "start": 36, "end": 44},
                {"speaker": "Grace", "text": "We should also let users set their own preferences. Some people want real-time, some want daily digest.", "start": 45, "end": 53},
                {"speaker": "Frank", "text": "That's a lot of settings UI. Can we start with smart defaults and let power users customize?", "start": 54, "end": 61},
                {"speaker": "Eve", "text": "Yes. Smart defaults first, settings page in v2. Let's prototype the digest approach this sprint.", "start": 62, "end": 70},
            ],
            "summary": {
                "summary": {
                    "title": "Notification System Redesign Brainstorm",
                    "emoji": "🔔",
                    "markdown": "Brainstorm on fixing low notification engagement (12% open rate). Team converging on digest model with priority tiers.",
                    "bulletPoints": [
                        "Current push notification open rate is only 12%",
                        "Proposed digest model with ML-optimized timing",
                        "Need priority system for time-sensitive vs. batchable notifications",
                        "Smart defaults first, user customization in v2"
                    ]
                },
                "action_items": {
                    "actionItems": [
                        {"id": "ai_4", "title": "Prototype digest notification approach", "status": "TODO", "isCompleted": False},
                        {"id": "ai_5", "title": "Design priority classification for notifications", "status": "TODO", "isCompleted": False}
                    ]
                },
                "mind_map": {"nodes": [], "edges": []},
                "processing_status": "completed"
            }
        },
        "analysis": {
            "recording_id": "rec_002",
            "title": "Product Brainstorm — Notifications",
            "date": "2026-04-21",
            "duration_seconds": 2834,
            "type": "brainstorm",
            "participants": ["Eve", "Frank", "Grace"],
            "executive_summary": "Brainstorm session addressing poor notification engagement (12% open rate). Team decided on a digest model with priority tiers, smart defaults first, and user customization deferred to v2.",
            "takeaways": [
                "Current notification open rate is 12% — users are overwhelmed and ignoring notifications",
                "Digest model with ML-optimized send times is the proposed solution",
                "Priority system needed: critical notifications immediate, everything else batched",
                "Smart defaults first, full user preference UI deferred to v2",
                "Prototype to be built this sprint"
            ],
            "decisions": [
                {"decision": "Adopt digest notification model with priority tiers", "by": "Eve", "rationale": "Users ignoring 88% of notifications; bundling should improve signal-to-noise"},
                {"decision": "Smart defaults first, user settings in v2", "by": "Eve (agreed by Frank)", "rationale": "Reduce initial scope; settings UI is complex"},
                {"decision": "Prototype digest approach this sprint", "by": "Eve", "rationale": "Validate approach before building full feature"}
            ],
            "action_items": [
                {"task": "Build digest notification prototype", "owner": "Team", "due": "End of sprint", "completed": False},
                {"task": "Design priority classification system for notification types", "owner": "Eve", "due": None, "completed": False},
                {"task": "Research ML models for optimal notification timing", "owner": "Grace", "due": None, "completed": False}
            ],
            "open_questions": [
                "What qualifies as a 'critical' notification that bypasses the digest?",
                "How do we handle time-zone differences for optimal send times?",
                "Should digest frequency be fixed (daily) or variable based on notification volume?"
            ],
            "key_quotes": [
                {"text": "Our data shows only 12% of push notifications are opened. That's terrible.", "speaker": "Frank", "timestamp_seconds": 7},
                {"text": "The risk is that time-sensitive notifications get buried in a digest.", "speaker": "Frank", "timestamp_seconds": 29},
                {"text": "Smart defaults first, settings page in v2.", "speaker": "Eve", "timestamp_seconds": 62}
            ],
            "topics": [
                {"name": "Problem Definition", "duration_minutes": 3, "description": "Low notification engagement, 12% open rate"},
                {"name": "Digest Model", "duration_minutes": 4, "description": "Bundling notifications with ML-optimized timing"},
                {"name": "Priority System", "duration_minutes": 3, "description": "Tiering notifications into immediate vs. batchable"},
                {"name": "User Preferences", "duration_minutes": 3, "description": "Customization vs. smart defaults debate"}
            ],
            "mind_map": {
                "nodes": [
                    {"id": "root", "label": "Notification Redesign", "type": "topic"},
                    {"id": "problem", "label": "12% Open Rate", "type": "topic"},
                    {"id": "digest", "label": "Digest Model", "type": "decision"},
                    {"id": "ml-timing", "label": "ML Send Timing", "type": "subtopic"},
                    {"id": "priority", "label": "Priority Tiers", "type": "decision"},
                    {"id": "critical", "label": "Critical → Immediate", "type": "subtopic"},
                    {"id": "batch", "label": "Others → Batched", "type": "subtopic"},
                    {"id": "prefs", "label": "User Preferences", "type": "topic"},
                    {"id": "defaults", "label": "Smart Defaults (v1)", "type": "decision"},
                    {"id": "settings", "label": "Settings UI (v2)", "type": "action"},
                    {"id": "prototype", "label": "Prototype This Sprint", "type": "action"}
                ],
                "edges": [
                    {"source": "root", "target": "problem", "label": None},
                    {"source": "root", "target": "digest", "label": "proposed solution"},
                    {"source": "root", "target": "priority", "label": None},
                    {"source": "root", "target": "prefs", "label": None},
                    {"source": "digest", "target": "ml-timing", "label": None},
                    {"source": "digest", "target": "prototype", "label": None},
                    {"source": "priority", "target": "critical", "label": None},
                    {"source": "priority", "target": "batch", "label": None},
                    {"source": "prefs", "target": "defaults", "label": "v1"},
                    {"source": "prefs", "target": "settings", "label": "v2"}
                ]
            },
            "sentiment": "positive",
            "tags_suggested": ["product", "notifications", "UX", "brainstorm"]
        }
    }
]


def main():
    for sample in SAMPLES:
        rec_dir = RECORDINGS_DIR / sample["dir"]
        rec_dir.mkdir(parents=True, exist_ok=True)
        (rec_dir / "recording.json").write_text(json.dumps(sample["recording"], indent=2))

        # Write readable markdown
        rec = sample["recording"]
        md = f"# {rec['title']}\n\n**Date:** {rec['created_at'][:10]}\n**Duration:** {rec['duration']}s\n\n"
        summary = rec.get("summary", {}).get("summary", {})
        if summary.get("markdown"):
            md += f"## Summary\n{summary['markdown']}\n\n"
        md += "## Transcript\n"
        for seg in rec.get("transcript", []):
            md += f"\n**{seg['speaker']}:** {seg['text']}"
        (rec_dir / "recording.md").write_text(md)

        analysis_dir = ANALYSIS_DIR / sample["dir"]
        analysis_dir.mkdir(parents=True, exist_ok=True)
        (analysis_dir / "analysis.json").write_text(json.dumps(sample["analysis"], indent=2))

        # Write analysis markdown
        a = sample["analysis"]
        amd = f"# Analysis: {a['title']}\n\n"
        amd += f"## Overview\n{a['executive_summary']}\n\n"
        amd += "## Key Takeaways\n" + "\n".join(f"- {t}" for t in a["takeaways"]) + "\n\n"
        if a["decisions"]:
            amd += "## Decisions Made\n"
            for d in a["decisions"]:
                amd += f"- **Decision:** {d['decision']} — **By:** {d['by']} — **Rationale:** {d['rationale']}\n"
            amd += "\n"
        if a["action_items"]:
            amd += "## Action Items\n"
            for ai in a["action_items"]:
                status = "x" if ai["completed"] else " "
                owner = f" — **Owner:** {ai['owner']}" if ai["owner"] else ""
                due = f" — **Due:** {ai['due']}" if ai["due"] else ""
                amd += f"- [{status}] {ai['task']}{owner}{due}\n"
            amd += "\n"
        if a["open_questions"]:
            amd += "## Open Questions\n" + "\n".join(f"- {q}" for q in a["open_questions"]) + "\n"
        (analysis_dir / "analysis.md").write_text(amd)

    print(f"Generated {len(SAMPLES)} sample recording(s)")


if __name__ == "__main__":
    main()
