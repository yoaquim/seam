"""Tests for build-manifest.py"""

import json
import sys
import importlib
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
# build-manifest.py has a hyphen, so use importlib
loader = importlib.machinery.SourceFileLoader(
    "build_manifest",
    str(Path(__file__).resolve().parent.parent / "build-manifest.py"),
)
build_manifest = loader.load_module()


class TestBuildManifest:
    def test_empty_recordings(self, tmp_path):
        recordings_dir = tmp_path / "data" / "recordings"
        recordings_dir.mkdir(parents=True)
        analysis_dir = tmp_path / "data" / "analysis"
        analysis_dir.mkdir(parents=True)
        output = tmp_path / "public" / "manifest.json"

        with patch.object(build_manifest, "RECORDINGS_DIR", recordings_dir), \
             patch.object(build_manifest, "ANALYSIS_DIR", analysis_dir), \
             patch.object(build_manifest, "OUTPUT", output):
            build_manifest.main()

        data = json.loads(output.read_text())
        assert data["recordings"] == []

    def test_recording_without_analysis(self, tmp_path):
        recordings_dir = tmp_path / "data" / "recordings"
        rec_dir = recordings_dir / "2026-04-22_test"
        rec_dir.mkdir(parents=True)
        (rec_dir / "recording.json").write_text(json.dumps({
            "id": "rec_001",
            "title": "Test",
            "created_at": "2026-04-22T09:00:00Z",
        }))
        (rec_dir / "recording.md").write_text("# Test")

        analysis_dir = tmp_path / "data" / "analysis"
        analysis_dir.mkdir(parents=True)
        output = tmp_path / "public" / "manifest.json"

        with patch.object(build_manifest, "RECORDINGS_DIR", recordings_dir), \
             patch.object(build_manifest, "ANALYSIS_DIR", analysis_dir), \
             patch.object(build_manifest, "OUTPUT", output):
            build_manifest.main()

        data = json.loads(output.read_text())
        assert len(data["recordings"]) == 1
        assert data["recordings"][0]["dirName"] == "2026-04-22_test"
        assert data["recordings"][0]["analysis"] is None
        assert data["recordings"][0]["markdown"] == "# Test"

    def test_recording_with_analysis(self, tmp_path):
        recordings_dir = tmp_path / "data" / "recordings"
        rec_dir = recordings_dir / "2026-04-22_test"
        rec_dir.mkdir(parents=True)
        (rec_dir / "recording.json").write_text(json.dumps({
            "id": "rec_001",
            "title": "Test",
            "created_at": "2026-04-22T09:00:00Z",
        }))
        (rec_dir / "recording.md").write_text("# Test")

        analysis_dir = tmp_path / "data" / "analysis"
        a_dir = analysis_dir / "2026-04-22_test"
        a_dir.mkdir(parents=True)
        analysis_data = {"executive_summary": "A test", "takeaways": []}
        (a_dir / "analysis.json").write_text(json.dumps(analysis_data))
        (a_dir / "analysis.md").write_text("# Analysis")

        output = tmp_path / "public" / "manifest.json"

        with patch.object(build_manifest, "RECORDINGS_DIR", recordings_dir), \
             patch.object(build_manifest, "ANALYSIS_DIR", analysis_dir), \
             patch.object(build_manifest, "OUTPUT", output):
            build_manifest.main()

        data = json.loads(output.read_text())
        assert data["recordings"][0]["analysis"]["executive_summary"] == "A test"
        assert data["recordings"][0]["analysisMarkdown"] == "# Analysis"

    def test_sorted_newest_first(self, tmp_path):
        recordings_dir = tmp_path / "data" / "recordings"
        for name, created in [
            ("2026-04-20_old", "2026-04-20T00:00:00Z"),
            ("2026-04-22_new", "2026-04-22T00:00:00Z"),
            ("2026-04-21_mid", "2026-04-21T00:00:00Z"),
        ]:
            d = recordings_dir / name
            d.mkdir(parents=True)
            (d / "recording.json").write_text(json.dumps({
                "id": name, "title": name, "created_at": created,
            }))

        analysis_dir = tmp_path / "data" / "analysis"
        analysis_dir.mkdir(parents=True)
        output = tmp_path / "public" / "manifest.json"

        with patch.object(build_manifest, "RECORDINGS_DIR", recordings_dir), \
             patch.object(build_manifest, "ANALYSIS_DIR", analysis_dir), \
             patch.object(build_manifest, "OUTPUT", output):
            build_manifest.main()

        data = json.loads(output.read_text())
        titles = [r["dirName"] for r in data["recordings"]]
        assert titles == ["2026-04-22_new", "2026-04-21_mid", "2026-04-20_old"]

    def test_skips_hidden_dirs(self, tmp_path):
        recordings_dir = tmp_path / "data" / "recordings"
        recordings_dir.mkdir(parents=True)
        (recordings_dir / ".gitkeep").touch()
        hidden = recordings_dir / ".hidden"
        hidden.mkdir()
        (hidden / "recording.json").write_text("{}")

        analysis_dir = tmp_path / "data" / "analysis"
        analysis_dir.mkdir(parents=True)
        output = tmp_path / "public" / "manifest.json"

        with patch.object(build_manifest, "RECORDINGS_DIR", recordings_dir), \
             patch.object(build_manifest, "ANALYSIS_DIR", analysis_dir), \
             patch.object(build_manifest, "OUTPUT", output):
            build_manifest.main()

        data = json.loads(output.read_text())
        assert data["recordings"] == []
