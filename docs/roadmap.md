# AgentLens Development Roadmap

Version: 1.0

Last Updated: 2026-07-07

---

# Vision

The long-term vision of AgentLens is to become the native debugging experience for AI Agents inside VS Code.

Development follows an iterative roadmap. Every milestone should deliver a usable product while laying the foundation for future capabilities.

---

# Milestone 1 — SDK Foundation

## Goal

Build the core runtime infrastructure for collecting and streaming execution events.

## Deliverables

- Python SDK
- Adapter Manager
- Event System
- Unified Event Schema
- Event Bus
- WebSocket Server
- Session Management
- Automatic Initialization (`AgentLens.init()`)

## Status

Completed

---

# Milestone 2 — VS Code Extension MVP

## Goal

Create a native VS Code Extension capable of receiving and displaying runtime events.

## Deliverables

- VS Code Extension
- WebSocket Client
- Extension Activation
- Sidebar View Container
- AgentLens Activity Bar Icon
- Connection Status
- Basic Extension Settings

## Status

In Progress

---

# Milestone 3 — Debug Session Explorer

## Goal

Allow developers to inspect every execution as an independent Debug Session.

## Deliverables

- Debug Session List
- Session Switching
- Session Metadata
- Session History
- Automatic Session Creation
- Session Cleanup Strategy

## Status

Planned

---

# Milestone 4 — Execution Tree

## Goal

Visualize Agent execution as a recursive tree.

## Deliverables

- Recursive Tree View
- Expand / Collapse Nodes
- Parent-Child Relationships
- Execution Status
- Running Indicators
- Error Indicators

## Status

Planned

---

# Milestone 5 — Inspector

## Goal

Provide detailed inspection for every runtime Event.

## Deliverables

- General Information
- Input Viewer
- Output Viewer
- Metrics
- Raw Event Data
- Event Metadata

## Status

Planned

---

# Milestone 6 — Current State & Live Metrics

## Goal

Provide real-time visibility into the current execution state.

## Deliverables

- Current Running Node
- Current Tool
- Current LLM
- Elapsed Time
- Token Usage
- Tool Count
- Event Count
- Error Count
- Execution Status

## Status

Planned

---

# Milestone 7 — Context Inspection

## Goal

Help developers understand how the Agent's internal context evolves during execution.

## Deliverables

- Memory Diff
- Variables
- Tool Outputs
- Context Updates
- Intermediate Results

## Status

Planned

---

# Milestone 8 — Framework Ecosystem

## Goal

Support the most popular AI Agent frameworks through a unified Adapter architecture.

## Initial Frameworks

- OpenAI SDK
- LangGraph
- LangChain
- CrewAI

## Future Frameworks

- AutoGen
- Semantic Kernel
- LlamaIndex
- Custom Adapters

## Status

Planned

---

# Milestone 9 — Source Mapping

## Goal

Connect runtime Events directly to source code.

## Deliverables

- Jump to Source
- File & Line Mapping
- Editor Decorations
- Active Code Highlighting

## Status

Planned

---

# Milestone 10 — Replay Engine

## Goal

Replay previous Debug Sessions for offline analysis.

## Deliverables

- Session Replay
- Timeline Playback
- Step Navigation
- Replay Speed Control

## Status

Planned

---

# Milestone 11 — Search & Filtering

## Goal

Allow developers to quickly locate important runtime Events.

## Deliverables

- Event Search
- Tool Filter
- LLM Filter
- Error Filter
- Time Filter

## Status

Planned

---

# Milestone 12 — Plugin API

## Goal

Allow third-party developers to extend AgentLens.

## Deliverables

- Plugin SDK
- Custom Panels
- Custom Event Types
- Custom Renderers

## Status

Future

---

# Milestone 13 — Remote Debugging

## Goal

Support debugging Agents running outside the local VS Code environment.

## Deliverables

- Remote Connection
- Authentication
- Multiple Runtime Support
- Secure Event Streaming

## Status

Future

---

# Milestone 14 — Multi-language SDK

## Goal

Expand AgentLens beyond the Python ecosystem.

## Planned SDKs

- TypeScript
- JavaScript
- Go
- Rust
- Java

## Status

Future

---

# Long-term Vision

AgentLens aims to become the standard debugging infrastructure for AI Agents.

Developers should be able to:

- Install AgentLens once.
- Continue using their preferred AI framework.
- Debug every Agent directly inside VS Code.
- Understand complex Agent behavior in real time.
- Navigate seamlessly between runtime execution and source code.

The ultimate goal is to make debugging AI Agents as natural and productive as debugging traditional software.