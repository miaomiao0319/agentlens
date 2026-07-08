```markdown
# Architecture Decision Records (ADR)

Version: 1.0

Last Updated: 2026-07-07

---

# Introduction

This document records important architectural and product decisions made during the development of AgentLens.

These decisions should be considered stable unless there is a strong technical or product reason to change them.

Future contributors should read this document before modifying the architecture.

---

# ADR-001: AgentLens is a Debugger

## Decision

AgentLens is positioned as a debugger for AI Agents.

## Rationale

Existing tools primarily focus on observability, monitoring, or visualization after execution.

AgentLens focuses on interactive debugging during execution inside VS Code.

## Consequences

- Prioritize debugging experience over analytics.
- Prioritize developer workflow over dashboards.
- All future features should improve debugging.

---

# ADR-002: VS Code is the Primary Platform

## Decision

AgentLens is built as a native VS Code Extension.

## Rationale

Developers already build AI applications inside VS Code.

Switching to a browser dashboard interrupts the development workflow.

## Consequences

- No standalone web dashboard.
- No browser-first workflow.
- Future features should integrate naturally into VS Code.

---

# ADR-003: Observer, Not Controller

## Decision

AgentLens only observes execution.

It never changes execution.

## Rationale

Execution frameworks should remain independent.

AgentLens should never become another orchestration framework.

## Consequences

AgentLens will not:

- Retry execution
- Inject prompts
- Modify runtime behavior
- Control execution flow

AgentLens will:

- Observe
- Inspect
- Visualize
- Debug

---

# ADR-004: Event-first Architecture

## Decision

Everything inside AgentLens is represented as Events.

## Rationale

A unified Event model decouples frameworks from the UI.

Every framework can expose different runtime information while sharing the same visualization pipeline.

## Consequences

- SDK produces Events.
- Extension consumes Events.
- UI never depends on framework implementations.

---

# ADR-005: Adapter-based Framework Integration

## Decision

Every supported framework must provide an Adapter.

## Rationale

Different AI frameworks expose completely different APIs and execution models.

Adapters normalize framework-specific information into unified Events.

## Consequences

Supporting a new framework only requires implementing a new Adapter.

The SDK and Extension remain unchanged.

---

# ADR-006: WebSocket as the Communication Layer

## Decision

The SDK communicates with the VS Code Extension through WebSocket.

## Rationale

WebSocket provides real-time, bidirectional communication with low latency.

It is well supported by both Python and Node.js.

## Consequences

- No polling.
- No temporary JSON files.
- No HTTP request loop.

---

# ADR-007: Session-based Debugging

## Decision

Each execution creates one Debug Session.

## Rationale

Debugging should focus on one execution at a time.

Infinite logs become difficult to navigate as projects grow.

## Consequences

Future features such as Replay, Search, Export, and Session Comparison naturally build upon Debug Sessions.

---

# ADR-008: Execution is Represented as a Tree

## Decision

Execution is visualized as a recursive Execution Tree.

## Rationale

Modern AI Agents frequently contain nested execution.

Examples include:

- Tool calling another Tool
- Planner spawning sub-agents
- Tool performing HTTP requests
- Nested LLM calls

A tree structure naturally represents these relationships.

## Consequences

Every Event maintains parent-child relationships.

The UI renders execution recursively.

---

# ADR-009: Current State Has Highest UI Priority

## Decision

The Current State panel is always displayed at the top of the Extension.

## Rationale

Developers first want to know what the Agent is doing now.

Historical execution is secondary.

## Consequences

Current State always remains visible regardless of session size.

---

# ADR-010: Live Metrics are Real-time

## Decision

Metrics update continuously during execution.

## Rationale

Developers should immediately understand runtime health without waiting for execution to finish.

## Examples

- Running Time
- Total Events
- LLM Calls
- Tool Calls
- Errors

---

# ADR-011: UI Pause Does Not Pause Execution

## Decision

Pause only affects the UI.

The Agent continues running normally.

## Rationale

Execution control belongs to the runtime, not the debugger.

Pausing visualization should never affect application behavior.

## Consequences

Incoming Events continue to be buffered while the UI is paused.

---

# ADR-012: Source Mapping is a Future Core Capability

## Decision

Future versions should support mapping Events back to source code locations.

## Rationale

Developers should be able to navigate directly from runtime events to the code that generated them.

This creates a debugging experience similar to traditional IDE debuggers.

## Status

Planned for a future milestone.

---

# ADR-013: Framework Agnostic by Design

## Decision

AgentLens should never optimize exclusively for a single AI framework.

## Rationale

The architecture must remain extensible as the AI ecosystem evolves.

## Consequences

All framework-specific behavior belongs inside Adapters.

Core architecture remains framework-independent.

---

# ADR-014: Developer Experience is the Highest Priority

## Decision

Every feature should improve the developer debugging experience.

## Evaluation Rule

Before adding a new feature, ask:

> Does this make debugging AI Agents easier inside VS Code?

If the answer is no, the feature likely does not belong in AgentLens.
```
