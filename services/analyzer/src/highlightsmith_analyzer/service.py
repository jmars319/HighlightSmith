from __future__ import annotations

from datetime import datetime, timezone

from .contracts import ProjectSession, ReviewAction, ReviewDecision, Settings, TimeRange
from .pipeline.orchestrator import analyze_media
from .storage.session_store import SessionStore

DEFAULT_DATABASE_PATH = ".local/highlightsmith.sqlite3"


def analyze_request(
    source_path: str,
    *,
    profile_id: str = "generic",
    session_title: str | None = None,
    persist: bool = True,
    database_path: str = DEFAULT_DATABASE_PATH,
    settings: Settings | None = None,
) -> ProjectSession:
    session = analyze_media(
        source_path,
        settings=settings or Settings(),
        profile_id=profile_id,
        session_title=session_title,
    )

    if persist:
        store = SessionStore(database_path)
        store.initialize()
        store.save_session(session)

    return session


def load_session_request(
    session_id: str,
    *,
    database_path: str = DEFAULT_DATABASE_PATH,
) -> ProjectSession:
    store = SessionStore(database_path)
    store.initialize()
    return store.load_session(session_id)


def list_session_summaries_request(
    *,
    database_path: str = DEFAULT_DATABASE_PATH,
) -> list[dict[str, object]]:
    store = SessionStore(database_path)
    store.initialize()
    return store.list_session_summaries()


def apply_review_update(
    session_id: str,
    candidate_id: str,
    *,
    action: str,
    label: str | None = None,
    adjusted_segment: dict[str, float] | None = None,
    notes: str | None = None,
    timestamp: str | None = None,
    database_path: str = DEFAULT_DATABASE_PATH,
) -> ProjectSession:
    store = SessionStore(database_path)
    store.initialize()
    session = store.load_session(session_id)

    if not any(candidate.id == candidate_id for candidate in session.candidates):
        raise KeyError(f"Candidate not found in session {session_id}: {candidate_id}")

    existing_decision = next(
        (decision for decision in session.review_decisions if decision.candidate_id == candidate_id),
        None,
    )

    normalized_action = ReviewAction(action)
    if (
        normalized_action in {ReviewAction.RELABEL, ReviewAction.RETIME}
        and existing_decision
        and existing_decision.action in {ReviewAction.ACCEPT, ReviewAction.REJECT}
    ):
        normalized_action = existing_decision.action
    normalized_adjusted_segment = (
        TimeRange(
            start_seconds=float(adjusted_segment["start_seconds"]),
            end_seconds=float(adjusted_segment["end_seconds"]),
        )
        if adjusted_segment
        else existing_decision.adjusted_segment if existing_decision else None
    )
    normalized_label = label if label is not None else existing_decision.label if existing_decision else None
    normalized_notes = notes if notes is not None else existing_decision.notes if existing_decision else None

    decision = ReviewDecision(
        id=existing_decision.id if existing_decision else f"review_{session_id}_{candidate_id}",
        project_session_id=session_id,
        candidate_id=candidate_id,
        action=normalized_action,
        label=normalized_label,
        adjusted_segment=normalized_adjusted_segment,
        notes=normalized_notes,
        created_at=timestamp or datetime.now(timezone.utc).isoformat(),
    )
    store.save_review_decision(decision)
    return store.load_session(session_id)
