"""Unit tests for TraceEvent and TraceRun models — Milestone 1.1 acceptance criteria."""

import json
import pytest
from agentlens.models import TraceEvent, TraceRun, EventType, EventStatus


class TestTraceEvent:
    """Acceptance criteria per README M1.1."""

    def test_id_auto_generated(self):
        """event.id is not None — 自动生成 UUID"""
        event = TraceEvent(
            step=1,
            type="llm_call",
            input={"prompt": "hello"},
            output={"text": "world"},
        )
        assert event.id is not None
        assert event.id.startswith("evt_")
        assert len(event.id) > 4  # "evt_" + 12 hex chars

    def test_timestamp_start_auto_generated(self):
        """event.timestamp_start is not None — 自动填充当前时间戳"""
        event = TraceEvent(
            step=1,
            type="llm_call",
            input={},
            output={},
        )
        assert event.timestamp_start is not None
        assert event.timestamp_start > 0

    def test_unique_ids_per_event(self):
        """每个 event 有不同的 id"""
        e1 = TraceEvent(step=1, type="agent_start", input={}, output={})
        e2 = TraceEvent(step=2, type="agent_end", input={}, output={})
        assert e1.id != e2.id

    def test_mark_success_sets_status_and_end_ts(self):
        event = TraceEvent(step=1, type="llm_call", input={}, output={})
        assert event.status == EventStatus.PENDING
        assert event.timestamp_end is None

        event.mark_success()
        assert event.status == EventStatus.SUCCESS
        assert event.timestamp_end is not None
        assert event.timestamp_end >= event.timestamp_start

    def test_mark_failed_sets_status_and_end_ts(self):
        event = TraceEvent(step=1, type="tool_call", input={}, output={})
        event.mark_failed()
        assert event.status == EventStatus.FAILED
        assert event.timestamp_end is not None

    def test_duration_ms_returns_correct_value(self):
        event = TraceEvent(
            step=1,
            type="llm_call",
            input={},
            output={},
            timestamp_start=1000,
        )
        assert event.duration_ms is None  # not ended yet

        event.timestamp_end = 2400
        assert event.duration_ms == 1400

    def test_json_serialization_matches_contract(self):
        """Section 4.1 契约：序列化后字段名称和类型匹配"""
        event = TraceEvent(
            step=1,
            type="llm_call",
            status="success",
            input={"prompt": "hello"},
            output={"text": "world"},
            metadata={"duration_ms": 1240, "token_count": 512},
            timestamp_start=1720000000000,
            timestamp_end=1720000001240,
        )
        data = json.loads(event.model_dump_json())
        assert data["id"].startswith("evt_")
        assert data["step"] == 1
        assert data["type"] == "llm_call"
        assert data["status"] == "success"
        assert data["input"] == {"prompt": "hello"}
        assert data["output"] == {"text": "world"}
        assert data["metadata"] == {"duration_ms": 1240, "token_count": 512}
        assert data["timestamp_start"] == 1720000000000
        assert data["timestamp_end"] == 1720000001240


class TestTraceRun:
    """TraceRun contract tests."""

    def test_run_id_auto_generated(self):
        run = TraceRun(agent_name="test_agent")
        assert run.run_id.startswith("run_")
        assert len(run.run_id) > 4

    def test_add_event_assigns_run_id_and_step(self):
        run = TraceRun(agent_name="test")
        event = TraceEvent(step=0, type="llm_call", input={}, output={})

        run.add_event(event)
        assert event.run_id == run.run_id
        assert event.step == 1
        assert run.total_steps == 1

    def test_multiple_events_increment_step(self):
        run = TraceRun(agent_name="test")
        e1 = TraceEvent(type="agent_start", input={}, output={}, step=0)
        e2 = TraceEvent(type="llm_call", input={}, output={}, step=0)
        e3 = TraceEvent(type="agent_end", input={}, output={}, step=0)

        run.add_event(e1)
        run.add_event(e2)
        run.add_event(e3)

        assert run.total_steps == 3
        assert run.events[0].step == 1
        assert run.events[1].step == 2
        assert run.events[2].step == 3

    def test_finalize_completed_when_no_failures(self):
        run = TraceRun(agent_name="test")
        e1 = TraceEvent(type="agent_start", input={}, output={}, step=0)
        e1.mark_success()
        run.add_event(e1)

        run.finalize()
        assert run.status == "completed"

    def test_finalize_failed_when_any_event_failed(self):
        run = TraceRun(agent_name="test")
        e1 = TraceEvent(type="agent_start", input={}, output={}, step=0)
        e1.mark_success()
        run.add_event(e1)

        e2 = TraceEvent(type="llm_call", input={}, output={}, step=0)
        e2.mark_failed()
        run.add_event(e2)

        run.finalize()
        assert run.status == "failed"

    def test_json_serialization_matches_contract(self):
        """Section 4.3 契约：Trace 文件结构"""
        run = TraceRun(
            run_id="run_abc123",
            agent_name="my_research_agent",
            created_at=1720000000000,
        )
        e1 = TraceEvent(
            id="evt_001",
            run_id="run_abc123",
            step=1,
            type="agent_start",
            status="success",
            input={},
            output={},
            timestamp_start=1720000000000,
            timestamp_end=1720000000100,
        )
        run.add_event(e1)
        run.total_steps = 1  # override for contract test
        run.status = "completed"

        data = json.loads(run.model_dump_json())
        assert data["run_id"] == "run_abc123"
        assert data["agent_name"] == "my_research_agent"
        assert data["created_at"] == 1720000000000
        assert data["total_steps"] == 1
        assert data["status"] == "completed"
        assert len(data["events"]) == 1


class TestEventTypeEnum:
    """Section 4.2 契约：所有事件类型可用."""

    def test_all_event_types(self):
        expected = {"llm_call", "tool_call", "tool_result", "memory_update", "agent_start", "agent_end"}
        actual = {e.value for e in EventType}
        assert actual == expected

    def test_constructor_accepts_string(self):
        """EventType 可接受字符串构造"""
        event = TraceEvent(step=1, type="llm_call", input={}, output={})
        assert event.type == EventType.LLM_CALL
