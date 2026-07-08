"""Base Adapter — the interface every framework Adapter must implement."""

from __future__ import annotations

from abc import ABC, abstractmethod

from agentlens.event_bus import EventBus
from agentlens.session import SessionManager


class BaseAdapter(ABC):
    """Abstract base for all framework Adapters.

    Each supported framework (OpenAI, LangGraph, LangChain, CrewAI, etc.)
    provides a concrete Adapter that:
    1. Hooks into framework internals (callbacks, monkey-patching, etc.)
    2. Translates framework-specific calls into unified Events
    3. Publishes Events to the EventBus
    4. Teardown removes hooks when deactivated
    """

    @abstractmethod
    def setup(self, event_bus: EventBus, session_manager: SessionManager) -> None:
        """Activate this adapter.

        Called when the adapter is activated. Should register framework hooks
        and prepare to produce Events.
        """
        ...

    @abstractmethod
    def teardown(self) -> None:
        """Deactivate this adapter.

        Called when the adapter is deactivated. Should remove all hooks
        and clean up any state. Must be idempotent.
        """
        ...

    @property
    @abstractmethod
    def framework_name(self) -> str:
        """Unique identifier for the framework (e.g. 'openai', 'langgraph')."""
        ...

    @property
    def is_active(self) -> bool:
        """Whether this adapter is currently active."""
        return False
