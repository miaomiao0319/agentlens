"""Adapter Manager — registers, activates, and deactivates Adapters."""

from __future__ import annotations

from agentlens.adapters.base import BaseAdapter
from agentlens.event_bus import EventBus
from agentlens.session import SessionManager


class AdapterManager:
    """Registry of all available Adapters.

    Manages the lifecycle of adapters: registration, activation, deactivation.
    Only one adapter can be active at a time per framework.
    """

    def __init__(self, event_bus: EventBus, session_manager: SessionManager) -> None:
        self._event_bus = event_bus
        self._session_manager = session_manager
        self._adapters: dict[str, BaseAdapter] = {}
        self._active: set[str] = set()

    # --- public API ---

    def register(self, adapter: BaseAdapter) -> None:
        """Register an adapter. Does NOT activate it.

        If an adapter with the same framework_name already exists, it is replaced.
        """
        self._adapters[adapter.framework_name] = adapter

    def unregister(self, framework_name: str) -> None:
        """Remove an adapter. Deactivates it first if active."""
        if framework_name in self._active:
            self.deactivate(framework_name)
        self._adapters.pop(framework_name, None)

    def activate(self, framework_name: str) -> None:
        """Activate a registered adapter.

        Raises:
            KeyError: if the adapter is not registered.
        """
        if framework_name in self._active:
            return  # already active

        adapter = self._adapters[framework_name]
        adapter.setup(self._event_bus, self._session_manager)
        self._active.add(framework_name)

    def deactivate(self, framework_name: str) -> None:
        """Deactivate an active adapter. No-op if not active."""
        if framework_name not in self._active:
            return

        adapter = self._adapters.get(framework_name)
        if adapter:
            adapter.teardown()
        self._active.discard(framework_name)

    def deactivate_all(self) -> None:
        """Deactivate all active adapters."""
        for name in list(self._active):
            self.deactivate(name)

    def is_active(self, framework_name: str) -> bool:
        return framework_name in self._active

    def get_active(self) -> list[str]:
        return sorted(self._active)

    def list_registered(self) -> list[str]:
        return sorted(self._adapters.keys())

    @property
    def registered_count(self) -> int:
        return len(self._adapters)

    @property
    def active_count(self) -> int:
        return len(self._active)
