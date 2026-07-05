# AgentLens — Project State

> This file tracks real-time development progress.
> It is updated after every milestone completion.

---

## 🧭 Current Phase

Phase: Phase 2 — Web UI Core Implementation
Status: Ready to Start

---

## 📌 Active Milestone

- [ ] Milestone 2.1: UI base framework (NEXT)
- [ ] Milestone 2.2: Event list panel (NOT STARTED)
- [ ] Milestone 2.3: Event detail panel (NOT STARTED)
- [ ] Milestone 2.4: Overall layout integration (NOT STARTED)

👉 Current working task:
> Starting Phase 2 — Web UI core implementation.
> First up: M2.1 — TypeScript types, file upload, JSON parsing.

---

## 🧱 Completed Work

### Phase 0
- [x] README finalized
- [x] Monorepo structure designed
- [x] GitHub repo created
- [x] M0.1: Directory structure initialized
  - `sdk/` Python project with pyproject.toml (pydantic >= 2.0)
  - `ui/` Next.js 16 + TypeScript + Tailwind CSS + App Router
  - `traces/` directory (git ignored)
  - `.gitignore` configured

### Phase 1
- [x] M1.1: Data models (`sdk/agentlens/models.py`)
  - `TraceEvent` Pydantic model (6 event types, auto UUID, auto timestamp)
  - `TraceRun` Pydantic model (auto run_id, add_event, finalize)
  - 15 unit tests passing
- [x] M1.2: Tracer core (`sdk/agentlens/tracer.py`)
  - `AgentTracer` class: `record()`, `save()`, `get_trace()`
  - File naming: `{agent_name}_{run_id[:8]}_{timestamp}.json`
  - 11 unit tests passing
- [x] M1.3: Decorator & context manager (`sdk/agentlens/tracer.py`)
  - `@trace(name="...")` decorator with auto agent_start/agent_end
  - `with session("...")` context manager
  - Exception handling: auto-mark `status: "failed"` on error
  - Standalone `record()` helper function
  - 8 unit tests passing
- [x] M1.4: Example agent (`sdk/examples/simple_agent.py`)
  - Mock LLM + web_search tool workflow
  - Generated trace: 5 events (agent_start, llm_call, tool_call, tool_result, agent_end)
  - Trace validated against contract

---

## 🚧 In Progress

- (nothing currently in progress)

---

## 🧪 Known Issues

- None

---

## 📦 Latest Commit Summary

- Phase 0 + Phase 1 complete: SDK models, tracer, decorator, example agent
- Total: 34 unit tests, all passing
- Trace JSON contract validated end-to-end

---

## 🧠 Notes for Claude Code

- Always check this file before starting work
- Do not jump ahead of current milestone
- Update this file after completing any milestone
- README.md is the Source of Truth for requirements
- STATE.md is the Source of Truth for progress tracking
