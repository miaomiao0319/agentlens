"""Auto-bootstrap — one line to start AgentLens debugging.

``agentlens.init()`` is the single entry point for users. It creates the full
runtime stack: EventBus + SessionManager + AgentLensServer, auto-detects
installed frameworks, and activates the corresponding Adapters.
"""

from __future__ import annotations

import threading

from agentlens.adapters.manager import AdapterManager
from agentlens.adapters.openai import OpenAIAdapter
from agentlens.event_bus import EventBus
from agentlens.server import AgentLensServer
from agentlens.session import SessionManager

# ---------------------------------------------------------------------------
# Adapter auto-detection registry
# ---------------------------------------------------------------------------
# Map of {framework_name: (adapter_class, module_to_check_for_import)}
_AUTO_DETECT = [
    ("openai", OpenAIAdapter, "openai"),
    # Future adapters added here:
    # ("langgraph", LangGraphAdapter, "langgraph"),
    # ("langchain", LangChainAdapter, "langchain"),
    # ("crewai", CrewAIAdapter, "crewai"),
]


class AgentLensRuntime:
    """Holder for the running AgentLens runtime components.

    Returned by ``init()``. Use ``shutdown()`` to clean up.
    """

    def __init__(self) -> None:
        self.event_bus = EventBus()
        self.session_manager = SessionManager()
        self.adapter_manager = AdapterManager(self.event_bus, self.session_manager)
        self.server = AgentLensServer()
        self.server.attach_event_bus(self.event_bus)
        self.server.attach_session_manager(self.session_manager)

    def shutdown(self) -> None:
        """Stop the server and deactivate all adapters."""
        self.adapter_manager.deactivate_all()
        self.server.stop()

    @property
    def is_running(self) -> bool:
        return self.server.is_running


# ---------------------------------------------------------------------------
# Global runtime singleton
# ---------------------------------------------------------------------------

_runtime: AgentLensRuntime | None = None


def get_runtime() -> AgentLensRuntime | None:
    """Return the current global runtime, or None if ``init()`` hasn't been called."""
    return _runtime


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def init(
    host: str = "127.0.0.1",
    port: int = 9876,
    auto_detect: bool = True,
    adapters: list[str] | None = None,
) -> AgentLensRuntime:
    """Start AgentLens debugging.

    Call once at the beginning of your script. Creates the full runtime stack
    and starts the WebSocket server in a background thread.

    Args:
        host: WebSocket server host (default: 127.0.0.1).
        port: WebSocket server port (default: 9876).
        auto_detect: If True, activate adapters for all detected frameworks.
        adapters: Explicit list of framework names to activate.
                   Overrides auto_detect when provided.

    Returns:
        AgentLensRuntime — use ``.shutdown()`` to clean up.

    Example::

        import agentlens
        agentlens.init()

        # ... your agent code runs normally ...
        # Events are automatically captured and streamed
    """
    global _runtime

    if _runtime is not None and _runtime.is_running:
        # Already initialized — return existing runtime
        return _runtime

    runtime = AgentLensRuntime()
    runtime.server._host = host
    runtime.server._port = port

    # Activate specified adapters
    if adapters:
        for name in adapters:
            _activate_by_name(runtime.adapter_manager, name)
    elif auto_detect:
        _auto_detect_and_activate(runtime.adapter_manager)

    # Start the WebSocket server
    runtime.server.start()

    _runtime = runtime
    return runtime


def _activate_by_name(mgr: AdapterManager, name: str) -> None:
    """Try to activate an adapter by framework name."""
    for fw_name, adapter_cls, _import_check in _AUTO_DETECT:
        if fw_name == name:
            mgr.register(adapter_cls())
            mgr.activate(name)
            return
    # Unknown framework — log warning for the user
    import logging
    logger = logging.getLogger("agentlens")
    logger.warning(
        "Unknown framework '%s' requested. Available: %s",
        name,
        [fw for fw, _, _ in _AUTO_DETECT],
    )


def _auto_detect_and_activate(mgr: AdapterManager) -> None:
    """Detect installed frameworks and activate their adapters."""
    for fw_name, adapter_cls, import_check in _AUTO_DETECT:
        try:
            __import__(import_check)
            adapter = adapter_cls()
            mgr.register(adapter)
            mgr.activate(fw_name)
        except ImportError:
            continue


def shutdown() -> None:
    """Shut down the global AgentLens runtime. No-op if not running."""
    global _runtime
    if _runtime:
        _runtime.shutdown()
        _runtime = None
