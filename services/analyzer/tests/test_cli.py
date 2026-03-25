from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from highlightsmith_analyzer.contracts import (
    AnalysisCoverage,
    AnalysisCoverageBand,
    Settings,
)
from highlightsmith_analyzer.mock_data import (
    build_mock_candidates,
    build_mock_feature_windows,
    build_mock_speech_regions,
)
from highlightsmith_analyzer.pipeline.scoring import apply_review_post_filter
from highlightsmith_analyzer.pipeline.orchestrator import analyze_media
from highlightsmith_analyzer.service import (
    analyze_request,
    apply_review_update,
    list_session_summaries_request,
    load_session_request,
)
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

    def test_real_file_request_generates_candidates_and_persists_session(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            media_path = Path(temp_dir) / "backlog-pass-01.mp4"
            media_path.write_bytes(b"not-a-real-video-but-a-real-local-path")
            database_path = str(Path(temp_dir) / "highlightsmith.sqlite3")

            session = analyze_request(
                str(media_path),
                profile_id="generic",
                session_title="Backlog pass 01",
                persist=True,
                database_path=database_path,
            )

            self.assertEqual(session.title, "Backlog pass 01")
            self.assertEqual(
                Path(session.media_source.path).resolve(),
                media_path.resolve(),
            )
            self.assertGreaterEqual(len(session.candidates), 3)
            self.assertTrue(
                any(
                    "heuristics" in note.lower() or "ffprobe" in note.lower()
                    for note in session.media_source.ingest_notes
                )
            )
            self.assertEqual(session.analysis_coverage.band.value, "PARTIAL")
            self.assertIn(
                "SEEDED_TRANSCRIPT",
                [flag.value for flag in session.analysis_coverage.flags],
            )
            self.assertTrue(any(candidate.review_tags for candidate in session.candidates))
            self.assertEqual(
                len(session.candidates),
                len({candidate.id for candidate in session.candidates}),
            )
            store = SessionStore(database_path)
            self.assertEqual(store.count_candidates(session.id), len(session.candidates))

    def test_partial_coverage_demotes_weaker_candidates_without_hiding_them(self) -> None:
        candidates = build_mock_candidates()
        weakest_candidate = candidates[-1]
        original_score = weakest_candidate.score_estimate

        reviewed_candidates = apply_review_post_filter(
            candidates,
            build_mock_feature_windows(),
            build_mock_speech_regions(),
            AnalysisCoverage(
                band=AnalysisCoverageBand.PARTIAL,
                note="Partial coverage",
                flags=[],
            ),
        )

        reviewed_weakest = next(
            candidate for candidate in reviewed_candidates if candidate.id == weakest_candidate.id
        )
        self.assertEqual(len(reviewed_candidates), len(candidates))
        self.assertLess(reviewed_weakest.score_estimate, original_score)
        self.assertIn(
            "LOW_INFORMATION_RISK",
            [tag.value for tag in reviewed_weakest.review_tags],
        )

    def test_same_basename_sources_persist_as_distinct_sessions(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            database_path = str(Path(temp_dir) / "highlightsmith.sqlite3")
            media_dir_a = Path(temp_dir) / "creator-a"
            media_dir_b = Path(temp_dir) / "creator-b"
            media_dir_a.mkdir()
            media_dir_b.mkdir()

            media_path_a = media_dir_a / "raid-night.mp4"
            media_path_b = media_dir_b / "raid-night.mp4"
            media_path_a.write_bytes(b"creator-a-fixture")
            media_path_b.write_bytes(b"creator-b-fixture")

            session_a = analyze_request(
                str(media_path_a),
                session_title="Creator A",
                persist=True,
                database_path=database_path,
            )
            session_b = analyze_request(
                str(media_path_b),
                session_title="Creator B",
                persist=True,
                database_path=database_path,
            )

            self.assertNotEqual(session_a.media_source.id, session_b.media_source.id)
            self.assertNotEqual(session_a.id, session_b.id)
            self.assertTrue(
                all(candidate.id.startswith(session_a.media_source.id) for candidate in session_a.candidates)
            )
            self.assertTrue(
                all(candidate.id.startswith(session_b.media_source.id) for candidate in session_b.candidates)
            )

            store = SessionStore(database_path)
            self.assertEqual(store.count_candidates(session_a.id), len(session_a.candidates))
            self.assertEqual(store.count_candidates(session_b.id), len(session_b.candidates))

    def test_review_updates_persist_and_reload_from_sqlite(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            media_path = Path(temp_dir) / "review-pass-01.mp4"
            media_path.write_bytes(b"review-persistence-fixture")
            database_path = str(Path(temp_dir) / "highlightsmith.sqlite3")

            session = analyze_request(
                str(media_path),
                session_title="Review Persistence",
                persist=True,
                database_path=database_path,
            )
            candidate = session.candidates[0]
            adjusted_start = candidate.suggested_segment.start_seconds + 1.5
            adjusted_end = candidate.suggested_segment.end_seconds + 1.5

            updated_session = apply_review_update(
                session.id,
                candidate.id,
                action="ACCEPT",
                label="Keep opener payoff",
                adjusted_segment={
                    "start_seconds": adjusted_start,
                    "end_seconds": adjusted_end,
                },
                database_path=database_path,
            )

            self.assertEqual(updated_session.status, "REVIEWING")
            self.assertEqual(updated_session.review_decisions[0].action.value, "ACCEPT")
            self.assertEqual(updated_session.review_decisions[0].label, "Keep opener payoff")
            self.assertAlmostEqual(
                updated_session.review_decisions[0].adjusted_segment.start_seconds,
                adjusted_start,
            )
            self.assertEqual(updated_session.candidates[0].editable_label, "Keep opener payoff")
            self.assertAlmostEqual(
                updated_session.candidates[0].suggested_segment.start_seconds,
                adjusted_start,
            )

            reloaded_session = load_session_request(
                session.id,
                database_path=database_path,
            )
            self.assertEqual(reloaded_session.review_decisions[0].action.value, "ACCEPT")
            self.assertEqual(reloaded_session.candidates[0].editable_label, "Keep opener payoff")
            self.assertAlmostEqual(
                reloaded_session.candidates[0].suggested_segment.end_seconds,
                adjusted_end,
            )

    def test_session_summaries_list_real_persisted_sessions(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            database_path = str(Path(temp_dir) / "highlightsmith.sqlite3")
            media_path_a = Path(temp_dir) / "backlog-a.mp4"
            media_path_b = Path(temp_dir) / "backlog-b.mp4"
            media_path_a.write_bytes(b"backlog-a-fixture")
            media_path_b.write_bytes(b"backlog-b-fixture")

            session_a = analyze_request(
                str(media_path_a),
                session_title="Backlog A",
                persist=True,
                database_path=database_path,
            )
            session_b = analyze_request(
                str(media_path_b),
                session_title="Backlog B",
                persist=True,
                database_path=database_path,
            )

            apply_review_update(
                session_b.id,
                session_b.candidates[0].id,
                action="ACCEPT",
                timestamp="2099-03-25T15:30:00+00:00",
                database_path=database_path,
            )
            apply_review_update(
                session_b.id,
                session_b.candidates[1].id,
                action="REJECT",
                timestamp="2099-03-25T15:31:00+00:00",
                database_path=database_path,
            )

            summaries = list_session_summaries_request(database_path=database_path)

            self.assertEqual(len(summaries), 2)
            self.assertEqual(summaries[0]["session_id"], session_b.id)
            self.assertEqual(summaries[0]["session_title"], "Backlog B")
            self.assertEqual(summaries[0]["source_name"], media_path_b.name)
            self.assertIn("analysis_coverage", summaries[0])
            self.assertEqual(summaries[0]["analysis_coverage"]["band"], "PARTIAL")
            self.assertEqual(summaries[0]["candidate_count"], len(session_b.candidates))
            self.assertEqual(summaries[0]["accepted_count"], 1)
            self.assertEqual(summaries[0]["rejected_count"], 1)
            self.assertEqual(
                summaries[0]["pending_count"],
                len(session_b.candidates) - 2,
            )
            self.assertEqual(summaries[1]["session_id"], session_a.id)
            self.assertEqual(summaries[1]["accepted_count"], 0)
            self.assertEqual(summaries[1]["rejected_count"], 0)
            self.assertEqual(
                summaries[1]["pending_count"],
                len(session_a.candidates),
            )


if __name__ == "__main__":
    unittest.main()
