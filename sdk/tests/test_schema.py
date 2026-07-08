"""Tests for the unified Event schema — the system contract."""

import json
import pytest
from agentlens.schema import (
    EventType,
    EventStatus,
    BaseEvent,
    LLMCallEvent,
    LLMResponseEvent,
    ToolCallEvent,
    ToolResultEvent,
    HTTPRequestEvent,
    DatabaseQueryEvent,
    MemoryUpdateEvent,
    RetrievalEvent,
    EmbeddingEvent,
    ErrorEvent,
    AgentStartEvent,
    AgentEndEvent,
    CustomEvent,
    parse_event,
)


# ---------------------------------------------------------------------------
# EventType enum
# ---------------------------------------------------------------------------


class TestEventType:
    def test_all_types_exist(self):
        """All 13 event types should be defined."""
        expected = {
            "llm_call", "llm_response", "tool_call", "tool_result",
            "http_request", "database_query", "memory_update",
            "retrieval", "embedding", "error", "custom",
            "agent_start", "agent_end",
        }
        actual = {e.value for e in EventType}
        assert actual == expected

    def test_accepts_string(self):
        """EventType constructor accepts a string."""
        assert EventType("llm_call") == EventType.LLM_CALL
        assert EventType("tool_call") == EventType.TOOL_CALL

    def test_rejects_invalid(self):
        """Invalid strings raise ValueError."""
        with pytest.raises(ValueError):
            EventType("nonexistent")


class TestEventStatus:
    def test_all_statuses_exist(self):
        expected = {"running", "success", "failed", "pending"}
        assert {s.value for s in EventStatus} == expected


# ---------------------------------------------------------------------------
# BaseEvent
# ---------------------------------------------------------------------------


class TestBaseEvent:
    def test_id_auto_generated(self):
        event = BaseEvent(type=EventType.CUSTOM)
        assert event.id.startswith("evt_")
        assert len(event.id) == 16  # "evt_" + 12 hex

    def test_timestamp_auto_generated(self):
        event = BaseEvent(type=EventType.CUSTOM)
        assert event.timestamp > 0

    def test_unique_ids(self):
        a = BaseEvent(type=EventType.CUSTOM)
        b = BaseEvent(type=EventType.CUSTOM)
        assert a.id != b.id

    def test_defaults(self):
        event = BaseEvent(type=EventType.LLM_CALL)
        assert event.parent_id is None
        assert event.session_id == ""
        assert event.duration == 0
        assert event.status == EventStatus.PENDING

    def test_mark_running(self):
        event = BaseEvent(type=EventType.LLM_CALL)
        event.mark_running()
        assert event.status == EventStatus.RUNNING

    def test_mark_success(self):
        event = BaseEvent(type=EventType.LLM_CALL)
        event.mark_success()
        assert event.status == EventStatus.SUCCESS
        assert event.duration >= 0

    def test_mark_failed(self):
        event = BaseEvent(type=EventType.LLM_CALL)
        event.mark_failed()
        assert event.status == EventStatus.FAILED
        assert event.duration >= 0

    def test_duration_stays_if_already_set(self):
        event = BaseEvent(type=EventType.LLM_CALL, duration=500)
        event.mark_success()
        assert event.duration == 500  # not overwritten

    def test_json_roundtrip_base(self):
        event = BaseEvent(
            type=EventType.CUSTOM,
            parent_id="evt_parent",
            session_id="sess_001",
            status=EventStatus.SUCCESS,
        )
        dumped = event.model_dump()
        assert dumped["type"] == "custom"
        assert dumped["parent_id"] == "evt_parent"
        assert dumped["session_id"] == "sess_001"


# ---------------------------------------------------------------------------
# Concrete event types
# ---------------------------------------------------------------------------


class TestLLMCallEvent:
    def test_type_is_correct(self):
        event = LLMCallEvent()
        assert event.type == EventType.LLM_CALL

    def test_fields(self):
        event = LLMCallEvent(
            model="gpt-4o",
            messages=[{"role": "user", "content": "hello"}],
            parameters={"temperature": 0.7},
        )
        assert event.model == "gpt-4o"
        assert len(event.messages) == 1
        assert event.parameters["temperature"] == 0.7

    def test_json_roundtrip(self):
        event = LLMCallEvent(
            model="gpt-4o",
            messages=[{"role": "user", "content": "hi"}],
        )
        data = event.model_dump()
        parsed = parse_event(data)
        assert isinstance(parsed, LLMCallEvent)
        assert parsed.model == "gpt-4o"


class TestLLMResponseEvent:
    def test_fields(self):
        event = LLMResponseEvent(
            model="gpt-4o",
            content="Hello!",
            token_count=150,
            finish_reason="stop",
        )
        assert event.content == "Hello!"
        assert event.token_count == 150

    def test_json_roundtrip(self):
        event = LLMResponseEvent(content="response text", token_count=42)
        parsed = parse_event(event.model_dump())
        assert isinstance(parsed, LLMResponseEvent)
        assert parsed.token_count == 42


class TestToolCallEvent:
    def test_fields(self):
        event = ToolCallEvent(
            tool_name="web_search",
            parameters={"query": "AI agents"},
        )
        assert event.tool_name == "web_search"
        assert event.parameters["query"] == "AI agents"


class TestToolResultEvent:
    def test_fields(self):
        event = ToolResultEvent(
            tool_name="web_search",
            result={"results": ["a", "b"]},
            is_error=False,
        )
        assert event.result == {"results": ["a", "b"]}
        assert not event.is_error

    def test_error_result(self):
        event = ToolResultEvent(
            tool_name="web_search",
            result="Connection refused",
            is_error=True,
        )
        assert event.is_error


class TestHTTPRequestEvent:
    def test_fields(self):
        event = HTTPRequestEvent(
            method="POST",
            url="https://api.example.com/search",
            request_headers={"Authorization": "Bearer xyz"},
            response_status=200,
            response_body='{"ok": true}',
        )
        assert event.method == "POST"
        assert event.response_status == 200


class TestDatabaseQueryEvent:
    def test_fields(self):
        event = DatabaseQueryEvent(
            query="SELECT * FROM users WHERE id = ?",
            params=[42],
            row_count=1,
        )
        assert "SELECT" in event.query
        assert event.row_count == 1


class TestMemoryUpdateEvent:
    def test_fields(self):
        event = MemoryUpdateEvent(
            operation="add",
            key="conversation_history",
            value_before=None,
            value_after=[{"role": "user", "content": "hi"}],
        )
        assert event.operation == "add"
        assert event.key == "conversation_history"


class TestRetrievalEvent:
    def test_fields(self):
        event = RetrievalEvent(
            query="What is RAG?",
            documents=[{"id": "doc1", "score": 0.95}],
            top_k=5,
        )
        assert len(event.documents) == 1
        assert event.top_k == 5


class TestEmbeddingEvent:
    def test_fields(self):
        event = EmbeddingEvent(
            model="text-embedding-3-small",
            input_text="hello world",
            token_count=2,
        )
        assert event.model == "text-embedding-3-small"


class TestErrorEvent:
    def test_fields(self):
        event = ErrorEvent(
            error_type="ValueError",
            error_message="Something went wrong",
            stack_trace="Traceback...",
            source_event_id="evt_abc",
        )
        assert event.error_type == "ValueError"
        assert event.source_event_id == "evt_abc"

    def test_status_is_failed(self):
        event = ErrorEvent(error_type="Exception", error_message="boom")
        event.mark_failed()
        assert event.status == EventStatus.FAILED


class TestAgentStartEvent:
    def test_fields(self):
        event = AgentStartEvent(
            agent_name="research_agent",
            framework="langgraph",
        )
        assert event.type == EventType.AGENT_START
        assert event.framework == "langgraph"


class TestAgentEndEvent:
    def test_fields(self):
        event = AgentEndEvent(
            agent_name="research_agent",
            total_events=42,
            error=None,
        )
        assert event.type == EventType.AGENT_END
        assert event.total_events == 42

    def test_with_error(self):
        event = AgentEndEvent(
            agent_name="bad_agent",
            total_events=5,
            error="Timeout",
        )
        assert event.error == "Timeout"


class TestCustomEvent:
    def test_fields(self):
        event = CustomEvent(
            name="user_feedback",
            data={"rating": 5, "comment": "great"},
        )
        assert event.name == "user_feedback"
        assert event.data["rating"] == 5


# ---------------------------------------------------------------------------
# parse_event (JSON deserialization)
# ---------------------------------------------------------------------------


class TestParseEvent:
    def test_parse_each_type(self):
        """parse_event should reconstruct every Event subclass."""
        events = [
            LLMCallEvent(model="gpt-4o"),
            LLMResponseEvent(content="ok"),
            ToolCallEvent(tool_name="search"),
            ToolResultEvent(tool_name="search", result="done"),
            HTTPRequestEvent(url="https://example.com"),
            DatabaseQueryEvent(query="SELECT 1"),
            MemoryUpdateEvent(operation="update", key="x"),
            RetrievalEvent(query="test"),
            EmbeddingEvent(model="ada"),
            ErrorEvent(error_type="TestError", error_message="testing"),
            AgentStartEvent(agent_name="demo"),
            AgentEndEvent(agent_name="demo"),
            CustomEvent(name="test_event"),
        ]
        for original in events:
            parsed = parse_event(original.model_dump())
            assert type(parsed) is type(original), f"Failed for {original.type}"
            assert parsed.id == original.id
            assert parsed.type == original.type

    def test_parse_unknown_type_raises(self):
        with pytest.raises(ValueError, match="Unknown event type"):
            parse_event({"type": "unicorn_magic"})

    def test_parse_missing_type_raises(self):
        with pytest.raises(ValueError, match="missing"):
            parse_event({"id": "123"})

    def test_parse_preserves_parent_id(self):
        event = ToolCallEvent(
            parent_id="evt_parent_abc",
            tool_name="search",
        )
        parsed = parse_event(event.model_dump())
        assert parsed.parent_id == "evt_parent_abc"

    def test_parse_preserves_session_id(self):
        event = LLMCallEvent(session_id="sess_xyz")
        parsed = parse_event(event.model_dump())
        assert parsed.session_id == "sess_xyz"

    def test_all_types_are_registered(self):
        """Every EventType value must map to a model class."""
        for etype in EventType:
            data = {"type": etype.value}
            parsed = parse_event(data)
            assert parsed.type == etype
