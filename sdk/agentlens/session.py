"""Session Manager — tracks Debug Sessions and their Events.

Each agent execution creates one Debug Session. Sessions are independent,
bounded units of execution that contain an ordered sequence of Events.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from agentlens.schema import BaseEvent, EventStatus


def _utc_now_ts() -> int:
    return int(datetime.now(timezone.utc).timestamp() * 1000)


def _new_session_id() -> str:
    return f"sess_{uuid.uuid4().hex[:12]}"


class Session:
    """A single Debug Session — one agent execution run."""

    MAX_EVENTS = 100_000  # safety cap to prevent unbounded memory growth

    def __init__(self, session_id: str, framework: str, agent_name: str) -> None:
        self.session_id = session_id
        self.framework = framework
        self.agent_name = agent_name
        self.created_at: int = _utc_now_ts()
        self.ended_at: int | None = None
        self.status: str = "running"
        self._events: list[BaseEvent] = []

    # -- properties --

    @property
    def events(self) -> list[BaseEvent]:
        return list(self._events)

    @property
    def event_count(self) -> int:
        return len(self._events)

    @property
    def duration_ms(self) -> int:
        end = self.ended_at or _utc_now_ts()
        return end - self.created_at

    # -- mutations --

    def add_event(self, event: BaseEvent) -> None:
        """Append an event to this session.

        Events beyond ``MAX_EVENTS`` are silently dropped to prevent unbounded
        memory growth during very long-running agents.
        """
        if len(self._events) >= self.MAX_EVENTS:
            return
        event.session_id = self.session_id
        self._events.append(event)

    def end(self, status: str = "completed") -> None:
        """Finalize the session."""
        self.status = status
        if self.ended_at is None:
            self.ended_at = _utc_now_ts()

    def get_tree(self) -> list[BaseEvent]:
        """Return events organized as a tree (root events with children).

        Root events have ``parent_id is None``. Children are returned in order,
        but it is the caller's responsibility to reconstruct the hierarchy.
        """
        return sorted(self._events, key=lambda e: e.timestamp)

    def to_dict(self) -> dict:
        """Serialize session metadata (not events) to a dict."""
        return {
            "session_id": self.session_id,
            "framework": self.framework,
            "agent_name": self.agent_name,
            "created_at": self.created_at,
            "ended_at": self.ended_at,
            "status": self.status,
            "event_count": self.event_count,
            "duration_ms": self.duration_ms,
        }


class SessionManager:
    """Manages the lifecycle of Debug Sessions.

    Sessions are created when an agent run starts, accumulate Events during
    execution, and are finalized when the run ends.
    """

    def __init__(self) -> None:
        self._sessions: dict[str, Session] = {}
        self._active_session_id: str | None = None

    # --- public API ---

    def create_session(self, framework: str = "unknown", agent_name: str = "unknown") -> Session:
        """Create a new Debug Session and set it as the active session.

        Returns:
            The newly created Session.
        """
        sid = _new_session_id()
        session = Session(session_id=sid, framework=framework, agent_name=agent_name)
        self._sessions[sid] = session
        self._active_session_id = sid
        return session

    def add_event(self, session_id: str, event: BaseEvent) -> None:
        """Add an Event to the specified session.

        Raises:
            KeyError: if the session does not exist.
        """
        session = self._sessions[session_id]
        session.add_event(event)

    def get_session(self, session_id: str) -> Session | None:
        """Return the Session with the given id, or None."""
        return self._sessions.get(session_id)

    def get_active_session(self) -> Session | None:
        """Return the currently active session, or None."""
        if self._active_session_id:
            return self._sessions.get(self._active_session_id)
        return None

    def list_sessions(self) -> list[Session]:
        """Return all sessions, newest first."""
        return sorted(
            self._sessions.values(),
            key=lambda s: s.created_at,
            reverse=True,
        )

    def end_session(self, session_id: str, status: str = "completed") -> None:
        """Finalize a session.

        Raises:
            KeyError: if the session does not exist.
        """
        session = self._sessions[session_id]
        session.end(status)
        if self._active_session_id == session_id:
            self._active_session_id = None

    @property
    def session_count(self) -> int:
        return len(self._sessions)
