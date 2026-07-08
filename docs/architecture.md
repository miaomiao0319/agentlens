````markdown
# AgentLens Architecture

Version: 1.0

Last Updated: 2026-07-07

---

# 1. Overview

AgentLens is built on a layered, event-driven architecture designed for extensibility, real-time debugging, and framework independence.

The core architectural principle is:

> Everything is an Event.

Framework-specific execution is converted into a unified Event model before entering the AgentLens runtime. The VS Code Extension only consumes these unified Events and never depends on framework-specific implementations.

---

# 2. High-Level Architecture

```text
+-----------------------------------------------------------+
|                   VS Code Extension                       |
|                                                           |
|  Current State                                            |
|  Live Metrics                                             |
|  Debug Sessions                                           |
|  Execution Tree                                           |
|  Inspector                                                |
|  Context                                                  |
+---------------------------▲-------------------------------+
                            │
                         WebSocket
                            │
+---------------------------▼-------------------------------+
|                     AgentLens SDK                         |
|                                                           |
|  Adapter Manager                                          |
|  Event Bus                                                |
|  Event Dispatcher                                         |
+---------------------------▲-------------------------------+
                            │
+---------------------------▼-------------------------------+
|                  Framework Adapters                       |
|                                                           |
|  OpenAI Adapter                                           |
|  LangGraph Adapter                                        |
|  LangChain Adapter                                        |
|  CrewAI Adapter                                           |
|  Custom Adapter                                           |
+---------------------------▲-------------------------------+
                            │
+---------------------------▼-------------------------------+
|                  AI Frameworks / SDKs                     |
+-----------------------------------------------------------+
```

---

# 3. Why This Architecture

AgentLens intentionally separates framework integration, runtime instrumentation, event transport, and user interface.

This architecture provides the following benefits:

- Framework-independent UI
- Simple support for new AI frameworks
- Loose coupling between SDK and Extension
- Consistent debugging experience across all frameworks
- Long-term maintainability and scalability

Supporting a new framework only requires implementing a new Adapter without modifying the SDK or the VS Code Extension.

---

# 4. Runtime Data Flow

Every execution follows the same pipeline.

```text
Framework
    ↓
Framework Adapter
    ↓
Unified Event
    ↓
Event Bus
    ↓
WebSocket
    ↓
VS Code Extension
    ↓
Debug Session
    ↓
Execution Tree
    ↓
Inspector
```

Regardless of which framework is used, every runtime action is converted into the same unified Event model.

---

# 5. Adapter Architecture

Framework integrations are implemented through Adapters.

Each Adapter converts framework-specific runtime information into AgentLens Events.

Examples:

```text
OpenAI SDK
    ↓
OpenAI Adapter
    ↓
Unified Event
```

```text
LangGraph
    ↓
LangGraph Adapter
    ↓
Unified Event
```

Future adapters include:

- CrewAI
- AutoGen
- Semantic Kernel
- Custom Frameworks

Each Adapter is responsible for:

- Hooking framework APIs
- Tracking execution lifecycle
- Producing Events
- Maintaining parent-child relationships
- Sending Events to the Event Bus

Adapters never render UI and never communicate directly with the VS Code Extension.

---

# 6. Event System

Events are the fundamental runtime unit inside AgentLens.

Every meaningful runtime activity becomes one Event.

Supported Event categories include:

- LLM Event
- Tool Event
- Memory Event
- HTTP Event
- Database Event
- Retrieval Event
- Embedding Event
- Error Event
- Custom Event

Each Event shares a common schema.

```json
{
  "id": "",
  "parent_id": "",
  "session_id": "",
  "timestamp": "",
  "duration": 0,
  "type": "",
  "status": ""
}
```

Specific Event types extend this schema with their own metadata.

---

# 7. Event Bus

The Event Bus is the core runtime component inside the SDK.

Its responsibilities include:

- Receiving Events
- Ordering Events
- Maintaining Session Context
- Broadcasting Events
- Streaming Events to the Extension

The Event Bus does not know which framework produced an Event.

It only processes unified Events.

---

# 8. Communication Layer

The SDK communicates with the VS Code Extension through WebSocket.

Reasons for choosing WebSocket:

- Real-time event streaming
- Low latency
- Full-duplex communication
- Mature Python ecosystem
- Mature Node.js ecosystem

No polling is required.

No temporary files are generated.

---

# 9. Debug Session Model

Each execution creates one Debug Session.

```text
Run #18
├── Event
├── Event
├── Event
└── Event
```

Sessions are completely independent.

Future capabilities built upon Sessions include:

- Replay
- Search
- Export
- Session Comparison
- Crash Analysis

---

# 10. Execution Tree

Execution is represented as a recursive tree.

```text
Planner
├── GPT-5.5
├── Search Tool
│   ├── HTTP Request
│   └── Parse JSON
├── Memory Update
└── Final Response
```

The Execution Tree is generated entirely from parent-child Event relationships.

Nested execution naturally becomes nested Events.

This recursive structure enables developers to inspect complex Agent workflows with the same mental model used by modern debuggers.

---

# 11. Scalability

The architecture is designed to scale in three dimensions.

## Framework Scalability

Support new frameworks by implementing new Adapters.

## Event Scalability

Support new runtime capabilities by introducing new Event types.

## UI Scalability

Build new visualizations without changing the SDK or Adapter layer.

---

# 12. Future Architecture

Future versions of AgentLens may introduce:

- Replay Engine
- Source Mapping
- Plugin API
- Remote Debugging
- Multi-language SDKs

All future features should build upon the existing Event architecture rather than introducing new communication or runtime models.
````
