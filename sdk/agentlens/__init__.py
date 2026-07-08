"""
AgentLens — AI Agent Debugger for VS Code

Native debugging experience for AI agents, inside your editor.
"""

__version__ = "0.1.0"

from agentlens.schema import (
    EventType,
    EventStatus,
    BaseEvent,
    LLMCallEvent,
    LLMResponseEvent,
    ToolCallEvent,
    ToolResultEvent,
    HTTPRequestEvent,
    DatabaseQueryEvent,
    MemoryUpdateEvent,
    RetrievalEvent,
    EmbeddingEvent,
    ErrorEvent,
    AgentStartEvent,
    AgentEndEvent,
    CustomEvent,
    parse_event,
)
from agentlens.event_bus import EventBus
from agentlens.session import Session, SessionManager
from agentlens.server import AgentLensServer
from agentlens.adapters import BaseAdapter, AdapterManager, OpenAIAdapter
from agentlens.bootstrap import init, shutdown, get_runtime

__all__ = [
    # Schema
    "EventType",
    "EventStatus",
    "BaseEvent",
    "LLMCallEvent",
    "LLMResponseEvent",
    "ToolCallEvent",
    "ToolResultEvent",
    "HTTPRequestEvent",
    "DatabaseQueryEvent",
    "MemoryUpdateEvent",
    "RetrievalEvent",
    "EmbeddingEvent",
    "ErrorEvent",
    "AgentStartEvent",
    "AgentEndEvent",
    "CustomEvent",
    "parse_event",
    # Event Bus
    "EventBus",
    # Session
    "Session",
    "SessionManager",
    # Server
    "AgentLensServer",
    # Adapters
    "BaseAdapter",
    "AdapterManager",
    "OpenAIAdapter",
    # Bootstrap
    "init",
    "shutdown",
    "get_runtime",
]
