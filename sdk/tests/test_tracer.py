"""Unit tests for AgentTracer — Milestone 1.2 acceptance criteria."""

import json
import tempfile
from pathlib import Path

import pytest
from agentlens.models import TraceEvent, TraceRun, EventType, EventStatus
from agentlens.tracer import AgentTracer, record, get_current_tracer


class TestAgentTracer:
    """Acceptance criteria per README M1.2."""

    def test_tracer_creates_output_dir(self):
        """输出目录不存在时自动创建."""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_dir = Path(tmpdir) / "nested" / "traces"
            tracer = AgentTracer(agent_name="test_agent", output_dir=str(output_dir))
            assert output_dir.exists()

    def test_record_creates_event_and_adds_to_run(self):
        tracer = AgentTracer(agent_name="test_agent")
        event = tracer.record(
            type="llm_call",
            input={"prompt": "hi"},
            output={"text": "hello"},
        )
        assert isinstance(event, TraceEvent)
        assert event.type == EventType.LLM_CALL
        assert event.input == {"prompt": "hi"}
        assert event.output == {"text": "hello"}
        assert event.run_id == tracer.run_id

        run = tracer.get_trace()
        assert len(run.events) == 1
        assert run.total_steps == 1

    def test_get_trace_returns_current_trace_run(self):
        tracer = AgentTracer(agent_name="test_agent")
        run = tracer.get_trace()
        assert isinstance(run, TraceRun)
        assert run.agent_name == "test_agent"
        assert run.run_id == tracer.run_id

    def test_save_persists_json_file(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tracer = AgentTracer(agent_name="test_agent", output_dir=tmpdir)
            tracer.record(
                type="llm_call",
                input={"prompt": "hi"},
                output={"text": "hello"},
            )
            filepath = tracer.save()

            assert filepath.exists()
            assert filepath.suffix == ".json"
            assert "test_agent" in filepath.name

            # Verify content
            content = json.loads(filepath.read_text(encoding="utf-8"))
            assert content["agent_name"] == "test_agent"
            assert content["run_id"] == tracer.run_id
            assert content["status"] == "completed"
            assert len(content["events"]) == 1

    def test_file_naming_convention(self):
        """文件名规则: {agent_name}_{run_id[:8]}_{timestamp}.json"""
        with tempfile.TemporaryDirectory() as tmpdir:
            tracer = AgentTracer(agent_name="my_agent", output_dir=tmpdir)
            tracer.record(type="agent_start", input={}, output={})
            filepath = tracer.save()

            name = filepath.stem  # without .json
            # Pattern: <agent_name>_<8char-run-id-prefix>_<YYYYmmddTHHMMSS>
            # Example: my_agent_runa1b2c_20260705T140907
            assert name.startswith("my_agent_")
            assert filepath.suffix == ".json"

            # Extract the timestamp portion (after the last underscore)
            # run_id[:8] may itself contain underscores, so search for ISO-ish timestamp
            import re
            # Match: ends with _YYYYmmddTHHMMSS
            assert re.search(r"_\d{8}T\d{6}$", name), f"Expected timestamp suffix, got: {name}"

    def test_multiple_records_increment_step(self):
        tracer = AgentTracer(agent_name="test")
        tracer.record(type="llm_call", input={"n": 1}, output={})
        tracer.record(type="tool_call", input={"n": 2}, output={})
        tracer.record(type="tool_result", input={}, output={"n": 2})

        run = tracer.get_trace()
        assert run.total_steps == 3
        assert run.events[0].step == 1
        assert run.events[1].step == 2
        assert run.events[2].step == 3

    def test_record_with_metadata(self):
        tracer = AgentTracer(agent_name="test")
        tracer.record(
            type="llm_call",
            input={"prompt": "x"},
            output={"text": "y"},
            metadata={"duration_ms": 500, "token_count": 100},
        )
        event = tracer.get_trace().events[0]
        assert event.metadata == {"duration_ms": 500, "token_count": 100}

    def test_save_finalizes_run_status(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tracer = AgentTracer(agent_name="test", output_dir=tmpdir)
            tracer.record(type="llm_call", input={}, output={})
            filepath = tracer.save()

            # status should be "completed" when no failures
            content = json.loads(filepath.read_text(encoding="utf-8"))
            assert content["status"] == "completed"

    def test_run_id_is_unique(self):
        t1 = AgentTracer(agent_name="a")
        t2 = AgentTracer(agent_name="b")
        assert t1.run_id != t2.run_id


class TestRecordFunction:
    """Test the standalone record() helper."""

    def test_record_with_active_tracer(self):
        tracer = AgentTracer(agent_name="test")
        # Simulate active tracer
        import agentlens.tracer as tracer_mod

        tracer_mod._current_tracer = tracer
        try:
            record("llm_call", input={"x": 1}, output={"y": 2})
            run = tracer.get_trace()
            assert len(run.events) == 1
        finally:
            tracer_mod._current_tracer = None

    def test_record_without_active_tracer_raises(self):
        import agentlens.tracer as tracer_mod

        tracer_mod._current_tracer = None
        with pytest.raises(RuntimeError, match="No active AgentTracer"):
            record("llm_call", input={}, output={})
