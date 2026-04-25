"""Tests for stage-people.py"""

import json
import sys
import importlib
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
loader = importlib.machinery.SourceFileLoader(
    "stage_people",
    str(Path(__file__).resolve().parent.parent / "stage-people.py"),
)
stage_people = loader.load_module()


class TestIsGeneric:
    def test_unknown(self):
        labels = stage_people.load_generic_labels()
        assert stage_people.is_generic("Unknown", labels)
        assert stage_people.is_generic("unknown", labels)

    def test_speaker_number(self):
        labels = stage_people.load_generic_labels()
        assert stage_people.is_generic("Speaker 01", labels)
        assert stage_people.is_generic("speaker 2", labels)
        assert stage_people.is_generic("Speaker12", labels)

    def test_generic_role(self):
        labels = stage_people.load_generic_labels()
        assert stage_people.is_generic("Host", labels)
        assert stage_people.is_generic("Moderator", labels)
        assert stage_people.is_generic("participant", labels)

    def test_real_name_passes(self):
        labels = stage_people.load_generic_labels()
        assert not stage_people.is_generic("Ethan", labels)
        assert not stage_people.is_generic("Norma Gonzalez", labels)
        assert not stage_people.is_generic("CK", labels)

    def test_name_with_parenthetical(self):
        labels = stage_people.load_generic_labels()
        # Names with parentheticals: base is checked, if base is a real name, passes
        assert not stage_people.is_generic("Mark (Speaker 01)", labels)
        assert not stage_people.is_generic("Alice (Moderator)", labels)
        # Even "Speaker (01)" passes because the paren-strip path returns early
        # when base != n — this is arguable but matches current behavior
        assert not stage_people.is_generic("Speaker (01)", labels)

    def test_empty(self):
        labels = stage_people.load_generic_labels()
        assert stage_people.is_generic("", labels)
        assert stage_people.is_generic("  ", labels)

    def test_custom_generic_labels(self, tmp_path):
        custom = tmp_path / "generic-speakers.txt"
        custom.write_text("doctor\nnurse\npatient\n")
        with patch.object(stage_people, "DATA_DIR", tmp_path):
            labels = stage_people.load_generic_labels()
        assert stage_people.is_generic("Doctor", labels)
        assert stage_people.is_generic("Patient", labels)
        assert not stage_people.is_generic("Ethan", labels)


class TestCanonical:
    def test_strips_parenthetical(self):
        assert stage_people.canonical("Mark (Speaker 01)") == "Mark"

    def test_no_parenthetical(self):
        assert stage_people.canonical("Ethan") == "Ethan"

    def test_preserves_non_trailing(self):
        assert stage_people.canonical("Dr. Smith") == "Dr. Smith"


class TestMain:
    def test_stages_speakers_from_analyses(self, tmp_path):
        analysis_dir = tmp_path / "analysis" / "2026-04-24_test"
        analysis_dir.mkdir(parents=True)
        (analysis_dir / "analysis.json").write_text(json.dumps({
            "speaker_map": {"0": "Ethan", "1": "Unknown", "2": "Alice", "3": "Speaker 01"},
        }))
        pending_file = tmp_path / "people-pending.json"
        people_file = tmp_path / "people.json"
        people_file.write_text(json.dumps({"people": []}))

        with patch.object(stage_people, "ANALYSIS_DIR", tmp_path / "analysis"), \
             patch.object(stage_people, "PENDING_FILE", pending_file), \
             patch.object(stage_people, "PEOPLE_FILE", people_file), \
             patch.object(stage_people, "DISMISSED_FILE", tmp_path / "dismissed.txt"), \
             patch.object(stage_people, "DATA_DIR", tmp_path):
            stage_people.main()

        data = json.loads(pending_file.read_text())
        names = [p["name"] for p in data["pending"]]
        assert "Ethan" in names
        assert "Alice" in names
        assert "Unknown" not in names
        assert "Speaker 01" not in names

    def test_skips_existing_people(self, tmp_path):
        analysis_dir = tmp_path / "analysis" / "rec1"
        analysis_dir.mkdir(parents=True)
        (analysis_dir / "analysis.json").write_text(json.dumps({
            "speaker_map": {"0": "Ethan", "1": "Alice"},
        }))
        people_file = tmp_path / "people.json"
        people_file.write_text(json.dumps({"people": [
            {"name": "Ethan", "source": "manual", "createdAt": "2026-01-01T00:00:00Z"},
        ]}))
        pending_file = tmp_path / "people-pending.json"

        with patch.object(stage_people, "ANALYSIS_DIR", tmp_path / "analysis"), \
             patch.object(stage_people, "PENDING_FILE", pending_file), \
             patch.object(stage_people, "PEOPLE_FILE", people_file), \
             patch.object(stage_people, "DISMISSED_FILE", tmp_path / "dismissed.txt"), \
             patch.object(stage_people, "DATA_DIR", tmp_path):
            stage_people.main()

        data = json.loads(pending_file.read_text())
        names = [p["name"] for p in data["pending"]]
        assert "Ethan" not in names  # already exists
        assert "Alice" in names

    def test_skips_dismissed(self, tmp_path):
        analysis_dir = tmp_path / "analysis" / "rec1"
        analysis_dir.mkdir(parents=True)
        (analysis_dir / "analysis.json").write_text(json.dumps({
            "speaker_map": {"0": "Manager Bob", "1": "Alice"},
        }))
        people_file = tmp_path / "people.json"
        people_file.write_text(json.dumps({"people": []}))
        pending_file = tmp_path / "people-pending.json"
        dismissed_file = tmp_path / "dismissed.txt"
        dismissed_file.write_text("manager bob\n")

        with patch.object(stage_people, "ANALYSIS_DIR", tmp_path / "analysis"), \
             patch.object(stage_people, "PENDING_FILE", pending_file), \
             patch.object(stage_people, "PEOPLE_FILE", people_file), \
             patch.object(stage_people, "DISMISSED_FILE", dismissed_file), \
             patch.object(stage_people, "DATA_DIR", tmp_path):
            stage_people.main()

        data = json.loads(pending_file.read_text())
        names = [p["name"] for p in data["pending"]]
        assert "Manager Bob" not in names
        assert "Alice" in names

    def test_skips_already_pending(self, tmp_path):
        analysis_dir = tmp_path / "analysis" / "rec1"
        analysis_dir.mkdir(parents=True)
        (analysis_dir / "analysis.json").write_text(json.dumps({
            "speaker_map": {"0": "Ethan", "1": "Alice"},
        }))
        people_file = tmp_path / "people.json"
        people_file.write_text(json.dumps({"people": []}))
        pending_file = tmp_path / "people-pending.json"
        pending_file.write_text(json.dumps({"pending": [
            {"id": "x", "name": "Ethan", "seenIn": [], "count": 1, "suggestedMatch": None, "createdAt": ""},
        ]}))

        with patch.object(stage_people, "ANALYSIS_DIR", tmp_path / "analysis"), \
             patch.object(stage_people, "PENDING_FILE", pending_file), \
             patch.object(stage_people, "PEOPLE_FILE", people_file), \
             patch.object(stage_people, "DISMISSED_FILE", tmp_path / "dismissed.txt"), \
             patch.object(stage_people, "DATA_DIR", tmp_path):
            stage_people.main()

        data = json.loads(pending_file.read_text())
        ethans = [p for p in data["pending"] if p["name"] == "Ethan"]
        assert len(ethans) == 1  # not duplicated

    def test_picks_most_frequent_variant(self, tmp_path):
        # Same canonical name with parenthetical variations
        for i, name in enumerate(["Mark", "Mark (Speaker 01)", "Mark"]):
            d = tmp_path / "analysis" / f"rec{i}"
            d.mkdir(parents=True)
            (d / "analysis.json").write_text(json.dumps({
                "speaker_map": {"0": name},
            }))
        people_file = tmp_path / "people.json"
        people_file.write_text(json.dumps({"people": []}))
        pending_file = tmp_path / "people-pending.json"

        with patch.object(stage_people, "ANALYSIS_DIR", tmp_path / "analysis"), \
             patch.object(stage_people, "PENDING_FILE", pending_file), \
             patch.object(stage_people, "PEOPLE_FILE", people_file), \
             patch.object(stage_people, "DISMISSED_FILE", tmp_path / "dismissed.txt"), \
             patch.object(stage_people, "DATA_DIR", tmp_path):
            stage_people.main()

        data = json.loads(pending_file.read_text())
        # "Mark" and "Mark (Speaker 01)" share canonical key "Mark"
        # "Mark" appears 2x, so it wins
        marks = [p for p in data["pending"] if "Mark" in p["name"]]
        assert len(marks) == 1
        assert marks[0]["name"] == "Mark"

    def test_skips_people_aliases(self, tmp_path):
        analysis_dir = tmp_path / "analysis" / "rec1"
        analysis_dir.mkdir(parents=True)
        (analysis_dir / "analysis.json").write_text(json.dumps({
            "speaker_map": {"0": "Joaquin"},
        }))
        people_file = tmp_path / "people.json"
        people_file.write_text(json.dumps({"people": [
            {"name": "Yoaquim", "aliases": ["Joaquin"], "source": "manual", "createdAt": ""},
        ]}))
        pending_file = tmp_path / "people-pending.json"

        with patch.object(stage_people, "ANALYSIS_DIR", tmp_path / "analysis"), \
             patch.object(stage_people, "PENDING_FILE", pending_file), \
             patch.object(stage_people, "PEOPLE_FILE", people_file), \
             patch.object(stage_people, "DISMISSED_FILE", tmp_path / "dismissed.txt"), \
             patch.object(stage_people, "DATA_DIR", tmp_path):
            stage_people.main()

        data = json.loads(pending_file.read_text())
        assert len(data["pending"]) == 0  # Joaquin is an alias of Yoaquim
