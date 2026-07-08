"""Tests for Session and SessionManager."""

import pytest
from agentlens.session import Session, SessionManager
from agentlens.schema import (
    LLMCallEvent,
    ToolCallEvent,
    AgentStartEvent,
    ErrorEvent,
)


class TestSession:
    def test_create_session(self):
        s = Session(session_id="sess_1", framework="openai", agent_name="demo")
        assert s.session_id == "sess_1"
        assert s.framework == "openai"
        assert s.agent_name == "demo"
        assert s.status == "running"
        assert s.event_count == 0
        assert s.created_at > 0

    def test_add_event(self):
        s = Session(session_id="s_1", framework="test", agent_name="a")
        event = LLMCallEvent(model="gpt-4o")
        s.add_event(event)

        assert s.event_count == 1
        assert event.session_id == "s_1"

    def test_multiple_events(self):
        s = Session(session_id="s_1", framework="test", agent_name="a")
        s.add_event(AgentStartEvent(agent_name="a", framework="test"))
        s.add_event(LLMCallEvent(model="gpt-4o"))
        s.add_event(ToolCallEvent(tool_name="search"))

        assert s.event_count == 3
        assert s.events[0].type.value == "agent_start"
        assert s.events[1].type.value == "llm_call"
        assert s.events[2].type.value == "tool_call"

    def test_end_session(self):
        s = Session(session_id="s_1", framework="test", agent_name="a")
        s.end(status="completed")
        assert s.status == "completed"
        assert s.ended_at is not None

    def test_end_session_defaults_to_completed(self):
        s = Session(session_id="s_1", framework="test", agent_name="a")
        s.end()
        assert s.status == "completed"

    def test_duration(self):
        s = Session(session_id="s_1", framework="test", agent_name="a")
        assert s.duration_ms >= 0

    def test_get_tree_returns_sorted(self):
        s = Session(session_id="s_1", framework="test", agent_name="a")
        e1 = LLMCallEvent()
        e2 = ToolCallEvent(tool_name="later")
        s.add_event(e1)
        s.add_event(e2)

        tree = s.get_tree()
        assert tree[0].timestamp <= tree[1].timestamp

    def test_to_dict(self):
        s = Session(session_id="s_1", framework="test", agent_name="demo")
        s.add_event(LLMCallEvent())
        s.end()

        d = s.to_dict()
        assert d["session_id"] == "s_1"
        assert d["framework"] == "test"
        assert d["agent_name"] == "demo"
        assert d["status"] == "completed"
        assert d["event_count"] == 1
        assert d["duration_ms"] >= 0


class TestSessionManager:
    def test_create_session(self):
        mgr = SessionManager()
        session = mgr.create_session(framework="openai", agent_name="demo")

        assert session.session_id.startswith("sess_")
        assert mgr.session_count == 1
        assert mgr.get_active_session() is session

    def test_create_multiple_sessions(self):
        mgr = SessionManager()
        s1 = mgr.create_session(agent_name="a")
        s2 = mgr.create_session(agent_name="b")

        assert mgr.session_count == 2
        assert s1.session_id != s2.session_id

    def test_get_session(self):
        mgr = SessionManager()
        s = mgr.create_session(agent_name="demo")
        assert mgr.get_session(s.session_id) is s
        assert mgr.get_session("nonexistent") is None

    def test_add_event_to_session(self):
        mgr = SessionManager()
        s = mgr.create_session(agent_name="demo")
        event = LLMCallEvent(model="gpt-4o")
        mgr.add_event(s.session_id, event)

        assert s.event_count == 1

    def test_add_event_to_nonexistent_session_raises(self):
        mgr = SessionManager()
        with pytest.raises(KeyError):
            mgr.add_event("nonexistent", LLMCallEvent())

    def test_list_sessions_newest_first(self):
        import time
        mgr = SessionManager()
        s1 = mgr.create_session(agent_name="first")
        time.sleep(0.002)  # ensure distinct timestamps
        s2 = mgr.create_session(agent_name="second")

        sessions = mgr.list_sessions()
        assert sessions[0].agent_name == "second"
        assert sessions[1].agent_name == "first"

    def test_end_session(self):
        mgr = SessionManager()
        s = mgr.create_session(agent_name="demo")
        mgr.end_session(s.session_id, status="failed")

        assert s.status == "failed"
        assert s.ended_at is not None
        assert mgr.get_active_session() is None

    def test_end_nonexistent_session_raises(self):
        mgr = SessionManager()
        with pytest.raises(KeyError):
            mgr.end_session("nonexistent")

    def test_active_session_switches_on_create(self):
        mgr = SessionManager()
        s1 = mgr.create_session(agent_name="a")
        s2 = mgr.create_session(agent_name="b")

        assert mgr.get_active_session() is s2
        assert mgr.get_active_session() is not s1

    def test_children_preserve_parent_relationship(self):
        """Events with parent_id maintain the tree structure."""
        mgr = SessionManager()
        s = mgr.create_session(agent_name="demo")

        parent = LLMCallEvent(id="parent_evt")
        child = ToolCallEvent(id="child_evt", parent_id="parent_evt")

        mgr.add_event(s.session_id, parent)
        mgr.add_event(s.session_id, child)

        events = s.events
        assert events[0].parent_id is None
        assert events[1].parent_id == "parent_evt"
