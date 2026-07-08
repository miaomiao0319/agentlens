"""Event Bus — the core runtime dispatch for AgentLens Events.

The EventBus is the central nervous system of the SDK. Adapters publish Events
to the bus; the WebSocket server and other subscribers consume them.

The bus is deliberately simple and framework-agnostic. It does not know
which framework produced an Event — it only processes unified Events.
"""

from __future__ import annotations

import threading
from collections.abc import Callable

from agentlens.schema import BaseEvent


class EventBus:
    """Publish-subscribe broker for AgentLens Events.

    Thread-safe. Multiple publishers and subscribers can operate concurrently.
    """

    def __init__(self) -> None:
        self._subscribers: list[Callable[[BaseEvent], None]] = []
        self._lock = threading.Lock()

    # --- public API ---

    def publish(self, event: BaseEvent) -> None:
        """Publish an Event to all subscribers.

        Each subscriber receives the event synchronously in the caller's thread.
        Subscribers that raise exceptions are silently caught so one bad
        subscriber does not break others.
        """
        with self._lock:
            # Snapshot to avoid holding the lock during callbacks
            subs = list(self._subscribers)

        for callback in subs:
            try:
                callback(event)
            except Exception:
                # Never let a broken subscriber kill the pipeline
                pass

    def subscribe(self, callback: Callable[[BaseEvent], None]) -> None:
        """Register a callback to receive all published Events.

        The callback is called synchronously on every ``publish()``.
        It must be fast; if it does I/O, offload to a queue.
        """
        with self._lock:
            if callback not in self._subscribers:
                self._subscribers.append(callback)

    def unsubscribe(self, callback: Callable[[BaseEvent], None]) -> None:
        """Remove a previously registered callback. No-op if not found."""
        with self._lock:
            try:
                self._subscribers.remove(callback)
            except ValueError:
                pass

    @property
    def subscriber_count(self) -> int:
        """Number of active subscribers (useful for testing)."""
        with self._lock:
            return len(self._subscribers)
