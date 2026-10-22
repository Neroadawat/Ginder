"""Timer expiry and lost-WebSocket recovery must yield one shared result."""

import asyncio
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.core.exceptions import ForbiddenException, NotFoundException
from app.models.match_result import ResolutionType
from app.models.session import SessionStatus
from app.services.match_service import MatchService, Resolution
from app.services.session_service import SessionService
from app.services.vote_service import VoteService
from app.tasks import cleanup


class Rows:
    def __init__(self, rows):
        self.rows = rows

    def all(self):
        return self.rows

    def scalars(self):
        return self

    def scalar_one(self):
        return self.rows[0]

    def scalar_one_or_none(self):
        return self.rows[0] if self.rows else None


def room(status=SessionStatus.ACTIVE, expired=True):
    return SimpleNamespace(
        id=uuid4(),
        status=status,
        ends_at=datetime.now(UTC) + timedelta(seconds=-10 if expired else 60),
        participants=[],
    )


def saved_result(kind, winner=None):
    return SimpleNamespace(
        session_id=uuid4(),
        restaurant_id=winner,
        restaurant_name="Test restaurant",
        resolution_type=kind,
        restaurant=None,
    )


@pytest.mark.asyncio
async def test_no_votes_draws_from_full_deck_not_vote_rows(monkeypatch):
    session = room()
    ids = [uuid4(), uuid4(), uuid4()]
    db = SimpleNamespace(execute=AsyncMock(return_value=Rows([(rid,) for rid in ids])))
    service = MatchService(db)
    monkeypatch.setattr(service, "_lock_session", AsyncMock())
    monkeypatch.setattr(service, "_like_counts", AsyncMock(return_value={}))
    persist = AsyncMock(return_value=saved_result(ResolutionType.SPIN_WHEEL_NO_MATCH))
    monkeypatch.setattr(service, "_persist", persist)
    result = await service.resolve_session(session)
    assert result.wheel_candidates == ids
    assert persist.await_args.args[1] in ids
    assert result.to_ws_broadcast()[0] == "spin_wheel"


@pytest.mark.asyncio
async def test_tie_contains_only_top_restaurants(monkeypatch):
    ids = [uuid4(), uuid4(), uuid4()]
    service = MatchService(SimpleNamespace())
    monkeypatch.setattr(service, "_lock_session", AsyncMock())
    monkeypatch.setattr(
        service, "_like_counts", AsyncMock(return_value={ids[0]: 2, ids[1]: 2, ids[2]: 1})
    )
    monkeypatch.setattr(
        service, "_persist", AsyncMock(return_value=saved_result(ResolutionType.SPIN_WHEEL_TIE))
    )
    result = await service.resolve_session(room())
    assert set(result.wheel_candidates) == set(ids[:2])


@pytest.mark.asyncio
async def test_repeated_resolution_recovers_saved_winner_without_drawing_again(monkeypatch):
    service = MatchService(SimpleNamespace())
    expected = Resolution(saved_result(ResolutionType.SPIN_WHEEL_NO_MATCH, uuid4()), [uuid4()])
    monkeypatch.setattr(service, "_lock_session", AsyncMock())
    monkeypatch.setattr(service, "get_resolution", AsyncMock(return_value=expected))
    counts = AsyncMock()
    monkeypatch.setattr(service, "_like_counts", counts)
    assert await service.resolve_session(room(SessionStatus.FINISHED)) is expected
    counts.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "kind", [ResolutionType.SPIN_WHEEL_NO_MATCH, ResolutionType.SPIN_WHEEL_TIE]
)
async def test_rest_recovery_returns_wheel_candidates(kind, monkeypatch):
    ids = [uuid4(), uuid4()]
    saved = saved_result(kind, ids[0])
    db = SimpleNamespace(execute=AsyncMock(return_value=Rows(ids)))
    service = MatchService(db)
    monkeypatch.setattr(service, "_get_existing_result", AsyncMock(return_value=saved))
    monkeypatch.setattr(service, "_like_counts", AsyncMock(return_value={rid: 1 for rid in ids}))
    recovered = await service.get_resolution(room(SessionStatus.FINISHED))
    assert recovered.result.restaurant_id == ids[0]
    assert set(recovered.wheel_candidates) == set(ids)


@pytest.mark.asyncio
async def test_result_request_resolves_expired_room_without_waiting_for_worker(monkeypatch):
    session = room()
    saved = saved_result(ResolutionType.SPIN_WHEEL_NO_MATCH, uuid4())
    expected = Resolution(saved, [saved.restaurant_id])
    db = SimpleNamespace(execute=AsyncMock(return_value=Rows([saved])))
    service = SessionService(db)
    monkeypatch.setattr(service, "_get_session_with_participants", AsyncMock(return_value=session))
    monkeypatch.setattr(service, "_ensure_participant", lambda *_: None)
    resolve = AsyncMock(return_value=expected)
    monkeypatch.setattr(service, "resolve", resolve)
    monkeypatch.setattr(MatchService, "get_resolution", AsyncMock(return_value=expected))
    result = await service.get_result(session.id, SimpleNamespace())
    resolve.assert_awaited_once_with(session)
    assert result.wheel_candidate_ids == expected.wheel_candidates


@pytest.mark.asyncio
async def test_result_request_cannot_finish_room_early(monkeypatch):
    session = room(expired=False)
    service = SessionService(SimpleNamespace(execute=AsyncMock(return_value=Rows([]))))
    monkeypatch.setattr(service, "_get_session_with_participants", AsyncMock(return_value=session))
    monkeypatch.setattr(service, "_ensure_participant", lambda *_: None)
    resolve = AsyncMock()
    monkeypatch.setattr(service, "resolve", resolve)
    with pytest.raises(NotFoundException):
        await service.get_result(session.id, SimpleNamespace())
    resolve.assert_not_awaited()


@pytest.mark.asyncio
async def test_votes_after_deadline_are_rejected_even_before_worker_runs(monkeypatch):
    service = VoteService(SimpleNamespace())
    session = room()
    monkeypatch.setattr(service, "_get_session", AsyncMock(return_value=session))
    with pytest.raises(ForbiddenException):
        await service._ensure_active_session(session.id)


@pytest.mark.asyncio
async def test_resolution_lock_consumes_and_refreshes_session_row():
    rows = Rows([room()])
    db = SimpleNamespace(execute=AsyncMock(return_value=rows))
    await MatchService(db)._lock_session(rows.rows[0])
    statement = db.execute.await_args.args[0]
    assert statement._for_update_arg is not None
    assert statement.get_execution_options()["populate_existing"]


def test_worker_reuses_event_loop_across_periodic_tasks(monkeypatch):
    runner = asyncio.Runner()
    monkeypatch.setattr(cleanup, "_runner", runner)

    async def current_loop():
        return asyncio.get_running_loop()

    try:
        assert cleanup._run_async(current_loop()) is cleanup._run_async(current_loop())
    finally:
        runner.close()
