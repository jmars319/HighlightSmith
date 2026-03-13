from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from highlightsmith_analyzer.contracts import Settings
from highlightsmith_analyzer.pipeline.orchestrator import analyze_media
from highlightsmith_analyzer.storage.session_store import SessionStore


class AnalyzerScaffoldTests(unittest.TestCase):
    def test_mock_pipeline_generates_candidates(self) -> None:
        session = analyze_media(None, settings=Settings(use_mock_data=True))
        self.assertGreaterEqual(len(session.candidates), 4)
        self.assertTrue(any(candidate.confidence_band.value == "HIGH" for candidate in session.candidates))

    def test_session_store_persists_candidates(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            database_path = str(Path(temp_dir) / "highlightsmith.sqlite3")
            store = SessionStore(database_path)
            store.initialize()
            session = analyze_media(None, settings=Settings(use_mock_data=True))
            store.save_session(session)
            self.assertEqual(store.count_candidates(session.id), len(session.candidates))


if __name__ == "__main__":
    unittest.main()
