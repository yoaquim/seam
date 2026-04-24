#!/usr/bin/env python3
"""
Seam — Pocket AI pull script.
Pulls new recordings from the Pocket API since last sync,
writes structured JSON + markdown to .seam/recordings/.
"""

import json
import os
import sys
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / ".seam"
RECORDINGS_DIR = DATA_DIR / "recordings"
SYNC_FILE = ROOT / ".pocket-last-sync"
DELETED_FILE = DATA_DIR / ".deleted"

BASE_URL = "https://public.heypocketai.com/api/v1"


def read_deleted() -> set[str]:
    """Read the set of deleted recording dir names."""
    if DELETED_FILE.exists():
        return set(DELETED_FILE.read_text().strip().splitlines())
    return set()


def get_api_key() -> str:
    key = os.environ.get("POCKET_API_KEY", "")
    if not key:
        env_file = ROOT / ".env"
        if env_file.exists():
            for line in env_file.read_text().splitlines():
                line = line.strip()
                if line.startswith("POCKET_API_KEY="):
                    key = line.split("=", 1)[1].strip().strip("'\"")
                    break
    if not key:
        print("ERROR: POCKET_API_KEY not set. Add it to .env or export it.", file=sys.stderr)
        sys.exit(1)
    return key


def api_get(path: str, api_key: str, params: dict | None = None) -> dict:
    url = f"{BASE_URL}{path}"
    if params:
        query = "&".join(f"{k}={v}" for k, v in params.items() if v is not None)
        if query:
            url += f"?{query}"
    req = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json",
    })
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())


def api_post(path: str, api_key: str, body: dict) -> dict:
    url = f"{BASE_URL}{path}"
    data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, method="POST", headers={
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    })
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())


def get_last_sync() -> str | None:
    if SYNC_FILE.exists():
        ts = SYNC_FILE.read_text().strip()
        return ts if ts else None
    return None


def set_last_sync(ts: str):
    SYNC_FILE.write_text(ts + "\n")


def list_recordings(api_key: str, start_date: str | None = None) -> list[dict]:
    """Fetch all recordings since start_date, handling pagination."""
    all_recordings = []
    page = 1
    while True:
        params = {"page": str(page), "limit": "100"}
        if start_date:
            params["start_date"] = start_date
        resp = api_get("/public/recordings", api_key, params)
        data = resp.get("data")
        if data:
            if isinstance(data, list):
                all_recordings.extend(data)
            elif isinstance(data, dict) and "recordings" in data:
                all_recordings.extend(data["recordings"])
            else:
                all_recordings.append(data)

        pagination = resp.get("pagination", {})
        if not pagination.get("has_more", False):
            break
        page += 1
    return all_recordings


def get_recording_details(api_key: str, recording_id: str) -> dict:
    """Fetch full recording details including transcript and summarizations."""
    params = {
        "include_transcript": "true",
        "include_summarizations": "true",
    }
    resp = api_get(f"/public/recordings/{recording_id}", api_key, params)
    return resp.get("data", resp)


def slugify(text: str) -> str:
    slug = text.lower().strip()
    slug = "".join(c if c.isalnum() or c in (" ", "-") else "" for c in slug)
    slug = "-".join(slug.split())
    return slug[:80] if slug else "untitled"


def extract_transcript_text(transcript: list[dict]) -> str:
    """Format transcript segments into readable text."""
    lines = []
    current_speaker = None
    for seg in transcript:
        speaker = seg.get("speaker", "Unknown")
        text = seg.get("text", "").strip()
        if not text:
            continue
        if speaker != current_speaker:
            current_speaker = speaker
            lines.append(f"\n**{speaker}:**")
        lines.append(text)
    return "\n".join(lines).strip()


def extract_summary(summarizations: dict) -> dict:
    """Extract the best summary from summarizations object."""
    if not summarizations:
        return {}

    # summarizations is keyed by summarization ID
    items = summarizations if isinstance(summarizations, dict) else {}
    if isinstance(summarizations, list):
        items = {str(i): s for i, s in enumerate(summarizations)}

    best = None
    for _sid, sdata in items.items():
        if isinstance(sdata, dict):
            best = sdata
            break

    if not best:
        return {}

    v2 = best.get("v2", {})
    return {
        "summary": v2.get("summary", {}),
        "action_items": v2.get("actionItems", {}),
        "mind_map": v2.get("mindMap", {}),
        "speaker_mind_map": v2.get("speakerMindMap"),
        "context_mind_map": v2.get("contextMindMap"),
        "flow_mind_map": v2.get("flowMindMap"),
        "settings": best.get("settings", {}),
        "processing_status": best.get("processingStatus", "unknown"),
        "created_at": best.get("createdAt", ""),
    }


def write_recording(recording: dict, details: dict, deleted: set[str] | None = None):
    """Write recording data as structured JSON and human-readable markdown."""
    rec_id = recording.get("id") or details.get("id") or "unknown"
    title = recording.get("title") or details.get("title") or "Untitled"
    # Prefer recording_at (when recorded) over created_at (when processed)
    recorded = recording.get("recording_at") or details.get("recording_at") or \
        recording.get("recordingAt") or details.get("recordingAt")
    created = recording.get("createdAt") or details.get("createdAt") or \
        recording.get("created_at") or details.get("created_at") or \
        datetime.now(timezone.utc).isoformat()
    primary_date = recorded or created
    date_str = primary_date[:10]
    slug = slugify(title)
    dir_name = f"{date_str}_{slug}"

    # Skip if previously deleted
    if deleted and dir_name in deleted:
        print(f"  Skipping {dir_name} (previously deleted)")
        return None

    rec_dir = RECORDINGS_DIR / dir_name
    rec_dir.mkdir(parents=True, exist_ok=True)

    # Extract structured data
    transcript_raw = details.get("transcript") or details.get("transcriptSegments") or []
    if isinstance(transcript_raw, dict):
        transcript_raw = transcript_raw.get("segments", [])
    summarizations = details.get("summarizations") or details.get("summarization") or {}
    summary_data = extract_summary(summarizations)

    # Write raw JSON (complete API response)
    raw_data = {
        "id": rec_id,
        "title": title,
        "description": recording.get("description") or details.get("description", ""),
        "duration": recording.get("duration") or details.get("duration"),
        "language": recording.get("language") or details.get("language"),
        "recording_at": recorded,
        "created_at": created,
        "tags": recording.get("tags") or details.get("tags") or [],
        "transcript": transcript_raw,
        "summary": summary_data,
    }
    (rec_dir / "recording.json").write_text(json.dumps(raw_data, indent=2, default=str))

    # Write human-readable markdown
    transcript_text = extract_transcript_text(transcript_raw)
    summary_info = summary_data.get("summary", {})

    md_lines = [
        f"# {title}",
        "",
        f"**Date:** {date_str}",
        f"**Duration:** {raw_data.get('duration', 'N/A')}s",
        f"**ID:** {rec_id}",
    ]

    tags = raw_data.get("tags", [])
    if tags:
        tag_names = [t.get("name", t) if isinstance(t, dict) else str(t) for t in tags]
        md_lines.append(f"**Tags:** {', '.join(tag_names)}")

    md_lines.append("")

    # Pocket's summary
    if summary_info:
        md_lines.append("## Summary")
        if summary_info.get("title"):
            emoji = summary_info.get("emoji", "")
            md_lines.append(f"### {emoji} {summary_info['title']}")
        if summary_info.get("markdown"):
            md_lines.append(summary_info["markdown"])
        elif summary_info.get("bulletPoints"):
            for bp in summary_info["bulletPoints"]:
                md_lines.append(f"- {bp}")
        md_lines.append("")

    # Action items
    action_items_data = summary_data.get("action_items", {})
    action_items = action_items_data.get("actionItems", []) if isinstance(action_items_data, dict) else []
    if action_items:
        md_lines.append("## Action Items")
        for item in action_items:
            status = "x" if item.get("isCompleted") or item.get("is_completed") else " "
            title_text = item.get("title", "")
            due = item.get("dueDate", "")
            due_str = f" (due: {due})" if due else ""
            md_lines.append(f"- [{status}] {title_text}{due_str}")
        md_lines.append("")

    # Transcript
    if transcript_text:
        md_lines.append("## Transcript")
        md_lines.append(transcript_text)
        md_lines.append("")

    (rec_dir / "recording.md").write_text("\n".join(md_lines))

    print(f"  -> {dir_name}/")
    return dir_name


def main():
    api_key = get_api_key()
    last_sync = get_last_sync()

    print(f"Seam: pulling recordings from Pocket API")
    if last_sync:
        print(f"  Last sync: {last_sync}")
    else:
        print(f"  First sync (pulling all recordings)")

    # List recordings since last sync
    start_date = last_sync[:10] if last_sync else None
    recordings = list_recordings(api_key, start_date)

    if not recordings:
        print("  No new recordings found.")
        set_last_sync(datetime.now(timezone.utc).isoformat())
        return

    print(f"  Found {len(recordings)} recording(s)")

    # Fetch details and write each recording
    deleted = read_deleted()
    new_dirs = []
    for rec in recordings:
        rec_id = rec.get("id")
        if not rec_id:
            continue
        title = rec.get("title", "Untitled")
        print(f"  Fetching: {title}...")
        try:
            details = get_recording_details(api_key, rec_id)
            dir_name = write_recording(rec, details, deleted)
            if dir_name is None:
                continue
            new_dirs.append(dir_name)
        except urllib.error.HTTPError as e:
            print(f"    ERROR fetching {rec_id}: {e}", file=sys.stderr)
            continue

    # Update sync timestamp
    now = datetime.now(timezone.utc).isoformat()
    set_last_sync(now)

    print(f"\nDone. Pulled {len(new_dirs)} recording(s).")
    print(f"Sync timestamp: {now}")

    # Write list of new dirs to stdout for the orchestration script
    if new_dirs:
        manifest = DATA_DIR / ".last-pull-manifest"
        manifest.write_text("\n".join(new_dirs) + "\n")


if __name__ == "__main__":
    main()
