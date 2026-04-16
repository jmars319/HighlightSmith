from __future__ import annotations

from datetime import datetime, timezone

from .contracts import ProjectSession, ReviewAction, ReviewDecision, Settings, TimeRange
from .pipeline.orchestrator import analyze_media
from .pipeline.profile_matching import build_profile_match
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
    store = SessionStore(database_path)
    store.initialize()
    resolved_profile_id = store.resolve_profile_id(profile_id)
    session = analyze_media(
        source_path,
        settings=settings or Settings(),
        profile_id=resolved_profile_id,
        session_title=session_title,
    )
    session = _apply_profile_matches(store, session)

    if persist:
        store.save_session(session)

    return session


def load_session_request(
    session_id: str,
    *,
    database_path: str = DEFAULT_DATABASE_PATH,
) -> ProjectSession:
    store = SessionStore(database_path)
    store.initialize()
    session = store.load_session(session_id)
    previous_snapshot = _profile_match_snapshot(session)
    hydrated_session = _apply_profile_matches(store, session)
    if _profile_matches_changed(previous_snapshot, hydrated_session):
        store.save_session(hydrated_session)
    return hydrated_session


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
    session = store.load_session(session_id)
    previous_snapshot = _profile_match_snapshot(session)
    hydrated_session = _apply_profile_matches(store, session)
    if _profile_matches_changed(previous_snapshot, hydrated_session):
        store.save_session(hydrated_session)
    return hydrated_session


def list_profiles_request(
    *,
    database_path: str = DEFAULT_DATABASE_PATH,
) -> list[object]:
    store = SessionStore(database_path)
    store.initialize()
    return store.list_profiles()


def create_profile_request(
    name: str,
    *,
    description: str | None = None,
    state: str = "ACTIVE",
    database_path: str = DEFAULT_DATABASE_PATH,
):
    store = SessionStore(database_path)
    store.initialize()
    return store.create_profile(
        name=name,
        description=description or "",
        state=state,
    )


def list_profile_examples_request(
    profile_id: str,
    *,
    database_path: str = DEFAULT_DATABASE_PATH,
) -> list[object]:
    store = SessionStore(database_path)
    store.initialize()
    return store.list_example_clips(profile_id)


def add_profile_example_request(
    profile_id: str,
    *,
    source_type: str,
    source_value: str,
    title: str | None = None,
    note: str | None = None,
    database_path: str = DEFAULT_DATABASE_PATH,
):
    store = SessionStore(database_path)
    store.initialize()
    return store.add_example_clip(
        profile_id,
        source_type=source_type,
        source_value=source_value,
        title=title,
        note=note,
    )


def _apply_profile_matches(
    store: SessionStore,
    session: ProjectSession,
) -> ProjectSession:
    if not session.profile_id:
        return session

    try:
        profile = store.load_profile(session.profile_id)
    except KeyError:
        return session

    updated_candidates = []
    for candidate in session.candidates:
        match = build_profile_match(
            candidate,
            session.feature_windows,
            profile,
        )
        existing_matches = [
            existing_match
            for existing_match in candidate.profile_matches
            if existing_match.profile_id != profile.id
        ]
        candidate.profile_matches = [*existing_matches, match]
        updated_candidates.append(candidate)

    session.candidates = updated_candidates
    return session


def _profile_match_snapshot(
    session: ProjectSession,
) -> list[tuple[str, tuple[tuple[str, str, str, str | None], ...]]]:
    return [
        (
            candidate.id,
            tuple(
                (
                    match.profile_id,
                    match.status.value,
                    match.strength.value,
                    f"{match.similarity_score:.4f}" if match.similarity_score is not None else None,
                )
                for match in candidate.profile_matches
            ),
        )
        for candidate in session.candidates
    ]


def _profile_matches_changed(
    previous_snapshot: list[tuple[str, tuple[tuple[str, str, str, str | None], ...]]],
    next_session: ProjectSession,
) -> bool:
    next_snapshot = _profile_match_snapshot(next_session)
    if len(previous_snapshot) != len(next_snapshot):
        return True

    for previous_candidate, next_candidate in zip(previous_snapshot, next_snapshot):
        if previous_candidate != next_candidate:
            return True

    return False
