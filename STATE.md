# AgentLens — Project State

> Real-time development progress tracking.
> Updated after every milestone completion.

---

## Current Phase

VS Code Extension: ✅ Complete (M6–M12)
All planned milestones (M0–M12) complete.

---

## Completed Milestones

### SDK (M0–M5) ✅
| M# | Name | Tests |
|----|------|-------|
| M0 | Clean Slate & Restructure | — |
| M1 | Unified Event Schema | 38 |
| M2 | Event Bus & Session Manager | 27 |
| M3 | WebSocket Server | 11 |
| M4 | Adapter Manager + OpenAI | 16 |
| M5 | agentlens.init() Bootstrap | 8 |
| **Total** | | **100** |

### VS Code Extension (M6–M12) ✅
| M# | Name | Key Files |
|----|------|-----------|
| M6 | Extension Scaffold | package.json, esbuild, extension.ts, icon |
| M7 | WS Client + Connection | client.ts, types.ts, StatusPanel |
| M8 | Debug Session List | store.ts, SessionListPanel |
| M9 | Execution Tree | ExecutionTreePanel (recursive TreeView) |
| M10 | Inspector Panel | InspectorPanel (Webview, 5 tabs, JSON viewer) |
| M11 | Current State & Live Metrics | CurrentStatePanel, LiveMetricsPanel |
| M12 | Context Panel | ContextPanel (Memory Diff, Tool Outputs, LLM Responses) |

### Pending
| M# | Name | Status |
|----|------|--------|
| M13 | LangGraph Adapter | 📋 Planned |
| M14 | E2E Integration & Polish | 📋 Planned |

---

## Architecture

```
agentlens/
├── sdk/                    # Python SDK (100 tests, all passing)
│   └── agentlens/
│       ├── schema.py       # 13 event types
│       ├── event_bus.py    # Thread-safe pub/sub
│       ├── session.py      # Debug Session management
│       ├── server.py       # WebSocket server (ws://127.0.0.1:9876)
│       ├── bootstrap.py    # agentlens.init()
│       └── adapters/
│           ├── base.py     # BaseAdapter ABC
│           ├── manager.py  # AdapterManager
│           └── openai.py   # OpenAI interceptor
├── extension/              # VS Code Extension (7 panels)
│   └── src/
│       ├── extension.ts    # Entry: activate/deactivate
│       ├── client.ts       # WebSocket client + auto-reconnect
│       ├── store.ts        # Central state management
│       ├── types.ts        # TypeScript types (match SDK schema)
│       └── panels/
│           ├── StatusPanel.ts
│           ├── CurrentStatePanel.ts
│           ├── LiveMetricsPanel.ts
│           ├── SessionListPanel.ts
│           ├── ExecutionTreePanel.ts
│           ├── InspectorPanel.ts    # Webview (5 tabs)
│           └── ContextPanel.ts      # Webview
└── docs/                   # Design documents
```

## How to Test

```bash
# Terminal 1: Start AgentLens SDK server
cd sdk && python -c "import agentlens; agentlens.init(); import time; time.sleep(60)"

# Terminal 2: Launch Extension (F5 in VS Code)
# Open agentlens/ folder → Press F5 → Extension Development Host opens

# Terminal 3: Run demo agent
cd sdk && python examples/demo_agent.py
```

## Notes for Claude Code

- Always check this file before starting work
- SDK tests: `cd sdk && python -m pytest tests/ -v` (100 tests)
- Extension build: `cd extension && node esbuild.config.js`
- Extension launch: F5 from VS Code in the agentlens root folder
