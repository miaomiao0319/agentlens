"""Unified Event schema — the system contract for all AgentLens data.

Every runtime action becomes an Event. Framework Adapters produce Events.
The Event Bus broadcasts Events. The VS Code Extension consumes Events.

This module is the single source of truth for the data flowing through the system.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class EventType(str, Enum):
    """All recognized event types in the AgentLens unified model."""

    LLM_CALL = "llm_call"
    LLM_RESPONSE = "llm_response"
    TOOL_CALL = "tool_call"
    TOOL_RESULT = "tool_result"
    HTTP_REQUEST = "http_request"
    DATABASE_QUERY = "database_query"
    MEMORY_UPDATE = "memory_update"
    RETRIEVAL = "retrieval"
    EMBEDDING = "embedding"
    ERROR = "error"
    CUSTOM = "custom"
    AGENT_START = "agent_start"
    AGENT_END = "agent_end"


class EventStatus(str, Enum):
    """Lifecycle status of an event."""

    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    PENDING = "pending"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _utc_now_ts() -> int:
    """Current UTC timestamp in milliseconds."""
    return int(datetime.now(timezone.utc).timestamp() * 1000)


def _new_id(prefix: str = "evt") -> str:
    """Generate a short unique id with a readable prefix."""
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


# ---------------------------------------------------------------------------
# Base Event
# ---------------------------------------------------------------------------


class BaseEvent(BaseModel):
    """Common fields shared by every AgentLens event.

    Represents one atomic runtime action: an LLM call, a tool invocation,
    an HTTP request, a memory update, etc.
    """

    id: str = Field(default_factory=_new_id)
    parent_id: str | None = Field(default=None, description="Null for root events; otherwise the id of the parent event")
    session_id: str = Field(default="", description="Debug Session this event belongs to")
    timestamp: int = Field(default_factory=_utc_now_ts, description="UTC epoch milliseconds when the event was created")
    duration: int = Field(default=0, description="Duration in milliseconds; 0 while running")
    type: EventType = Field(description="Discriminant for event type")
    status: EventStatus = Field(default=EventStatus.PENDING)

    # --- lifecycle helpers ---

    def mark_running(self) -> None:
        """Mark the event as currently executing."""
        self.status = EventStatus.RUNNING

    def mark_success(self) -> None:
        """Mark the event as completed successfully and compute duration.

        Idempotent: can be safely called multiple times.
        Only transitions from RUNNING or PENDING to SUCCESS.
        """
        if self.status in (EventStatus.SUCCESS, EventStatus.FAILED):
            return  # already finalized, keep original duration
        self.status = EventStatus.SUCCESS
        now = _utc_now_ts()
        if self.duration == 0:
            self.duration = now - self.timestamp

    def mark_failed(self) -> None:
        """Mark the event as failed and compute duration.

        Idempotent: can be safely called multiple times.
        Only transitions from RUNNING or PENDING to FAILED.
        """
        if self.status in (EventStatus.SUCCESS, EventStatus.FAILED):
            return  # already finalized, keep original outcome
        self.status = EventStatus.FAILED
        now = _utc_now_ts()
        if self.duration == 0:
            self.duration = now - self.timestamp


# ---------------------------------------------------------------------------
# Concrete Event types
# ---------------------------------------------------------------------------


class LLMCallEvent(BaseEvent):
    """An LLM call was initiated (before the response arrives)."""

    type: Literal[EventType.LLM_CALL] = EventType.LLM_CALL  # type: ignore[assignment]
    model: str = ""
    messages: list[dict[str, Any]] = Field(default_factory=list)
    parameters: dict[str, Any] = Field(default_factory=dict, description="temperature, max_tokens, etc.")


class LLMResponseEvent(BaseEvent):
    """An LLM returned a response."""

    type: Literal[EventType.LLM_RESPONSE] = EventType.LLM_RESPONSE  # type: ignore[assignment]
    model: str = ""
    content: str = ""
    token_count: int = 0
    finish_reason: str = ""
    cost_usd: float = 0.0


class ToolCallEvent(BaseEvent):
    """An external tool was invoked."""

    type: Literal[EventType.TOOL_CALL] = EventType.TOOL_CALL  # type: ignore[assignment]
    tool_name: str = ""
    parameters: dict[str, Any] = Field(default_factory=dict)


class ToolResultEvent(BaseEvent):
    """A tool returned a result."""

    type: Literal[EventType.TOOL_RESULT] = EventType.TOOL_RESULT  # type: ignore[assignment]
    tool_name: str = ""
    result: Any = None
    is_error: bool = False


class HTTPRequestEvent(BaseEvent):
    """An HTTP request was made (e.g. by a tool)."""

    type: Literal[EventType.HTTP_REQUEST] = EventType.HTTP_REQUEST  # type: ignore[assignment]
    method: str = "GET"
    url: str = ""
    request_headers: dict[str, str] = Field(default_factory=dict)
    request_body: str | None = None
    response_status: int | None = None
    response_body: str | None = None


class DatabaseQueryEvent(BaseEvent):
    """A database query was executed."""

    type: Literal[EventType.DATABASE_QUERY] = EventType.DATABASE_QUERY  # type: ignore[assignment]
    query: str = ""
    params: Any = None
    row_count: int | None = None


class MemoryUpdateEvent(BaseEvent):
    """The agent updated its memory or context."""

    type: Literal[EventType.MEMORY_UPDATE] = EventType.MEMORY_UPDATE  # type: ignore[assignment]
    operation: str = ""  # "add", "update", "remove"
    key: str = ""
    value_before: Any = None
    value_after: Any = None


class RetrievalEvent(BaseEvent):
    """A retrieval step was executed (RAG pipeline)."""

    type: Literal[EventType.RETRIEVAL] = EventType.RETRIEVAL  # type: ignore[assignment]
    query: str = ""
    documents: list[dict[str, Any]] = Field(default_factory=list)
    top_k: int = 0


class EmbeddingEvent(BaseEvent):
    """An embedding was generated."""

    type: Literal[EventType.EMBEDDING] = EventType.EMBEDDING  # type: ignore[assignment]
    model: str = ""
    input_text: str = ""
    token_count: int = 0


class ErrorEvent(BaseEvent):
    """An error occurred during execution."""

    type: Literal[EventType.ERROR] = EventType.ERROR  # type: ignore[assignment]
    error_type: str = ""
    error_message: str = ""
    stack_trace: str | None = None
    source_event_id: str | None = Field(default=None, description="The event that triggered this error")


class AgentStartEvent(BaseEvent):
    """An agent execution started."""

    type: Literal[EventType.AGENT_START] = EventType.AGENT_START  # type: ignore[assignment]
    agent_name: str = ""
    framework: str = ""


class AgentEndEvent(BaseEvent):
    """An agent execution ended."""

    type: Literal[EventType.AGENT_END] = EventType.AGENT_END  # type: ignore[assignment]
    agent_name: str = ""
    total_events: int = 0
    error: str | None = None


class CustomEvent(BaseEvent):
    """A user-defined or framework-specific event not covered by the standard types."""

    type: Literal[EventType.CUSTOM] = EventType.CUSTOM  # type: ignore[assignment]
    name: str = ""
    data: dict[str, Any] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Type union for discriminated event parsing
# ---------------------------------------------------------------------------


Event = (
    LLMCallEvent
    | LLMResponseEvent
    | ToolCallEvent
    | ToolResultEvent
    | HTTPRequestEvent
    | DatabaseQueryEvent
    | MemoryUpdateEvent
    | RetrievalEvent
    | EmbeddingEvent
    | ErrorEvent
    | AgentStartEvent
    | AgentEndEvent
    | CustomEvent
)


# ---------------------------------------------------------------------------
# JSON deserialization helper
# ---------------------------------------------------------------------------


_EVENT_TYPE_MAP: dict[EventType, type[BaseEvent]] = {
    EventType.LLM_CALL: LLMCallEvent,
    EventType.LLM_RESPONSE: LLMResponseEvent,
    EventType.TOOL_CALL: ToolCallEvent,
    EventType.TOOL_RESULT: ToolResultEvent,
    EventType.HTTP_REQUEST: HTTPRequestEvent,
    EventType.DATABASE_QUERY: DatabaseQueryEvent,
    EventType.MEMORY_UPDATE: MemoryUpdateEvent,
    EventType.RETRIEVAL: RetrievalEvent,
    EventType.EMBEDDING: EmbeddingEvent,
    EventType.ERROR: ErrorEvent,
    EventType.AGENT_START: AgentStartEvent,
    EventType.AGENT_END: AgentEndEvent,
    EventType.CUSTOM: CustomEvent,
}


def parse_event(data: dict[str, Any]) -> BaseEvent:
    """Deserialize a JSON dict into the correct Event subclass.

    Uses the ``type`` field to select the right model.

    Raises:
        ValueError: if ``type`` is missing or unknown.
    """
    type_str = data.get("type")
    if type_str is None:
        raise ValueError("Event dict missing required field: 'type'")
    try:
        event_type = EventType(type_str)
    except ValueError:
        raise ValueError(f"Unknown event type: {type_str!r}")

    model_cls = _EVENT_TYPE_MAP[event_type]
    return model_cls(**data)
