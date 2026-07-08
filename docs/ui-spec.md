# AgentLens UI Specification

Version: 1.0

Last Updated: 2026-07-07

---

# 1. Design Goals

The AgentLens user interface is designed to make debugging AI Agents feel familiar to developers who already use modern IDE debuggers.

The UI should provide immediate visibility into what an Agent is doing, why it is doing it, and how execution progresses over time.

The interface emphasizes clarity, hierarchy, and real-time feedback rather than dashboards or analytics.

---

# 2. Design Principles

## Native

AgentLens lives entirely inside VS Code.

Developers should never need to switch to a browser or external application.

---

## Debugger First

Every UI component should help developers understand or debug execution.

If a component does not improve debugging, it does not belong in AgentLens.

---

## Real-time

The interface updates continuously while the Agent is executing.

Execution should be observable without refreshing or reloading.

---

## Progressive Disclosure

The interface should show the most important information first while allowing deeper inspection on demand.

Simple tasks should remain simple.

Complex executions should remain understandable.

---

## Consistency

Every Event should be presented using the same interaction model.

Developers should never need to learn different behaviors for different frameworks.

---

# 3. Extension Layout

The AgentLens Extension appears as a dedicated Activity Bar icon inside VS Code.

Opening the extension displays the following layout.

```text
AgentLens
────────────────────────────────────────

🟢 Current State

────────────────────────────────────────

📊 Live Metrics

────────────────────────────────────────

📁 Debug Sessions

────────────────────────────────────────

🌳 Execution Tree

────────────────────────────────────────

🔍 Inspector

────────────────────────────────────────

🧠 Context
```

The layout remains fixed.

Only the content inside each section changes.

---

# 4. Current State

Current State is always displayed at the top.

It represents what the Agent is doing right now.

Displayed information includes:

- Execution Status
- Current Node
- Current Tool
- Current LLM
- Current Task
- Elapsed Time

Example:

```text
Status

🟢 Running

Current Step

Calling Search Tool

Elapsed

12.4 s
```

---

# 5. Live Metrics

Live Metrics provides continuously updated execution statistics.

Metrics include:

- Total Events
- LLM Calls
- Tool Calls
- Token Usage
- Execution Time
- Error Count

Metrics update in real time throughout execution.

---

# 6. Debug Sessions

Every execution creates one Debug Session.

Example:

```text
Today

Run #18

Run #17

Run #16
```

Each session stores:

- Start Time
- End Time
- Duration
- Status
- Framework
- Event Count

Selecting a session loads its Execution Tree and Inspector.

---

# 7. Execution Tree

Execution Tree is the primary visualization of Agent execution.

Execution is displayed as a recursive tree.

Example:

```text
Planner
├── GPT-5.5
├── Search Tool
│   ├── HTTP Request
│   ├── Parse JSON
│   └── Cache Lookup
├── Memory Update
└── Final Response
```

Each node displays:

- Icon
- Name
- Status
- Duration

Nodes support:

- Expand
- Collapse
- Auto Expand Current Node
- Error Highlighting

Nested execution can continue indefinitely.

---

# 8. Inspector

Selecting any node opens the Inspector.

The Inspector contains multiple tabs.

## General

Displays:

- Event Type
- Status
- Duration
- Timestamp
- Parent Event
- Session

---

## Input

Displays the original input.

Examples:

- Prompt
- Tool Parameters
- HTTP Request
- Function Arguments

---

## Output

Displays execution results.

Examples:

- LLM Response
- Tool Result
- API Response

---

## Metrics

Displays execution statistics.

Examples:

- Latency
- Token Usage
- Retry Count
- Cost (Future)

---

## Raw

Displays the complete Event JSON.

Primarily intended for advanced users and debugging.

---

# 9. Context Panel

The Context panel displays how the Agent's internal state evolves.

Sections include:

## Memory Diff

Displays additions, updates, and removals from memory.

---

## Variables

Displays intermediate variables generated during execution.

---

## Tool Outputs

Displays outputs from previously executed tools.

---

## Intermediate Results

Displays temporary reasoning artifacts when available.

---

# 10. Timeline Behavior

The Execution Tree updates in real time.

New Events appear automatically.

The currently executing node is highlighted.

Finished nodes remain visible.

Failed nodes are highlighted.

---

# 11. Pause UI

Users may pause UI updates.

Pausing affects only visualization.

The Agent continues executing normally.

Incoming Events continue to be buffered.

Resuming immediately displays the latest execution state.

---

# 12. Empty State

When no Agent is running, the Extension displays:

```text
No Active Session

Start an AI Agent to begin debugging.

AgentLens will automatically detect supported frameworks.
```

---

# 13. Loading State

When connecting to the SDK:

```text
Connecting to AgentLens SDK...
```

Connection status is displayed until communication is established.

---

# 14. Error State

If the Extension loses connection:

```text
Disconnected

Unable to connect to AgentLens SDK.

Check whether AgentLens.init() has been called.
```

The Extension should automatically attempt to reconnect.

---

# 15. Notifications

AgentLens minimizes intrusive notifications.

Notifications are reserved for:

- Connection Lost
- SDK Version Mismatch
- Extension Update Available
- Unsupported Framework

Normal execution should never generate popup notifications.

---

# 16. Future UI Features

Planned UI enhancements include:

- Source Mapping
- Jump to Source
- Editor Decorations
- Session Replay
- Event Search
- Event Filtering
- Keyboard Shortcuts
- Mini Map
- Performance Heatmap
- Multi-Agent View
- Split Inspector

---

# 17. UI Principles Summary

The AgentLens interface should always answer the following questions as quickly as possible:

1. What is the Agent doing now?

2. What has already happened?

3. Why did this happen?

4. What data entered and left this step?

5. Where in the execution did the problem occur?

6. How can the developer navigate from runtime behavior back to the source code?

Every UI component should contribute to answering one or more of these questions.