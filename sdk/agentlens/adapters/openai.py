"""OpenAI Adapter — captures LLM calls made through the OpenAI Python SDK.

This adapter monkey-patches ``openai.resources.chat.completions.Completions.create``
to intercept LLM calls and produce ``LLMCallEvent`` / ``LLMResponseEvent`` / ``ErrorEvent``.
"""

from __future__ import annotations

import time
from typing import Any

from agentlens.adapters.base import BaseAdapter
from agentlens.event_bus import EventBus
from agentlens.schema import (
    LLMCallEvent,
    LLMResponseEvent,
    ErrorEvent,
    AgentStartEvent,
    AgentEndEvent,
)
from agentlens.session import SessionManager


class OpenAIAdapter(BaseAdapter):
    """Captures OpenAI SDK chat completion calls.

    Hooks into ``openai.chat.completions.create()`` via monkey-patching.
    """

    def __init__(self) -> None:
        self._event_bus: EventBus | None = None
        self._session_manager: SessionManager | None = None
        self._active = False
        self._original_create: Any = None
        self._session_id: str | None = None

    # --- BaseAdapter interface ---

    @property
    def framework_name(self) -> str:
        return "openai"

    @property
    def is_active(self) -> bool:
        return self._active

    def setup(self, event_bus: EventBus, session_manager: SessionManager) -> None:
        self._event_bus = event_bus
        self._session_manager = session_manager
        self._active = True
        self._install_hook()

    def teardown(self) -> None:
        self._active = False
        self._remove_hook()
        self._event_bus = None
        self._session_manager = None

    # --- hook management ---

    def _install_hook(self) -> None:
        """Monkey-patch the OpenAI completions.create method."""
        try:
            import openai
            from openai.types.chat import ChatCompletion

            self._original_create = openai.chat.completions.create

            adapter = self  # capture for closure

            def patched_create(*args: Any, **kwargs: Any) -> ChatCompletion:
                return adapter._intercept_create(*args, **kwargs)

            patched_create._agentlens_original = self._original_create  # type: ignore[attr-defined]
            openai.chat.completions.create = patched_create  # type: ignore[assignment]
        except ImportError:
            # OpenAI SDK not installed — no-op, events won't be captured
            pass

    def _remove_hook(self) -> None:
        """Restore the original OpenAI method."""
        try:
            import openai

            if self._original_create is not None:
                openai.chat.completions.create = self._original_create  # type: ignore[assignment]
                self._original_create = None
        except ImportError:
            pass

    # --- interception ---

    def _intercept_create(self, *args: Any, **kwargs: Any) -> Any:
        """Wrap an OpenAI chat completion call with AgentLens events."""
        bus = self._event_bus
        mgr = self._session_manager

        if bus is None or mgr is None or self._original_create is None:
            # Adapter not properly set up — fall through to original
            if self._original_create:
                return self._original_create(*args, **kwargs)
            return None

        # Auto-create a session if none is active
        session = mgr.get_active_session()
        if session is None:
            session = mgr.create_session(framework="openai", agent_name="openai_agent")
            bus.publish(AgentStartEvent(
                session_id=session.session_id,
                agent_name="openai_agent",
                framework="openai",
            ))

        model = kwargs.get("model", "unknown")
        messages = kwargs.get("messages", [])

        # Publish LLM call event
        call_event = LLMCallEvent(
            session_id=session.session_id,
            model=model,
            messages=list(messages) if isinstance(messages, list) else [{"content": str(messages)}],
            parameters={k: v for k, v in kwargs.items() if k not in ("model", "messages")},
        )
        call_event.mark_running()
        bus.publish(call_event)

        t0 = time.perf_counter()

        try:
            result = self._original_create(*args, **kwargs)
            elapsed_ms = int((time.perf_counter() - t0) * 1000)
            call_event.mark_success()
            call_event.duration = elapsed_ms

            # Extract response details
            choice = result.choices[0] if result.choices else None
            if choice and choice.message and hasattr(choice.message, 'content'):
                content = choice.message.content or ""
            else:
                content = ""
            finish = choice.finish_reason if choice else ""
            usage = result.usage

            response_event = LLMResponseEvent(
                parent_id=call_event.id,
                session_id=session.session_id,
                model=model,
                content=content or "",
                token_count=usage.total_tokens if usage else 0,
                finish_reason=str(finish) if finish else "",
            )
            response_event.mark_success()
            response_event.duration = elapsed_ms
            bus.publish(response_event)

            return result

        except Exception as exc:
            elapsed_ms = int((time.perf_counter() - t0) * 1000)
            call_event.mark_failed()
            call_event.duration = elapsed_ms

            error_event = ErrorEvent(
                parent_id=call_event.id,
                session_id=session.session_id,
                error_type=type(exc).__name__,
                error_message=str(exc),
                source_event_id=call_event.id,
            )
            error_event.mark_failed()
            error_event.duration = elapsed_ms
            bus.publish(error_event)

            raise
