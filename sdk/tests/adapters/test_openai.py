"""Tests for the OpenAI Adapter — intercepting LLM calls."""

from unittest.mock import MagicMock, patch
from agentlens.event_bus import EventBus
from agentlens.session import SessionManager
from agentlens.adapters.openai import OpenAIAdapter


class TestOpenAIAdapter:
    def test_framework_name(self):
        adapter = OpenAIAdapter()
        assert adapter.framework_name == "openai"

    def test_setup_and_teardown(self):
        adapter = OpenAIAdapter()
        bus = EventBus()
        mgr = SessionManager()

        adapter.setup(bus, mgr)
        assert adapter.is_active

        adapter.teardown()
        assert not adapter.is_active

    def test_intercept_creates_session_and_events(self):
        """Simulate an OpenAI call and verify events are produced."""
        adapter = OpenAIAdapter()
        bus = EventBus()
        mgr = SessionManager()

        received: list = []
        bus.subscribe(lambda e: received.append(e))

        adapter.setup(bus, mgr)

        # Create a mock response
        mock_choice = MagicMock()
        mock_choice.message.content = "Hello from GPT!"
        mock_choice.finish_reason = "stop"

        mock_usage = MagicMock()
        mock_usage.total_tokens = 42

        mock_result = MagicMock()
        mock_result.choices = [mock_choice]
        mock_result.usage = mock_usage

        # Patch the original create and call
        with patch.object(adapter, "_original_create", return_value=mock_result):
            result = adapter._intercept_create(
                model="gpt-4o",
                messages=[{"role": "user", "content": "hi"}],
                temperature=0.7,
            )

        assert result is mock_result

        # Should have generated: AgentStart + LLMCall + LLMResponse
        assert len(received) >= 3
        types = [e.type.value for e in received]
        assert "agent_start" in types
        assert "llm_call" in types
        assert "llm_response" in types

        # Verify LLM call event
        call_events = [e for e in received if e.type.value == "llm_call"]
        assert len(call_events) == 1
        assert call_events[0].model == "gpt-4o"
        assert call_events[0].status.value == "success"

        # Verify LLM response event
        resp_events = [e for e in received if e.type.value == "llm_response"]
        assert len(resp_events) == 1
        assert resp_events[0].content == "Hello from GPT!"
        assert resp_events[0].token_count == 42

        # Parent-child relationship
        call_id = call_events[0].id
        assert resp_events[0].parent_id == call_id

        adapter.teardown()

    def test_intercept_handles_errors(self):
        """Simulate an OpenAI API error and verify ErrorEvent is produced."""
        adapter = OpenAIAdapter()
        bus = EventBus()
        mgr = SessionManager()

        received: list = []
        bus.subscribe(lambda e: received.append(e))

        adapter.setup(bus, mgr)

        with patch.object(adapter, "_original_create", side_effect=ValueError("API error")):
            try:
                adapter._intercept_create(model="gpt-4o", messages=[])
            except ValueError:
                pass

        # Should have: AgentStart + LLMCall(failed) + ErrorEvent
        error_events = [e for e in received if e.type.value == "error"]
        assert len(error_events) == 1
        assert error_events[0].error_type == "ValueError"
        assert "API error" in error_events[0].error_message

        # LLM call should be failed
        call_events = [e for e in received if e.type.value == "llm_call"]
        assert call_events[0].status.value == "failed"

        adapter.teardown()

    def test_teardown_is_idempotent(self):
        adapter = OpenAIAdapter()
        bus = EventBus()
        mgr = SessionManager()

        adapter.setup(bus, mgr)
        adapter.teardown()
        adapter.teardown()  # second call should not crash
        assert not adapter.is_active

    def test_setup_without_openai_sdk(self):
        """Should not crash if openai is not installed."""
        adapter = OpenAIAdapter()
        bus = EventBus()
        mgr = SessionManager()

        # _install_hook catches ImportError
        adapter.setup(bus, mgr)
        assert adapter.is_active  # still marked active even without the SDK

        adapter.teardown()
