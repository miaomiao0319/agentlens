```markdown
# AgentLens — AI Agent 执行调试与可观测工具

> Chrome DevTools for AI Agents.  
> 让 agent 执行过程透明、可检查、可调试。


Before each task, Claude Code MUST read STATE.md to determine current progress.
---

## 0. 给 Claude Code 的开发说明

本文件是本项目的**唯一真实来源（Source of Truth）**。

每次开始新任务前，请先阅读本文件,确认：
- 当前所处阶段（Phase）
- 当前目标节点（Milestone）
- 本轮任务的范围边界（Scope Boundary）

**严格遵守以下原则：**
- 不提前实现尚未到达阶段的功能
- 不因为"顺手"而引入超出当前范围的依赖或抽象
- 每个节点完成后，更新本文件的 `[x]` 状态
- 遇到不确定的架构决策，先输出 ADR（Architecture Decision Record），再继续实现

---

## 1. 项目概述

| 属性 | 内容 |
|------|------|
| 项目名称 | AgentLens |
| 定位 | AI Agent 执行调试与可观测工具 |
| 目标用户 | 开发和调试 AI agent 的工程师 |
| 核心价值 | 将 agent 执行从黑盒日志变为结构化、可交互的执行时间线 |
| 技术栈（MVP） | Python SDK + React/Next.js 前端 + JSON/SQLite 存储 |

---

## 2. 问题陈述

现代 AI agent（LangChain、自定义 LLM 工作流、工具调用型 agent）面临的痛点：

- ❌ 黑盒执行（只能看到最终输出）
- ❌ 中间步骤失败难以调试
- ❌ 工具调用和推理步骤缺乏可见性
- ❌ 无法轻松比较不同运行结果
- ❌ 非确定性行为导致复现困难

开发者目前依赖的手段：
- 原始日志
- print 调试
- 零散的 JSON trace

这对于真实的 agent 开发来说**无法规模化**。

---

## 3. 系统架构总览

```
┌──────────────────────────────┐
│     用户 Agent 代码           │  Python / LangChain / 自定义 LLM 流程
└──────────────┬───────────────┘
               │
               │ 调用 AgentLens SDK (Tracer)
               │ 拦截执行事件
               ↓
┌──────────────────────────────┐
│    Trace 存储层               │  JSON 文件（MVP） / SQLite（Phase 2+）
└──────────────┬───────────────┘
               │
               ↓
┌──────────────────────────────┐
│   AgentLens Web UI            │  React 前端，DevTools 风格可视化
└──────────────────────────────┘
```

---

## 4. 核心数据结构定义

> **这是整个系统的契约（Contract），所有模块必须严格遵守此结构。**

### 4.1 Trace Event（基本事件单元）

```json
{
  "id": "evt_001",
  "run_id": "run_abc123",
  "step": 1,
  "type": "llm_call",
  "status": "success",
  "input": {
    "prompt": "...",
    "model": "gpt-4o"
  },
  "output": {
    "text": "..."
  },
  "metadata": {
    "duration_ms": 1240,
    "token_count": 512
  },
  "timestamp_start": 1720000000000,
  "timestamp_end": 1720000001240
}
```

### 4.2 事件类型枚举

| type | 含义 |
|------|------|
| `llm_call` | 向 LLM 发起的请求 |
| `tool_call` | agent 调用外部工具 |
| `tool_result` | 工具返回结果 |
| `memory_update` | agent 更新内存/上下文 |
| `agent_start` | agent 执行开始 |
| `agent_end` | agent 执行结束 |

### 4.3 Trace 文件结构（JSON 格式）

```json
{
  "run_id": "run_abc123",
  "agent_name": "my_research_agent",
  "created_at": 1720000000000,
  "total_steps": 5,
  "status": "completed",
  "events": [
    { "...": "TraceEvent" },
    { "...": "TraceEvent" }
  ]
}
```

---

## 5. 开发路线图

---

### Phase 0 — 项目脚手架搭建

**目标：** 建立可运行的项目骨架，确保所有后续工作在正确的工程结构上进行。

**预计耗时：** 0.5 天

#### Milestone 0.1 — 目录结构初始化

- [ ] 创建 monorepo 结构：
  ```
  agentlens/
  ├── sdk/              # Python tracer SDK
  │   ├── agentlens/
  │   │   ├── __init__.py
  │   │   ├── tracer.py
  │   │   └── models.py
  │   ├── examples/
  │   │   └── simple_agent.py
  │   ├── tests/
  │   └── pyproject.toml
  ├── ui/               # React 前端
  │   ├── src/
  │   ├── public/
  │   └── package.json
  ├── traces/           # 本地 trace 文件存储目录（git ignored）
  └── README.md
  ```
- [ ] 初始化 Python 项目（pyproject.toml / poetry）
- [ ] 初始化 Next.js 项目（TypeScript + Tailwind CSS）
- [ ] 配置 `.gitignore`，确保 `traces/` 目录下文件不被提交

**验收标准：**
- `cd sdk && python -c "import agentlens; print('SDK OK')"` 无报错
- `cd ui && npm run dev` 可以打开 localhost:3000 看到默认页面

---

### Phase 1 — Trace SDK 核心实现

**目标：** 实现可以拦截和记录 agent 执行事件的 Python SDK，输出结构化 JSON trace 文件。

**预计耗时：** 1.5 天

**不要做的事（Scope Boundary）：**
- 不实现 UI
- 不实现 SQLite 存储
- 不实现复杂的 LangChain 深度集成
- 不实现实时流式传输

---

#### Milestone 1.1 — 定义数据模型

- [ ] 在 `sdk/agentlens/models.py` 中实现 `TraceEvent` Pydantic 模型
- [ ] 在 `sdk/agentlens/models.py` 中实现 `TraceRun` Pydantic 模型
- [ ] 编写模型的单元测试（`tests/test_models.py`）

**验收标准：**
```python
from agentlens.models import TraceEvent, TraceRun
event = TraceEvent(
    step=1,
    type="llm_call",
    input={"prompt": "hello"},
    output={"text": "world"}
)
assert event.id is not None  # 自动生成 UUID
assert event.timestamp_start is not None
```

---

#### Milestone 1.2 — 实现 Tracer 核心类

- [ ] 在 `sdk/agentlens/tracer.py` 中实现 `AgentTracer` 类：
  - `__init__(self, agent_name, output_dir="./traces")`
  - `record(self, type, input, output, metadata=None)` — 记录一个事件
  - `save(self)` — 将本次 run 的所有事件保存为 JSON 文件
  - `get_trace(self)` — 返回当前 TraceRun 对象
- [ ] 实现 `run_id` 自动生成（UUID4）
- [ ] 实现 trace 文件命名规则：`{agent_name}_{run_id[:8]}_{timestamp}.json`

**验收标准：**
```python
tracer = AgentTracer(agent_name="test_agent")
tracer.record(
    type="llm_call",
    input={"prompt": "hi"},
    output={"text": "hello"}
)
tracer.save()
# 应生成文件: ./traces/test_agent_xxxx_xxxx.json
```

---

#### Milestone 1.3 — 实现 Context Manager / Decorator 接口

- [ ] 实现 `@agentlens.trace` 装饰器，可包装 agent 函数
- [ ] 实现 `with agentlens.session(name="...")` 上下文管理器
- [ ] 装饰器自动记录 `agent_start` 和 `agent_end` 事件
- [ ] 异常情况下自动标记 `status: "failed"` 并记录错误信息

**验收标准：**
```python
from agentlens import trace, record

@trace(name="my_agent")
def run_agent(query):
    record("llm_call", input={"prompt": query}, output={"text": "result"})
    return "done"

run_agent("test query")
# trace 文件自动生成，包含 agent_start + llm_call + agent_end 三个事件
```

---

#### Milestone 1.4 — 编写示例 Agent

- [ ] 在 `sdk/examples/simple_agent.py` 创建一个模拟 agent：
  - 模拟一次 LLM 调用（用 mock 函数，不需要真实 API key）
  - 模拟一次工具调用（例如：模拟 web_search）
  - 模拟一次结果汇总（第二次 LLM 调用）
- [ ] 运行示例 agent 应生成完整 trace 文件

**验收标准：**
```bash
cd sdk
python examples/simple_agent.py
# 输出: trace saved to ./traces/simple_agent_xxxx.json
# 文件包含 5 个事件：agent_start, llm_call, tool_call, tool_result, agent_end
```

**Phase 1 完成标志：**
> 运行示例 agent 后，`./traces/` 目录下生成格式正确的 JSON trace 文件，包含所有预期事件类型，可手动验证内容符合数据结构定义。

---

### Phase 2 — Web UI 核心实现

**目标：** 实现可以加载和可视化 trace 文件的 Web 界面，提供 DevTools 风格的执行时间线。

**预计耗时：** 2 天

**不要做的事（Scope Boundary）：**
- 不实现后端服务器（纯静态前端 + 本地文件加载）
- 不实现实时更新
- 不实现跨 run 比较
- 不实现 replay 功能

---

#### Milestone 2.1 — UI 基础框架搭建

- [ ] 在 `ui/` 中配置 Next.js + TypeScript + Tailwind CSS
- [ ] 定义与 SDK 一致的 TypeScript 类型（`types/trace.ts`）：
  ```typescript
  type EventType = 'llm_call' | 'tool_call' | 'tool_result' | 'memory_update' | 'agent_start' | 'agent_end'
  
  interface TraceEvent {
    id: string
    run_id: string
    step: number
    type: EventType
    status: 'success' | 'failed' | 'pending'
    input: Record<string, unknown>
    output: Record<string, unknown>
    metadata?: Record<string, unknown>
    timestamp_start: number
    timestamp_end?: number
  }
  
  interface TraceRun {
    run_id: string
    agent_name: string
    created_at: number
    total_steps: number
    status: string
    events: TraceEvent[]
  }
  ```
- [ ] 实现文件上传组件（拖拽或点击上传 `.json` trace 文件）
- [ ] 实现本地文件解析（读取并验证 JSON 格式）

**验收标准：**
- 用户可以上传 Phase 1 生成的 trace JSON 文件
- 上传成功后控制台输出解析后的 TraceRun 对象，无报错

---

#### Milestone 2.2 — 事件列表（左侧面板）

- [ ] 实现 `EventList` 组件，展示所有事件的摘要列表：
  - 步骤编号（step）
  - 事件类型（type，用不同颜色/图标区分）
  - 执行耗时（duration_ms）
  - 执行状态（success / failed，用颜色区分）
- [ ] 实现事件选中状态（点击高亮）
- [ ] 不同事件类型使用不同的视觉标识：
  - `llm_call` — 蓝色
  - `tool_call` — 橙色
  - `tool_result` — 绿色
  - `agent_start/end` — 灰色
  - `memory_update` — 紫色

**验收标准：**
- 上传 trace 文件后，左侧展示所有事件列表
- 每个事件显示类型、步骤、耗时
- 点击事件可以高亮选中

---

#### Milestone 2.3 — 事件详情（右侧面板）

- [ ] 实现 `EventDetail` 组件，展示选中事件的完整信息：
  - 事件元信息（id, type, status, timestamp）
  - Input 区域（格式化 JSON 展示，支持折叠）
  - Output 区域（格式化 JSON 展示，支持折叠）
  - Metadata 区域（可选，展示 token 数量、耗时等）
- [ ] 实现 JSON 格式化展示（语法高亮，可展开/折叠）

**验收标准：**
- 点击左侧任意事件，右侧显示该事件的完整 input/output/metadata
- JSON 内容有语法高亮，长文本可折叠

---

#### Milestone 2.4 — 布局与整体 UI 组合

- [ ] 实现整体 DevTools 风格布局：
  - 顶部：Agent 执行摘要（agent name, run_id, 总耗时, 总步数, 状态）
  - 左侧（30%）：事件列表面板
  - 右侧（70%）：事件详情面板
  - 底部（可选）：执行时间线 mini-map
- [ ] 实现初始状态（无文件时显示上传引导区域）
- [ ] 实现基本响应式（桌面端优先）

**验收标准：**
- 整体布局符合 DevTools 风格
- 加载 trace 文件 → 左侧显示事件列表 → 点击事件 → 右侧显示详情，完整流程无 bug

**Phase 2 完成标志：**
> 开发者可以通过浏览器上传 Phase 1 生成的 trace 文件，看到完整的执行步骤列表，点击每一步可以查看其 input、output 和 metadata。整个流程端到端可用。

---

### Phase 3 — 调试体验增强

**目标：** 在 MVP 基础上，将 AgentLens 的体验提升到"真正像 DevTools"的水平。

**预计耗时：** 1.5 天

**进入 Phase 3 的前提条件：**
- Phase 1 和 Phase 2 全部验收通过
- 已用真实（或模拟）agent 运行过至少 3 次端到端测试

---

#### Milestone 3.1 — 执行时间线可视化

- [ ] 实现甘特图风格的执行时间线组件（`TimelineView`）：
  - X 轴为时间
  - 每个事件显示为一个色块
  - 色块宽度对应事件耗时
  - 点击色块同步选中左侧列表
- [ ] 时间线与事件列表双向联动（列表点击 → 时间线高亮；时间线点击 → 列表滚动到对应项）

**验收标准：**
- 时间线能正确展示事件的时间分布
- 双向联动无延迟、无 bug

---

#### Milestone 3.2 — 错误与异常高亮

- [ ] `status: "failed"` 的事件在列表中显示红色警示
- [ ] 详情面板中显示 error message 和 stack trace（如果存在）
- [ ] SDK 端完善错误捕获：try/except 包裹 agent 执行，将异常信息记录到 event 中

**验收标准：**
- 故意在示例 agent 中触发一个异常，运行后 UI 中该事件显示为失败状态，可查看错误详情

---

#### Milestone 3.3 — 多 Run 历史列表

- [ ] 实现 `RunHistory` 侧边栏，展示 `traces/` 目录下所有 trace 文件（需要简单后端或通过 API route 读取目录）
- [ ] 用户可以在不同 run 之间切换，无需重新上传文件
- [ ] 每个 run 显示：agent name、运行时间、总步数、状态

**注意：** 此功能需要一个轻量后端接口，可用 Next.js API Routes 实现：
```
GET /api/runs          -> 返回所有 trace 文件列表
GET /api/runs/[run_id] -> 返回指定 run 的完整 trace
```

**验收标准：**
- 运行多次示例 agent 后，UI 中可以看到历史 run 列表，点击切换查看各自的详情

---

#### Milestone 3.4 — 搜索与过滤

- [ ] 实现事件列表的过滤功能：
  - 按事件类型过滤（多选）
  - 按状态过滤（success / failed）
- [ ] 实现关键词搜索（搜索 input/output 中的内容）

**验收标准：**
- 过滤和搜索实时生效，不重新加载文件

**Phase 3 完成标志：**
> AgentLens 具备完整的 DevTools 级调试体验：时间线可视化、错误高亮、多 run 历史切换、事件过滤，整体体验接近 Chrome DevTools Network 面板。

---

## 6. 技术决策记录（ADR）

> 在开发过程中，将重要的架构决策记录在此处。

### ADR-001：存储格式选择 JSON 而非 SQLite（MVP 阶段）

- **决策：** MVP 使用 JSON 文件存储
- **原因：** 降低依赖复杂度，便于调试，文件可直接用编辑器查看
- **权衡：** 不支持查询，性能有限，但 MVP 阶段可接受
- **未来：** Phase 4 迁移至 SQLite 或 PostgreSQL

### ADR-002：前端使用 Next.js 而非纯 React

- **决策：** 使用 Next.js (App Router)
- **原因：** 需要 API Routes 来读取本地 trace 文件目录
- **权衡：** 增加少量复杂度，但换取服务端能力

---

## 7. 当前进度追踪

> 每个 Milestone 完成后在此处更新状态。

| 阶段 | 节点 | 状态 | 完成时间 |
|------|------|------|----------|
| Phase 0 | Milestone 0.1 目录结构 | [x] 已完成 | 2026-07-05 |
| Phase 1 | Milestone 1.1 数据模型 | [x] 已完成 | 2026-07-05 |
| Phase 1 | Milestone 1.2 Tracer 核心 | [x] 已完成 | 2026-07-05 |
| Phase 1 | Milestone 1.3 装饰器接口 | [x] 已完成 | 2026-07-05 |
| Phase 1 | Milestone 1.4 示例 Agent | [x] 已完成 | 2026-07-05 |
| Phase 2 | Milestone 2.1 UI 框架 | [ ] 未开始 | — |
| Phase 2 | Milestone 2.2 事件列表 | [ ] 未开始 | — |
| Phase 2 | Milestone 2.3 事件详情 | [ ] 未开始 | — |
| Phase 2 | Milestone 2.4 整体布局 | [ ] 未开始 | — |
| Phase 3 | Milestone 3.1 时间线 | [ ] 未开始 | — |
| Phase 3 | Milestone 3.2 错误高亮 | [ ] 未开始 | — |
| Phase 3 | Milestone 3.3 多 Run 历史 | [ ] 未开始 | — |
| Phase 3 | Milestone 3.4 搜索过滤 | [ ] 未开始 | — |

---

## 8. 未来路线图（MVP 之后）

以下功能**不在当前开发范围内**，但已规划用于未来迭代：

| 功能 | 优先级 | 备注 |
|------|--------|------|
| Run Diff 对比视图 | High | 对比两次 run 的执行差异 |
| Failure Localization | High | 自动定位 agent 失败的根因步骤 |
| Replay & Branch | Medium | Git 风格的执行分支与重放 |
| 实时流式 Trace | Medium | WebSocket 实时推送执行事件 |
| LangChain 深度集成 | High | 自动 hook LangChain callback |
| Multi-Agent 图视图 | Low | 多 agent 协作的图结构可视化 |
| Token 成本追踪 | Medium | 每次执行的 token 用量与费用估算 |

---

## 9. 本地开发启动指南

```bash
# 克隆项目
git clone <repo>
cd agentlens

# 启动 SDK 开发环境
cd sdk
pip install -e ".[dev]"
python examples/simple_agent.py

# 启动 UI 开发环境
cd ../ui
npm install
npm run dev
# 访问 http://localhost:3000
```

---

## 10. 给 Claude Code 的工作规范

1. **每次对话开始前**，先确认当前所在 Milestone，不要跳跃
2. **完成一个 Milestone 后**，明确输出验收结果，等待确认后再继续
3. **遇到需要超出当前 Scope 的决策时**，先输出说明，获得许可后再实现
4. **代码风格**：Python 使用 Black + isort，TypeScript 使用 Prettier + ESLint
5. **每个函数/组件**必须有基本的类型注解或 TypeScript 类型定义
6. **不要预优化**：MVP 阶段优先可用性，不要提前引入缓存、队列等复杂机制

---

## 11. 项目愿景与哲学

### 设计哲学

- **开发者优先** — 非终端用户聊天机器人
- **调试 > 对话** — 专注于调试而非交互
- **可观测性 > 抽象** — 透明优于封装
- **结构化执行 > 原始日志** — 数据化而非文本化

### 长期愿景

> 让开发者可以像调试前端网络请求一样调试 AI agent 的执行过程。

AgentLens 的终极目标是成为 AI agent 开发生态的基础设施，提供：
- 透明的执行可见性
- 可复现的调试环境
- 标准化的 trace 格式
- 跨平台的开发体验

---

## 12. MVP 成功标准

MVP 被认为成功的标志：

> ✅ 开发者可以运行一个 AI agent，并在 Web UI 中看到该 agent 执行的每一步：
> - 每次 LLM 调用的 prompt 和 response
> - 每次工具调用的参数和结果
> - 每步的耗时和状态
> - 完整的执行时间线

**定量指标：**
- 从 agent 运行到可视化结果，全流程 < 1 分钟
- UI 加载包含 100+ 事件的 trace 文件无明显卡顿
- 支持至少 5 种事件类型的可视化

**定性指标：**
- 新用户无需文档即可理解 UI 布局
- 首次使用即可定位到 agent 执行中的问题步骤
- 整体体验接近使用 Chrome DevTools Network 面板

---

**项目开始时间：** 待定  
**当前版本：** v0.0.1-dev  
**最后更新：** 2026-07-05
```