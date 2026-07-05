"""Trace event and run data models — the system contract."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class EventType(str, Enum):
    """Valid event types in the AgentLens trace model."""

    LLM_CALL = "llm_call"
    TOOL_CALL = "tool_call"
    TOOL_RESULT = "tool_result"
    MEMORY_UPDATE = "memory_update"
    AGENT_START = "agent_start"
    AGENT_END = "agent_end"


class EventStatus(str, Enum):
    SUCCESS = "success"
    FAILED = "failed"
    PENDING = "pending"


def _utc_now_ts() -> int:
    """Return current UTC timestamp in milliseconds."""
    return int(datetime.now(timezone.utc).timestamp() * 1000)


def _new_uuid() -> str:
    """Generate a short event id prefixed with 'evt_'."""
    return f"evt_{uuid.uuid4().hex[:12]}"


class TraceEvent(BaseModel):
    """A single execution event recorded during an agent run."""

    id: str = Field(default_factory=_new_uuid)
    run_id: str = ""
    step: int = 0
    type: EventType
    status: EventStatus = EventStatus.PENDING
    input: dict[str, Any] = Field(default_factory=dict)
    output: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)
    timestamp_start: int = Field(default_factory=_utc_now_ts)
    timestamp_end: Optional[int] = None

    def mark_success(self) -> None:
        self.status = EventStatus.SUCCESS
        if self.timestamp_end is None:
            self.timestamp_end = _utc_now_ts()

    def mark_failed(self) -> None:
        self.status = EventStatus.FAILED
        if self.timestamp_end is None:
            self.timestamp_end = _utc_now_ts()

    @property
    def duration_ms(self) -> Optional[int]:
        if self.timestamp_end is not None:
            return self.timestamp_end - self.timestamp_start
        return None


class TraceRun(BaseModel):
    """A complete agent run containing an ordered list of trace events."""

    run_id: str = Field(default_factory=lambda: f"run_{uuid.uuid4().hex[:12]}")
    agent_name: str = "unknown"
    created_at: int = Field(default_factory=_utc_now_ts)
    total_steps: int = 0
    status: str = "pending"
    events: list[TraceEvent] = Field(default_factory=list)

    def add_event(self, event: TraceEvent) -> None:
        event.run_id = self.run_id
        event.step = len(self.events) + 1
        self.events.append(event)
        self.total_steps = len(self.events)

    def finalize(self) -> None:
        """Mark the run as completed or failed based on event outcomes."""
        if any(e.status == EventStatus.FAILED for e in self.events):
            self.status = "failed"
        else:
            self.status = "completed"
