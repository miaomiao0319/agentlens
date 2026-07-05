"""Tests for @trace decorator and session() context manager — Milestone 1.3."""

import json
import tempfile
from pathlib import Path

import pytest
from agentlens.tracer import AgentTracer, trace, session, record, get_current_tracer


# ---------------------------------------------------------------------------
# @trace decorator tests
# ---------------------------------------------------------------------------
class TestTraceDecorator:
    """Acceptance criteria per README M1.3."""

    def test_basic_decorator_generates_trace_file(self):
        with tempfile.TemporaryDirectory() as tmpdir:

            @trace(name="my_agent")
            def run_agent(query):
                record(
                    "llm_call",
                    input={"prompt": query},
                    output={"text": "result"},
                )
                return "done"

            # Patch output_dir before running
            import agentlens.tracer as tmod
            original_dir = None

            # Monkey-patch AgentTracer to use tempdir
            original_init = AgentTracer.__init__

            def patched_init(self, agent_name="unknown", output_dir="./traces"):
                original_init(self, agent_name=agent_name, output_dir=tmpdir)

            AgentTracer.__init__ = patched_init
            try:
                result = run_agent("test query")
                assert result == "done"
            finally:
                AgentTracer.__init__ = original_init

            # Verify trace file was generated
            files = list(Path(tmpdir).glob("my_agent_*.json"))
            assert len(files) == 1

            content = json.loads(files[0].read_text(encoding="utf-8"))
            event_types = [e["type"] for e in content["events"]]
            assert "agent_start" in event_types
            assert "llm_call" in event_types
            assert "agent_end" in event_types
            assert content["status"] == "completed"

    def test_decorator_without_name_uses_function_name(self):
        with tempfile.TemporaryDirectory() as tmpdir:

            @trace
            def my_custom_agent():
                record("llm_call", input={}, output={})
                return "ok"

            original_init = AgentTracer.__init__

            def patched_init(self, agent_name="unknown", output_dir="./traces"):
                original_init(self, agent_name=agent_name, output_dir=tmpdir)

            AgentTracer.__init__ = patched_init
            try:
                my_custom_agent()
            finally:
                AgentTracer.__init__ = original_init

            files = list(Path(tmpdir).glob("my_custom_agent_*.json"))
            assert len(files) == 1

    def test_decorator_records_failure_on_exception(self):
        with tempfile.TemporaryDirectory() as tmpdir:

            @trace(name="failing_agent")
            def fail_agent():
                record("llm_call", input={"x": 1}, output={})
                raise ValueError("something went wrong")

            original_init = AgentTracer.__init__

            def patched_init(self, agent_name="unknown", output_dir="./traces"):
                original_init(self, agent_name=agent_name, output_dir=tmpdir)

            AgentTracer.__init__ = patched_init
            try:
                with pytest.raises(ValueError, match="something went wrong"):
                    fail_agent()
            finally:
                AgentTracer.__init__ = original_init

            files = list(Path(tmpdir).glob("failing_agent_*.json"))
            assert len(files) == 1

            content = json.loads(files[0].read_text(encoding="utf-8"))
            assert content["status"] == "failed"

            # Last event should be agent_end with error
            last_event = content["events"][-1]
            assert last_event["type"] == "agent_end"
            assert last_event["status"] == "failed"
            assert "something went wrong" in last_event["output"]["error"]

    def test_decorator_cleans_up_current_tracer(self):
        with tempfile.TemporaryDirectory() as tmpdir:

            @trace(name="cleanup_test")
            def simple():
                return "done"

            original_init = AgentTracer.__init__

            def patched_init(self, agent_name="unknown", output_dir="./traces"):
                original_init(self, agent_name=agent_name, output_dir=tmpdir)

            AgentTracer.__init__ = patched_init
            try:
                simple()
            finally:
                AgentTracer.__init__ = original_init

            # Tracer should be cleaned up
            assert get_current_tracer() is None

    def test_decorator_called_with_name_parentheses(self):
        """@trace(name='x') vs @trace — both should work."""
        with tempfile.TemporaryDirectory() as tmpdir:

            @trace(name="named")
            def the_func():
                record("llm_call", input={}, output={})
                return "yes"

            original_init = AgentTracer.__init__

            def patched_init(self, agent_name="unknown", output_dir="./traces"):
                original_init(self, agent_name=agent_name, output_dir=tmpdir)

            AgentTracer.__init__ = patched_init
            try:
                assert the_func() == "yes"
            finally:
                AgentTracer.__init__ = original_init

            files = list(Path(tmpdir).glob("named_*.json"))
            assert len(files) == 1


# ---------------------------------------------------------------------------
# session() context manager tests
# ---------------------------------------------------------------------------
class TestSessionContextManager:
    def test_basic_session_generates_trace(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            # Patch to use tempdir
            original_init = AgentTracer.__init__

            def patched_init(self, agent_name="unknown", output_dir="./traces"):
                original_init(self, agent_name=agent_name, output_dir=tmpdir)

            AgentTracer.__init__ = patched_init
            try:
                with session("my_session") as tracer:
                    tracer.record("llm_call", input={"q": "x"}, output={"a": "y"})
                    tracer.record("tool_call", input={}, output={})
            finally:
                AgentTracer.__init__ = original_init

            files = list(Path(tmpdir).glob("my_session_*.json"))
            assert len(files) == 1

            content = json.loads(files[0].read_text(encoding="utf-8"))
            event_types = [e["type"] for e in content["events"]]
            assert "agent_start" in event_types
            assert "llm_call" in event_types
            assert "tool_call" in event_types
            assert "agent_end" in event_types

    def test_session_records_failure_on_exception(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            original_init = AgentTracer.__init__

            def patched_init(self, agent_name="unknown", output_dir="./traces"):
                original_init(self, agent_name=agent_name, output_dir=tmpdir)

            AgentTracer.__init__ = patched_init
            try:
                with pytest.raises(RuntimeError, match="boom"):
                    with session("failing_session") as tracer:
                        tracer.record("llm_call", input={}, output={})
                        raise RuntimeError("boom")
            finally:
                AgentTracer.__init__ = original_init

            files = list(Path(tmpdir).glob("failing_session_*.json"))
            assert len(files) == 1

            content = json.loads(files[0].read_text(encoding="utf-8"))
            assert content["status"] == "failed"

    def test_session_cleans_up_current_tracer(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            original_init = AgentTracer.__init__

            def patched_init(self, agent_name="unknown", output_dir="./traces"):
                original_init(self, agent_name=agent_name, output_dir=tmpdir)

            AgentTracer.__init__ = patched_init
            try:
                with session("cleanup_session") as tracer:
                    pass
            finally:
                AgentTracer.__init__ = original_init

            assert get_current_tracer() is None
