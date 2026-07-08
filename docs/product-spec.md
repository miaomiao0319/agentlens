# AgentLens — Product Specification

> **The native debugger for AI Agents inside VS Code.**

---

## Table of Contents

1. [Overview](#overview)
2. [Core Philosophy](#core-philosophy)
3. [Architecture](#architecture)
4. [Components](#components)
5. [UI Concept](#ui-concept)
6. [Communication](#communication)
7. [First Run Experience](#first-run-experience)
8. [Product Direction](#product-direction)

---

## Overview

AgentLens is an open-source **VS Code extension** and **Python SDK** for debugging AI agents.

It brings the debugging experience developers already know — breakpoints, execution trees, state inspection — and applies it natively to AI agent workloads, without ever leaving VS Code.

**AgentLens is a debugger.**

It is not a dashboard. It is not an observability platform. It is not an agent framework. It does not add a browser-based UI to your workflow. It adds a debugger panel to your editor.

The guiding principle is simple: debugging AI agents should feel as natural as debugging any other Python program.

---

## Core Philosophy

The following principles define what AgentLens is and, equally, what it is not. They are fixed product decisions and must not be changed.

---

### 1. Native

Everything happens inside VS Code.

There is no browser dashboard, no web UI, and no file-upload workflow. Developers open their editor, run their agent, and debug it — all in the same environment they already work in.

---

### 2. Observer

AgentLens observes agent execution. It never influences it.

There is no retry mechanism. There is no prompt injection. There is no execution control. AgentLens is a read-only debugger, not a controller.

This boundary is intentional. Keeping observation separate from control makes AgentLens safe to use in any codebase without risk of unintended side effects.

---

### 3. Real-time

Execution is visualized **while the agent is running**, not after it finishes.

This is essential for debugging long-running or multi-step agents, where waiting for completion before inspecting state is impractical.

---

### 4. Session-based

Every agent execution creates a **Debug Session**.

AgentLens is not an infinite log viewer. Sessions are bounded, inspectable units that correspond directly to a single agent run. This model keeps the UI focused and the data meaningful.

---

### 5. Event-first

The entire system is built around a single abstraction: **Events**.

The Python SDK produces Events. The VS Code Extension consumes Events. The UI renders Events. Framework-specific details never leak into the extension layer — they are translated at the Adapter level into a unified schema before anything else sees them.

This design ensures the extension remains framework-agnostic by construction.

---

## Architecture

AgentLens uses a layered pipeline to normalize framework-specific execution data into a consistent format the extension can render.


### Adapters

Each supported framework ships with its own Adapter. The Adapter is responsible for hooking into framework internals and translating framework-specific calls, callbacks, and metadata into the unified Event schema.

**Current and planned Adapters:**

| Adapter         | Framework     |
|-----------------|---------------|
| OpenAI Adapter  | OpenAI SDK    |
| LangGraph Adapter | LangGraph   |
| LangChain Adapter | LangChain   |
| CrewAI Adapter  | CrewAI        |

Adding support for a new framework means writing a new Adapter. The extension requires no changes.

This architecture guarantees that AgentLens remains framework-agnostic at the extension layer. As new agent frameworks emerge, the system can grow by adding Adapters, not by modifying core components.

---

## Components

AgentLens has exactly two runtime components.

### Python SDK

The SDK runs inside the user's Python environment alongside their agent code.

**Responsibilities:**
- Hook into supported frameworks via Adapters
- Produce unified Events from framework activity
- Stream Events to the VS Code Extension over WebSocket

### VS Code Extension

The Extension runs inside the editor and presents execution data to the developer.

**Responsibilities:**
- Receive Events from the SDK over WebSocket
- Build and manage Debug Sessions
- Render the Execution Tree
- Render the Inspector panel
- Display Current State
- Display Live Metrics

---

## UI Concept

The AgentLens UI is modeled after **Chrome DevTools** and the **VS Code Debugger** — not a dashboard product.

The layout follows a top-down information hierarchy:



### Execution Tree

The Execution Tree is the central UI element of AgentLens and one of its core product features.

It represents the full call structure of an agent run as a recursive tree, where every node corresponds to an Event and may contain child Events. This allows developers to drill into execution paths at any level of depth — from the top-level agent plan down to individual HTTP requests.

**Example:**


Each node in the tree is inspectable. Selecting a node populates the Inspector panel with the relevant state and metadata for that Event.

---

## Communication

The SDK and the Extension communicate exclusively over **WebSocket**.

WebSocket is the only supported communication mechanism for the initial release. This provides low-latency, bidirectional streaming that enables the real-time visualization experience.

No file system polling. No HTTP request-response cycles. No intermediate storage layer.

---

## First Run Experience

Getting started with AgentLens requires three steps:

**1. Install the Python SDK**
```bash
pip install agentlens

import agentlens

agentlens.init()
