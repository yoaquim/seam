"""Tests for pocket_pull.py"""

import json
import os
import sys
import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock
from http.client import HTTPResponse
from io import BytesIO

# Add scripts dir to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import pocket_pull


def make_response(data: dict, status: int = 200) -> MagicMock:
    """Create a mock urllib response."""
    body = json.dumps(data).encode()
    mock = MagicMock()
    mock.read.return_value = body
    mock.__enter__ = lambda s: s
    mock.__exit__ = MagicMock(return_value=False)
    return mock


class TestSlugify:
    def test_basic(self):
        assert pocket_pull.slugify("Weekly Standup") == "weekly-standup"

    def test_special_chars(self):
        assert pocket_pull.slugify("Meeting: Q2 Review!") == "meeting-q2-review"

    def test_empty(self):
        assert pocket_pull.slugify("") == "untitled"

    def test_long_string(self):
        result = pocket_pull.slugify("a" * 100)
        assert len(result) <= 80


class TestExtractTranscriptText:
    def test_basic(self):
        segments = [
            {"speaker": "Alice", "text": "Hello.", "start": 0, "end": 1},
            {"speaker": "Alice", "text": "How are you?", "start": 1, "end": 3},
            {"speaker": "Bob", "text": "Good!", "start": 3, "end": 4},
        ]
        result = pocket_pull.extract_transcript_text(segments)
        assert "**Alice:**" in result
        assert "**Bob:**" in result
        assert "Hello." in result
        assert "Good!" in result

    def test_empty(self):
        assert pocket_pull.extract_transcript_text([]) == ""

    def test_empty_text_segments(self):
        segments = [
            {"speaker": "Alice", "text": "", "start": 0, "end": 1},
            {"speaker": "Alice", "text": "   ", "start": 1, "end": 2},
        ]
        result = pocket_pull.extract_transcript_text(segments)
        assert result == ""


class TestExtractSummary:
    def test_basic_v2_summary(self):
        summarizations = {
            "sum_1": {
                "id": "row_1",
                "processingStatus": "completed",
                "v2": {
                    "summary": {
                        "title": "Test Summary",
                        "emoji": "📝",
                        "markdown": "A test summary.",
                        "bulletPoints": ["Point 1"],
                    },
                    "actionItems": {
                        "actionItems": [
                            {"id": "ai_1", "title": "Do thing", "isCompleted": False}
                        ]
                    },
                    "mindMap": {"nodes": [{"id": "1", "label": "Root"}], "edges": []},
                },
            }
        }
        result = pocket_pull.extract_summary(summarizations)
        assert result["summary"]["title"] == "Test Summary"
        assert result["action_items"]["actionItems"][0]["title"] == "Do thing"
        assert len(result["mind_map"]["nodes"]) == 1

    def test_empty(self):
        assert pocket_pull.extract_summary({}) == {}
        assert pocket_pull.extract_summary(None) == {}


class TestGetLastSync:
    def test_no_file(self):
        with patch.object(pocket_pull, "SYNC_FILE", Path("/nonexistent/.pocket-last-sync")):
            assert pocket_pull.get_last_sync() is None

    def test_with_file(self, tmp_path):
        sync_file = tmp_path / ".pocket-last-sync"
        sync_file.write_text("2026-04-22T00:00:00Z\n")
        with patch.object(pocket_pull, "SYNC_FILE", sync_file):
            assert pocket_pull.get_last_sync() == "2026-04-22T00:00:00Z"

    def test_empty_file(self, tmp_path):
        sync_file = tmp_path / ".pocket-last-sync"
        sync_file.write_text("")
        with patch.object(pocket_pull, "SYNC_FILE", sync_file):
            assert pocket_pull.get_last_sync() is None


class TestSetLastSync:
    def test_writes_timestamp(self, tmp_path):
        sync_file = tmp_path / ".pocket-last-sync"
        with patch.object(pocket_pull, "SYNC_FILE", sync_file):
            pocket_pull.set_last_sync("2026-04-22T12:00:00Z")
        assert sync_file.read_text().strip() == "2026-04-22T12:00:00Z"


class TestWriteRecording:
    def test_writes_json_and_markdown(self, tmp_path):
        recordings_dir = tmp_path / "recordings"
        recordings_dir.mkdir()

        recording = {
            "id": "rec_001",
            "title": "Test Meeting",
            "createdAt": "2026-04-22T09:00:00Z",
            "duration": 120,
            "language": "en",
            "tags": [{"name": "test"}],
        }
        details = {
            "transcript": [
                {"speaker": "Alice", "text": "Hello", "start": 0, "end": 2},
            ],
            "summarizations": {
                "sum_1": {
                    "v2": {
                        "summary": {"title": "Test", "markdown": "A test."},
                        "actionItems": {"actionItems": []},
                        "mindMap": {"nodes": [], "edges": []},
                    },
                    "processingStatus": "completed",
                }
            },
        }

        with patch.object(pocket_pull, "RECORDINGS_DIR", recordings_dir):
            dir_name = pocket_pull.write_recording(recording, details)

        assert dir_name == "2026-04-22_test-meeting"
        rec_dir = recordings_dir / dir_name
        assert (rec_dir / "recording.json").exists()
        assert (rec_dir / "recording.md").exists()

        data = json.loads((rec_dir / "recording.json").read_text())
        assert data["id"] == "rec_001"
        assert data["title"] == "Test Meeting"
        assert len(data["transcript"]) == 1

        md = (rec_dir / "recording.md").read_text()
        assert "# Test Meeting" in md
        assert "**Alice:**" in md


class TestListRecordings:
    @patch("pocket_pull.api_get")
    def test_single_page(self, mock_get):
        mock_get.return_value = {
            "data": [{"id": "rec_001", "title": "Test"}],
            "pagination": {"has_more": False},
        }

        result = pocket_pull.list_recordings("pk_test")
        assert len(result) == 1
        assert result[0]["id"] == "rec_001"

    @patch("pocket_pull.api_get")
    def test_pagination(self, mock_get):
        mock_get.side_effect = [
            {
                "data": [{"id": "rec_001"}],
                "pagination": {"has_more": True},
            },
            {
                "data": [{"id": "rec_002"}],
                "pagination": {"has_more": False},
            },
        ]

        result = pocket_pull.list_recordings("pk_test")
        assert len(result) == 2

    @patch("pocket_pull.api_get")
    def test_empty_response(self, mock_get):
        mock_get.return_value = {"data": None, "pagination": {"has_more": False}}

        result = pocket_pull.list_recordings("pk_test")
        assert len(result) == 0


class TestGetApiKey:
    def test_from_env(self):
        with patch.dict(os.environ, {"POCKET_API_KEY": "pk_test123"}):
            assert pocket_pull.get_api_key() == "pk_test123"

    def test_from_dotenv(self, tmp_path):
        env_file = tmp_path / ".env"
        env_file.write_text("POCKET_API_KEY=pk_from_file\n")
        with patch.dict(os.environ, {}, clear=True):
            with patch.object(pocket_pull, "ROOT", tmp_path):
                assert pocket_pull.get_api_key() == "pk_from_file"

    def test_missing_exits(self):
        with patch.dict(os.environ, {}, clear=True):
            with patch.object(pocket_pull, "ROOT", Path("/nonexistent")):
                with pytest.raises(SystemExit):
                    pocket_pull.get_api_key()


# Need pytest for the SystemExit test
import pytest
import urllib.error


def make_http_error(code: int, retry_after: str | None = None) -> urllib.error.HTTPError:
    headers = {}
    if retry_after is not None:
        headers["Retry-After"] = retry_after
    return urllib.error.HTTPError(
        url="http://test/x", code=code, msg=f"HTTP {code}", hdrs=headers, fp=None
    )


class TestRequestWithRetry:
    def test_succeeds_first_try(self):
        with patch("pocket_pull.urllib.request.urlopen") as mock_open, \
             patch("pocket_pull.time.sleep") as mock_sleep:
            mock_open.return_value = make_response({"ok": True})
            req = MagicMock()
            req.full_url = "http://test/x"
            result = pocket_pull._request_with_retry(req)
            assert result == {"ok": True}
            assert mock_open.call_count == 1
            mock_sleep.assert_not_called()

    def test_retries_on_429_then_succeeds(self):
        with patch("pocket_pull.urllib.request.urlopen") as mock_open, \
             patch("pocket_pull.time.sleep") as mock_sleep:
            mock_open.side_effect = [
                make_http_error(429, retry_after="1"),
                make_http_error(429, retry_after="1"),
                make_response({"ok": True}),
            ]
            req = MagicMock()
            req.full_url = "http://test/x"
            result = pocket_pull._request_with_retry(req)
            assert result == {"ok": True}
            assert mock_open.call_count == 3
            assert mock_sleep.call_count == 2

    def test_retries_on_503(self):
        with patch("pocket_pull.urllib.request.urlopen") as mock_open, \
             patch("pocket_pull.time.sleep"):
            mock_open.side_effect = [
                make_http_error(503),
                make_response({"ok": True}),
            ]
            req = MagicMock()
            req.full_url = "http://test/x"
            assert pocket_pull._request_with_retry(req) == {"ok": True}
            assert mock_open.call_count == 2

    def test_does_not_retry_on_404(self):
        with patch("pocket_pull.urllib.request.urlopen") as mock_open, \
             patch("pocket_pull.time.sleep") as mock_sleep:
            mock_open.side_effect = [make_http_error(404)]
            req = MagicMock()
            req.full_url = "http://test/x"
            with pytest.raises(urllib.error.HTTPError) as exc:
                pocket_pull._request_with_retry(req)
            assert exc.value.code == 404
            assert mock_open.call_count == 1
            mock_sleep.assert_not_called()

    def test_raises_after_max_retries(self):
        with patch("pocket_pull.urllib.request.urlopen") as mock_open, \
             patch("pocket_pull.time.sleep"):
            mock_open.side_effect = [make_http_error(429) for _ in range(pocket_pull.MAX_RETRIES)]
            req = MagicMock()
            req.full_url = "http://test/x"
            with pytest.raises(urllib.error.HTTPError) as exc:
                pocket_pull._request_with_retry(req)
            assert exc.value.code == 429
            assert mock_open.call_count == pocket_pull.MAX_RETRIES

    def test_honors_retry_after_header(self):
        with patch("pocket_pull.urllib.request.urlopen") as mock_open, \
             patch("pocket_pull.time.sleep") as mock_sleep:
            mock_open.side_effect = [
                make_http_error(429, retry_after="7"),
                make_response({"ok": True}),
            ]
            req = MagicMock()
            req.full_url = "http://test/x"
            pocket_pull._request_with_retry(req)
            mock_sleep.assert_called_once_with(7.0)


class TestPendingFetch:
    def test_read_missing_returns_empty(self, tmp_path):
        with patch.object(pocket_pull, "PENDING_FETCH_FILE", tmp_path / ".pending-fetch"):
            assert pocket_pull.read_pending_fetch() == []

    def test_round_trip(self, tmp_path):
        path = tmp_path / ".pending-fetch"
        with patch.object(pocket_pull, "PENDING_FETCH_FILE", path):
            pocket_pull.write_pending_fetch(["a", "b", "c"])
            assert pocket_pull.read_pending_fetch() == ["a", "b", "c"]

    def test_write_empty_removes_file(self, tmp_path):
        path = tmp_path / ".pending-fetch"
        path.write_text("a\nb\n")
        with patch.object(pocket_pull, "PENDING_FETCH_FILE", path):
            pocket_pull.write_pending_fetch([])
            assert not path.exists()

    def test_read_skips_blank_lines(self, tmp_path):
        path = tmp_path / ".pending-fetch"
        path.write_text("a\n\nb\n  \n")
        with patch.object(pocket_pull, "PENDING_FETCH_FILE", path):
            assert pocket_pull.read_pending_fetch() == ["a", "b"]
