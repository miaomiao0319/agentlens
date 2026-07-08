# AgentLens — AI Agent Debugger for VS Code

> The native debugger for AI Agents inside VS Code.
> Debug AI agents like you debug any other code.

---

## 0. For Claude Code

This file is the **project overview**. For design authority, see `docs/`. For progress, see `STATE.md`.

**Principles:**
- Do not implement features beyond the current milestone
- Do not introduce dependencies or abstractions outside the current scope
- Update `STATE.md` after each milestone
- When facing architectural uncertainty, consult `docs/decisions.md` first

---

## 1. Overview

| Attribute | Value |
|-----------|-------|
| Name | AgentLens |
| Positioning | Native VS Code debugger for AI agents |
| Target Users | Engineers building and debugging AI agents |
| Core Value | Real-time, structured, interactive execution visibility inside the editor |
| Tech Stack | Python SDK + VS Code Extension + WebSocket |

---

## 2. Problem

Modern AI agents (LangChain, LangGraph, OpenAI SDK, CrewAI, custom LLM workflows) suffer from:

- Black-box execution (only final output visible)
- Intermediate step failures are hard to debug
- Tool calls and reasoning steps lack visibility
- Cannot easily compare different runs
- Non-deterministic behavior makes reproduction difficult

Developers currently rely on raw logs, print debugging, and scattered JSON traces. This does not scale for real agent development.

---

## 3. Architecture

```
┌──────────────────────────────────┐
│       User Agent Code            │  Python / LangChain / OpenAI / Custom
└──────────────┬───────────────────┘
               │ Adapters hook into frameworks
               ▼
┌──────────────────────────────────┐
│       AgentLens SDK              │
│  ┌────────────┐  ┌─────────────┐ │
│  │ Adapters   │→│ Event Bus    │ │
│  └────────────┘  └──────┬──────┘ │
│                         │        │
│  ┌──────────────────────┘        │
│  │ WebSocket Server              │
│  └──────────────────────────────┘ │
└──────────────┬───────────────────┘
               │ WebSocket (real-time)
               ▼
┌──────────────────────────────────┐
│    VS Code Extension             │
│  ┌──────────┐ ┌────────────────┐ │
│  │ Current  │ │ Live Metrics   │ │
│  │ State    │ │                │ │
│  ├──────────┤ ├────────────────┤ │
│  │ Sessions │ │ Execution Tree │ │
│  ├──────────┤ ├────────────────┤ │
│  │ Inspector│ │ Context        │ │
│  └──────────┘ └────────────────┘ │
└──────────────────────────────────┘
```

---

## 4. Components

### Python SDK

Runs inside the user's Python environment alongside agent code.

**Responsibilities:**
- Hook into supported frameworks via Adapters
- Produce unified Events from framework activity
- Stream Events to the VS Code Extension over WebSocket

### VS Code Extension

Runs inside the editor, presenting execution data to the developer.

**Responsibilities:**
- Receive Events from the SDK over WebSocket
- Build and manage Debug Sessions
- Render the Execution Tree, Inspector, Current State, Live Metrics, and Context panels

---

## 5. Core Data Model

Everything is an **Event**.

```json
{
  "id": "evt_001",
  "parent_id": null,
  "session_id": "sess_001",
  "timestamp": 1720000000000,
  "duration": 1240,
  "type": "llm_call",
  "status": "success"
}
```

Event types: `llm_call`, `llm_response`, `tool_call`, `tool_result`, `http_request`, `memory_update`, `retrieval`, `embedding`, `error`, `custom`

---

## 6. Design Philosophy

- **Native** — Everything inside VS Code. No browser dashboard.
- **Observer** — Read-only. Never modifies execution.
- **Real-time** — Visualized while the agent runs.
- **Session-based** — Each run = one Debug Session.
- **Event-first** — Every runtime action is one Event.
- **Framework-agnostic** — Adapters translate framework details to unified Events.

---

## 7. Roadmap

See `docs/roadmap.md` for the complete development roadmap.

| Milestone | Status |
|-----------|--------|
| M1 — SDK Foundation (Schema + EventBus + WebSocket) | 🔄 In Progress |
| M2 — VS Code Extension MVP | 📋 Planned |
| M3 — Debug Session Explorer | 📋 Planned |
| M4 — Execution Tree | 📋 Planned |
| M5 — Inspector | 📋 Planned |
| M6 — Current State & Live Metrics | 📋 Planned |
| M7 — Context Inspection | 📋 Planned |
| M8 — Framework Ecosystem | 📋 Planned |
| M9–14 — Source Mapping, Replay, Search, Plugins, Remote, Multi-lang | 🔮 Future |

---

## 8. Getting Started

```bash
# Install the SDK
cd sdk
pip install -e ".[dev]"

# Run an agent with AgentLens enabled
python examples/simple_agent.py

# Develop the VS Code Extension
cd ../extension
npm install
npm run compile
# Press F5 to launch Extension Development Host
```

---

## 9. Key Decisions

See `docs/decisions.md` for all Architecture Decision Records.

- **ADR-001**: AgentLens is a debugger, not a dashboard
- **ADR-002**: VS Code is the primary (and only) platform
- **ADR-003**: Observer only — never controls execution
- **ADR-004**: Event-first architecture
- **ADR-005**: Adapter-based framework integration
- **ADR-006**: WebSocket communication (no files, no polling)

---

**Project Start:** 2026-07-05
**Version:** 0.1.0-dev
**Last Updated:** 2026-07-08
