"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode8 = __toESM(require("vscode"));

// src/client.ts
var vscode = __toESM(require("vscode"));
var import_ws = require("ws");
var DEFAULT_HOST = "127.0.0.1";
var DEFAULT_PORT = 9876;
var MAX_RECONNECT_DELAY_MS = 3e4;
var MAX_CONSECUTIVE_FAILURES = 10;
var INITIAL_RECONNECT_DELAY_MS = 1e3;
var AgentLensClient = class {
  constructor(host = DEFAULT_HOST, port = DEFAULT_PORT) {
    this.host = host;
    this.port = port;
  }
  _status = "disconnected";
  _ws = null;
  _reconnectTimer = null;
  _reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
  _consecutiveFailures = 0;
  _shouldReconnect = true;
  _eventListeners = [];
  _statusListeners = [];
  _sessionListListeners = [];
  // --- public API ---
  get status() {
    return this._status;
  }
  get url() {
    return `ws://${this.host}:${this.port}`;
  }
  connect() {
    if (this._status === "connecting" || this._status === "connected") {
      return;
    }
    this._shouldReconnect = true;
    this._doConnect();
  }
  disconnect() {
    this._shouldReconnect = false;
    this._cancelReconnect();
    if (this._ws) {
      try {
        this._ws.close();
      } catch {
      }
      this._ws = null;
    }
    this._setStatus("disconnected");
  }
  onEvent(callback) {
    this._eventListeners.push(callback);
    return new vscode.Disposable(() => {
      const idx = this._eventListeners.indexOf(callback);
      if (idx >= 0) this._eventListeners.splice(idx, 1);
    });
  }
  onStatusChange(callback) {
    this._statusListeners.push(callback);
    return new vscode.Disposable(() => {
      const idx = this._statusListeners.indexOf(callback);
      if (idx >= 0) this._statusListeners.splice(idx, 1);
    });
  }
  onSessionList(callback) {
    this._sessionListListeners.push(callback);
    return new vscode.Disposable(() => {
      const idx = this._sessionListListeners.indexOf(callback);
      if (idx >= 0) this._sessionListListeners.splice(idx, 1);
    });
  }
  // --- internal ---
  _setStatus(status) {
    if (this._status !== status) {
      this._status = status;
      for (const listener of this._statusListeners) {
        try {
          listener(status);
        } catch {
        }
      }
    }
  }
  _doConnect() {
    this._setStatus("connecting");
    try {
      this._ws = new import_ws.WebSocket(this.url);
    } catch (err) {
      console.error("[AgentLens] Failed to create WebSocket:", err);
      this._scheduleReconnect();
      return;
    }
    this._ws.on("open", () => {
      console.log(`[AgentLens] Connected to ${this.url}`);
      this._setStatus("connected");
      this._reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
      this._consecutiveFailures = 0;
    });
    this._ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        this._dispatch(msg);
      } catch (err) {
        console.error("[AgentLens] Failed to parse message:", err);
      }
    });
    this._ws.on("close", () => {
      console.log("[AgentLens] Connection closed");
      this._ws = null;
      this._setStatus("disconnected");
      if (this._shouldReconnect) {
        this._scheduleReconnect();
      }
    });
    this._ws.on("error", (err) => {
      console.error("[AgentLens] WebSocket error:", err.message);
    });
  }
  _dispatch(msg) {
    if (msg.type === "connected") {
      console.log(`[AgentLens] SDK version: ${msg.version}`);
      return;
    }
    if (msg.type === "session_list") {
      const sessions = msg.sessions;
      for (const listener of this._sessionListListeners) {
        try {
          listener(sessions);
        } catch {
        }
      }
      return;
    }
    const event = msg;
    for (const listener of this._eventListeners) {
      try {
        listener(event);
      } catch {
      }
    }
  }
  _scheduleReconnect() {
    if (this._consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      console.log("[AgentLens] Max reconnect attempts reached. Giving up.");
      vscode.window.showWarningMessage(
        `AgentLens: Failed to connect to SDK after ${MAX_CONSECUTIVE_FAILURES} attempts. Make sure agentlens.init() is called in your Python script.`,
        "Retry"
      ).then((choice) => {
        if (choice === "Retry") {
          this._consecutiveFailures = 0;
          this._reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
          this.connect();
        }
      });
      return;
    }
    this._cancelReconnect();
    this._consecutiveFailures++;
    console.log(
      `[AgentLens] Reconnecting in ${this._reconnectDelay / 1e3}s (attempt ${this._consecutiveFailures})`
    );
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this._doConnect();
      this._reconnectDelay = Math.min(
        this._reconnectDelay * 2,
        MAX_RECONNECT_DELAY_MS
      );
    }, this._reconnectDelay);
  }
  _cancelReconnect() {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
  }
};

// src/store.ts
var vscode2 = __toESM(require("vscode"));
var MAX_EVENTS_PER_SESSION = 1e5;
var Store = class {
  _sessions = /* @__PURE__ */ new Map();
  _activeSessionId = null;
  // Event emitters
  _onSessionAdded = new vscode2.EventEmitter();
  onSessionAdded = this._onSessionAdded.event;
  _onEventAdded = new vscode2.EventEmitter();
  onEventAdded = this._onEventAdded.event;
  _onActiveSessionChanged = new vscode2.EventEmitter();
  onActiveSessionChanged = this._onActiveSessionChanged.event;
  _onSessionUpdated = new vscode2.EventEmitter();
  onSessionUpdated = this._onSessionUpdated.event;
  // --- session management ---
  addSession(summary) {
    if (this._sessions.has(summary.session_id)) {
      const existing = this._sessions.get(summary.session_id);
      existing.status = summary.status;
      existing.ended_at = summary.ended_at;
      existing.event_count = summary.event_count;
      existing.duration_ms = summary.duration_ms;
      this._onSessionUpdated.fire(existing);
      return;
    }
    const state = { ...summary, events: [] };
    this._sessions.set(summary.session_id, state);
    this._onSessionAdded.fire(state);
    if (!this._activeSessionId) {
      this.setActiveSession(summary.session_id);
    }
  }
  addEvent(event) {
    let session = this._sessions.get(event.session_id);
    if (!session) {
      session = {
        session_id: event.session_id,
        framework: "",
        agent_name: "",
        created_at: event.timestamp,
        ended_at: null,
        status: "running",
        event_count: 0,
        duration_ms: 0,
        events: []
      };
      this._sessions.set(event.session_id, session);
      this._onSessionAdded.fire(session);
      if (!this._activeSessionId) {
        this.setActiveSession(event.session_id);
      }
    }
    const existingIdx = session.events.findIndex((e) => e.id === event.id);
    if (existingIdx >= 0) {
      session.events[existingIdx] = event;
    } else {
      if (session.events.length >= MAX_EVENTS_PER_SESSION) {
        return;
      }
      session.events.push(event);
    }
    session.event_count = session.events.length;
    if (event.type === "agent_start") {
      const se = event;
      session.agent_name = se.agent_name || session.agent_name;
      session.framework = se.framework || session.framework;
    }
    if (event.type === "agent_end") {
      session.status = event.status === "failed" ? "failed" : "completed";
      session.ended_at = event.timestamp;
      session.duration_ms = event.duration || session.duration_ms;
    }
    this._onEventAdded.fire({ sessionId: event.session_id, event });
    this._onSessionUpdated.fire(session);
  }
  addSessions(summaries) {
    for (const s of summaries) {
      this.addSession(s);
    }
  }
  // --- queries ---
  getSession(sessionId) {
    return this._sessions.get(sessionId);
  }
  getActiveSession() {
    if (this._activeSessionId) {
      return this._sessions.get(this._activeSessionId) ?? null;
    }
    return null;
  }
  listSessions() {
    return Array.from(this._sessions.values()).sort((a, b) => b.created_at - a.created_at);
  }
  setActiveSession(sessionId) {
    this._activeSessionId = sessionId;
    this._onActiveSessionChanged.fire(sessionId);
  }
  getEventTree(sessionId) {
    const session = this._sessions.get(sessionId);
    if (!session) return [];
    const childrenMap = /* @__PURE__ */ new Map();
    for (const event of session.events) {
      const parentKey = event.parent_id ?? "__root__";
      if (!childrenMap.has(parentKey)) {
        childrenMap.set(parentKey, []);
      }
      childrenMap.get(parentKey).push(event);
    }
    return childrenMap.get("__root__") ?? [];
  }
  getChildrenOf(parentId, sessionId) {
    const session = this._sessions.get(sessionId);
    if (!session) return [];
    return session.events.filter((e) => e.parent_id === parentId);
  }
  // --- metrics ---
  getMetrics(sessionId) {
    const events = this._sessions.get(sessionId)?.events ?? [];
    let llmCalls = 0, toolCalls = 0, llmResponses = 0, tokenUsage = 0, errorCount = 0;
    for (const e of events) {
      if (e.type === "llm_call") llmCalls++;
      if (e.type === "llm_response") {
        llmResponses++;
        tokenUsage += e.token_count || 0;
      }
      if (e.type === "tool_call") toolCalls++;
      if (e.type === "error" || e.status === "failed") errorCount++;
    }
    return {
      totalEvents: events.length,
      llmCalls,
      toolCalls,
      llmResponses,
      tokenUsage,
      errorCount
    };
  }
  getCurrentState(sessionId) {
    const session = this._sessions.get(sessionId);
    if (!session) {
      return { status: "none", sessionName: "", currentStep: "", currentModel: "", elapsedMs: 0 };
    }
    const events = session.events;
    const lastRunning = [...events].reverse().find((e) => e.status === "running");
    const lastLLM = [...events].reverse().find((e) => e.type === "llm_call");
    const now = Date.now();
    const elapsedMs = session.ended_at ? session.ended_at - session.created_at : now - session.created_at;
    return {
      status: session.status,
      sessionName: session.agent_name || session.session_id,
      currentStep: lastRunning ? `${lastRunning.type} \xB7 ${lastRunning.tool_name || lastRunning.model || ""}` : "idle",
      currentModel: lastLLM?.model || "",
      elapsedMs
    };
  }
  getContext(sessionId) {
    const events = this._sessions.get(sessionId)?.events ?? [];
    return {
      memoryUpdates: events.filter((e) => e.type === "memory_update"),
      toolResults: events.filter((e) => e.type === "tool_result"),
      llmResponses: events.filter((e) => e.type === "llm_response")
    };
  }
  // --- lifecycle ---
  clear() {
    this._sessions.clear();
    this._activeSessionId = null;
  }
  get activeSessionId() {
    return this._activeSessionId;
  }
};

// src/panels/StatusPanel.ts
var vscode3 = __toESM(require("vscode"));
var StatusPanel = class {
  _onDidChangeTreeData = new vscode3.EventEmitter();
  onDidChangeTreeData = this._onDidChangeTreeData.event;
  _status = "disconnected";
  _url = "";
  // --- public API ---
  setStatus(status, url = "") {
    this._status = status;
    this._url = url;
    this._onDidChangeTreeData.fire(void 0);
  }
  // --- TreeDataProvider ---
  getTreeItem(element) {
    return element;
  }
  getChildren() {
    let icon;
    let label;
    let tooltip;
    switch (this._status) {
      case "connected":
        icon = "\u{1F7E2}";
        label = `Connected \u2014 ${this._url}`;
        tooltip = "AgentLens SDK connected";
        break;
      case "connecting":
        icon = "\u{1F7E1}";
        label = `Connecting \u2014 ${this._url}`;
        tooltip = "Attempting to connect to AgentLens SDK...";
        break;
      case "disconnected":
      default:
        icon = "\u{1F534}";
        label = "Disconnected \u2014 Waiting for SDK...";
        tooltip = "Run agentlens.init() in your Python script";
        break;
    }
    const item = new vscode3.TreeItem(`${icon}  ${label}`);
    item.tooltip = tooltip;
    item.contextValue = "agentlensStatus";
    return [item];
  }
};

// src/panels/SessionListPanel.ts
var vscode4 = __toESM(require("vscode"));
var SessionListPanel = class {
  constructor(store2) {
    this.store = store2;
    store2.onSessionAdded(() => this.refresh());
    store2.onSessionUpdated(() => this.refresh());
  }
  _onDidChangeTreeData = new vscode4.EventEmitter();
  onDidChangeTreeData = this._onDidChangeTreeData.event;
  refresh() {
    this._onDidChangeTreeData.fire(void 0);
  }
  // --- TreeDataProvider ---
  getTreeItem(element) {
    return element;
  }
  getChildren() {
    return this.store.listSessions().map((s) => this._toTreeItem(s));
  }
  // --- helpers ---
  _toTreeItem(session) {
    const isActive = this.store.activeSessionId === session.session_id;
    const statusIcon = session.status === "running" ? "\u{1F7E2}" : session.status === "failed" ? "\u{1F534}" : "\u2705";
    const label = `${statusIcon} ${session.agent_name || session.session_id.slice(0, 8)}`;
    const shortId = session.session_id.slice(0, 12);
    const dur = session.duration_ms < 1e3 ? `${session.duration_ms}ms` : `${(session.duration_ms / 1e3).toFixed(1)}s`;
    const item = new SessionTreeItem(
      label,
      isActive ? vscode4.TreeItemCollapsibleState.None : vscode4.TreeItemCollapsibleState.None
    );
    item.description = `${session.event_count} events \xB7 ${dur}`;
    item.tooltip = [
      `Session: ${shortId}`,
      `Framework: ${session.framework || "unknown"}`,
      `Status: ${session.status}`,
      `Events: ${session.event_count}`,
      `Duration: ${dur}`
    ].join("\n");
    item.id = session.session_id;
    item.contextValue = "session";
    item.iconPath = isActive ? new vscode4.ThemeIcon("arrow-right") : void 0;
    item.command = {
      command: "agentlens.selectSession",
      title: "Select Session",
      arguments: [session.session_id]
    };
    return item;
  }
};
var SessionTreeItem = class extends vscode4.TreeItem {
  constructor(label, collapsibleState) {
    super(label, collapsibleState);
  }
};

// src/panels/ExecutionTreePanel.ts
var vscode5 = __toESM(require("vscode"));
var ExecutionTreePanel = class {
  constructor(store2) {
    this.store = store2;
    store2.onActiveSessionChanged((id) => {
      this._sessionId = id;
      this.refresh();
    });
    store2.onEventAdded(({ sessionId }) => {
      if (sessionId === this._sessionId) {
        this.refresh();
      }
    });
  }
  _onDidChangeTreeData = new vscode5.EventEmitter();
  onDidChangeTreeData = this._onDidChangeTreeData.event;
  _sessionId = null;
  setSession(sessionId) {
    this._sessionId = sessionId;
    this.refresh();
  }
  refresh() {
    this._onDidChangeTreeData.fire(void 0);
  }
  // --- TreeDataProvider ---
  getTreeItem(element) {
    return element;
  }
  getChildren(element) {
    if (!this._sessionId) return [];
    if (!element) {
      return this.store.getEventTree(this._sessionId).map((e) => this._toItem(e));
    }
    return this.store.getChildrenOf(element.event.id, this._sessionId).map((e) => this._toItem(e));
  }
  getParent(element) {
    if (!element.event.parent_id || !this._sessionId) return null;
    const session = this.store.getSession(this._sessionId);
    if (!session) return null;
    const parent = session.events.find((e) => e.id === element.event.parent_id);
    if (!parent) return null;
    return this._toItem(parent);
  }
  // --- helpers ---
  _toItem(event) {
    const label = this._formatLabel(event);
    const icon = this._getIcon(event);
    const hasChildren = this._sessionId ? this.store.getChildrenOf(event.id, this._sessionId).length > 0 : false;
    const collapsible = hasChildren ? vscode5.TreeItemCollapsibleState.Expanded : vscode5.TreeItemCollapsibleState.None;
    const item = new EventTreeItem(label, collapsible, event);
    const durStr = event.duration > 0 ? event.duration < 1e3 ? `${event.duration}ms` : `${(event.duration / 1e3).toFixed(1)}s` : "";
    item.description = durStr;
    item.iconPath = new vscode5.ThemeIcon(
      icon,
      event.status === "running" ? new vscode5.ThemeColor("charts.blue") : event.status === "failed" ? new vscode5.ThemeColor("charts.red") : void 0
    );
    if (event.status === "running") {
      item.iconPath = new vscode5.ThemeIcon("sync~spin");
    }
    item.tooltip = `${event.type} \xB7 ${event.status}
Duration: ${durStr}
ID: ${event.id}`;
    return item;
  }
  _formatLabel(event) {
    switch (event.type) {
      case "agent_start": {
        const e = event;
        return `Agent: ${e.agent_name || "start"}`;
      }
      case "agent_end": {
        const e = event;
        return `Agent End \xB7 ${e.total_events || 0} events`;
      }
      case "llm_call": {
        const e = event;
        return `LLM \xB7 ${e.model || "unknown"}`;
      }
      case "llm_response": {
        const e = event;
        return `Response \xB7 ${e.token_count || 0} tokens`;
      }
      case "tool_call": {
        const e = event;
        return `Tool \xB7 ${e.tool_name || "unknown"}`;
      }
      case "tool_result": {
        const e = event;
        const prefix = e.is_error ? "\u274C " : "";
        return `${prefix}Result \xB7 ${e.tool_name || "unknown"}`;
      }
      case "http_request": {
        const e = event;
        return `${e.method || "GET"} ${e.url || ""}`;
      }
      case "database_query": {
        const e = event;
        const short = (e.query || "").slice(0, 60);
        return `DB \xB7 ${short}`;
      }
      case "memory_update": {
        const e = event;
        return `Memory \xB7 ${e.operation} ${e.key || ""}`;
      }
      case "retrieval": {
        const e = event;
        return `Retrieval \xB7 ${(e.query || "").slice(0, 50)}`;
      }
      case "embedding": {
        const e = event;
        return `Embed \xB7 ${e.model || "unknown"}`;
      }
      case "error": {
        const e = event;
        return `${e.error_type || "Error"}: ${(e.error_message || "").slice(0, 80)}`;
      }
      case "custom": {
        const e = event;
        return `Custom \xB7 ${e.name || "event"}`;
      }
      default:
        return event.type;
    }
  }
  _getIcon(_event) {
    const icons = {
      agent_start: "debug-start",
      agent_end: "debug-stop",
      llm_call: "comment",
      llm_response: "comment-discussion",
      tool_call: "tools",
      tool_result: "pass",
      http_request: "globe",
      database_query: "database",
      memory_update: "archive",
      retrieval: "search",
      embedding: "symbol-numeric",
      error: "error",
      custom: "symbol-misc"
    };
    return icons[_event.type] || "circle-outline";
  }
};
var EventTreeItem = class extends vscode5.TreeItem {
  constructor(label, collapsibleState, event) {
    super(label, collapsibleState);
    this.event = event;
    this.contextValue = "event";
    this.id = event.id;
  }
};

// src/panels/InspectorPanel.ts
var InspectorPanel = class {
  constructor(extensionUri) {
    this.extensionUri = extensionUri;
  }
  _view = null;
  _currentEvent = null;
  // --- WebviewViewProvider ---
  resolveWebviewView(webviewView) {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri]
    };
    webviewView.webview.html = this._getHtml();
    webviewView.webview.onDidReceiveMessage((msg) => {
      if (msg.type === "ready") {
        if (this._currentEvent) {
          this._postEvent(this._currentEvent);
        }
      }
    });
  }
  // --- public API ---
  showEvent(event) {
    this._currentEvent = event;
    this._postEvent(event);
  }
  clear() {
    this._currentEvent = null;
    if (this._view) {
      this._view.webview.postMessage({ type: "clear" });
    }
  }
  // --- internal ---
  _postEvent(event) {
    if (this._view) {
      this._view.webview.postMessage({
        type: "showEvent",
        event: JSON.parse(JSON.stringify(event))
      });
    }
  }
  _getHtml() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Inspector</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: var(--vscode-editor-font-family, monospace);
            font-size: var(--vscode-editor-font-size, 13px);
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
            padding: 0;
            max-height: 280px;
            overflow-y: auto;
        }
        .placeholder {
            display: flex; align-items: center; justify-content: center;
            height: 60px; color: var(--vscode-descriptionForeground);
            font-size: 12px;
        }
        .tabs { display: flex; border-bottom: 1px solid var(--vscode-panel-border); }
        .tab {
            padding: 6px 14px; cursor: pointer; font-size: 12px;
            color: var(--vscode-descriptionForeground);
            border-bottom: 2px solid transparent; transition: all 0.15s;
        }
        .tab:hover { color: var(--vscode-foreground); background: var(--vscode-list-hoverBackground); }
        .tab.active { color: var(--vscode-foreground); border-bottom-color: var(--vscode-focusBorder); }
        .content { padding: 12px; display: none; }
        .content.active { display: block; }
        .kv { display: grid; grid-template-columns: 140px 1fr; gap: 4px 8px; font-size: 12px; }
        .kv .key { color: var(--vscode-descriptionForeground); text-align: right; }
        .kv .val { color: var(--vscode-foreground); word-break: break-all; }
        .badge {
            display: inline-block; padding: 1px 8px; border-radius: 10px;
            font-size: 11px; font-weight: 600;
        }
        .badge.success { background: #28a74533; color: #28a745; }
        .badge.failed { background: #dc354533; color: #dc3545; }
        .badge.running { background: #007acc33; color: #007acc; }
        .badge.pending { background: #6c757d33; color: #6c757d; }
        .error-banner {
            background: #dc354520; border-left: 3px solid #dc3545;
            padding: 10px 14px; margin-bottom: 12px;
        }
        .error-banner .title { font-weight: 600; color: #dc3545; margin-bottom: 4px; }
        .error-banner .msg { color: var(--vscode-foreground); }
        pre {
            background: var(--vscode-textCodeBlock-background);
            padding: 10px; border-radius: 4px; overflow: auto;
            max-height: 300px; font-size: 11px; white-space: pre-wrap;
            margin-top: 6px;
        }
        .json-node { margin-left: 16px; }
        .json-toggle { cursor: pointer; user-select: none; color: var(--vscode-descriptionForeground); }
        .json-toggle:hover { color: var(--vscode-foreground); }
        .json-string { color: #98c379; }
        .json-number { color: #61afef; }
        .json-boolean { color: #d19a66; }
        .json-null { color: #6c757d; }
        .json-key { color: #e06c75; }
    </style>
</head>
<body>
    <div id="placeholder" class="placeholder">Select an event to inspect</div>
    <div id="main" style="display:none;">
        <div class="tabs">
            <div class="tab active" data-tab="general">General</div>
            <div class="tab" data-tab="input">Input</div>
            <div class="tab" data-tab="output">Output</div>
            <div class="tab" data-tab="metrics">Metrics</div>
            <div class="tab" data-tab="raw">Raw</div>
        </div>
        <div id="tab-general" class="content active"></div>
        <div id="tab-input" class="content"></div>
        <div id="tab-output" class="content"></div>
        <div id="tab-metrics" class="content"></div>
        <div id="tab-raw" class="content"></div>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        let currentEvent = null;

        // Tab switching
        document.querySelector('.tabs').addEventListener('click', (e) => {
            if (!e.target.classList.contains('tab')) return;
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.content').forEach(c => c.classList.remove('active'));
            e.target.classList.add('active');
            document.getElementById('tab-' + e.target.dataset.tab).classList.add('active');
        });

        // Messages from extension
        window.addEventListener('message', (e) => {
            const msg = e.data;
            if (msg.type === 'showEvent') {
                currentEvent = msg.event;
                document.getElementById('placeholder').style.display = 'none';
                document.getElementById('main').style.display = 'block';
                renderAll(msg.event);
            } else if (msg.type === 'clear') {
                currentEvent = null;
                document.getElementById('placeholder').style.display = 'flex';
                document.getElementById('main').style.display = 'none';
            }
        });

        function renderAll(evt) {
            renderGeneral(evt);
            renderInput(evt);
            renderOutput(evt);
            renderMetrics(evt);
            renderRaw(evt);
        }

        function renderGeneral(evt) {
            const dur = evt.duration > 0 ? (evt.duration < 1000 ? evt.duration + 'ms' : (evt.duration/1000).toFixed(1)+'s') : '-';
            const ts = new Date(evt.timestamp).toISOString();
            let html = '<div class="kv">';
            html += k('Type', '<span class="badge">' + escapeHtml(evt.type) + '</span>');
            html += k('Status', '<span class="badge ' + escapeHtml(evt.status) + '">' + escapeHtml(evt.status) + '</span>');
            html += k('Duration', dur);
            html += k('Timestamp', ts);
            html += k('Event ID', '<code>' + escapeHtml(evt.id) + '</code>');
            if (evt.parent_id) html += k('Parent ID', '<code>' + escapeHtml(evt.parent_id) + '</code>');
            html += k('Session', '<code>' + escapeHtml((evt.session_id || '').slice(0, 12)) + '</code>');
            html += '</div>';
            document.getElementById('tab-general').innerHTML = html;
        }

        function renderInput(evt) {
            const fields = getInputFields(evt);
            let html = '<div class="kv">';
            for (const [k, v] of Object.entries(fields)) {
                html += k(k, formatVal(v));
            }
            html += '</div>';
            document.getElementById('tab-input').innerHTML = html || '<em>No input fields</em>';
        }

        function renderOutput(evt) {
            // Error banner
            let html = '';
            if (evt.type === 'error' || evt.status === 'failed') {
                html += '<div class="error-banner">';
                html += '<div class="title">\u274C ' + escapeHtml(evt.error_type || 'Error') + '</div>';
                html += '<div class="msg">' + escapeHtml(evt.error_message || evt.content || '') + '</div>';
                if (evt.stack_trace) {
                    html += '<pre>' + escapeHtml(evt.stack_trace) + '</pre>';
                }
                html += '</div>';
            }
            const fields = getOutputFields(evt);
            html += '<div class="kv">';
            for (const [k, v] of Object.entries(fields)) {
                html += k(k, formatVal(v));
            }
            html += '</div>';
            document.getElementById('tab-output').innerHTML = html || '<em>No output fields</em>';
        }

        function renderMetrics(evt) {
            const dur = evt.duration > 0 ? evt.duration + 'ms' : '-';
            let html = '<div class="kv">';
            html += k('Duration', dur);
            if (evt.token_count !== undefined) html += k('Tokens', evt.token_count);
            if (evt.cost_usd !== undefined && evt.cost_usd > 0) html += k('Cost', '$' + evt.cost_usd.toFixed(4));
            if (evt.finish_reason) html += k('Finish Reason', escapeHtml(evt.finish_reason));
            html += '</div>';
            document.getElementById('tab-metrics').innerHTML = html;
        }

        function renderRaw(evt) {
            document.getElementById('tab-raw').innerHTML = renderJson(evt);
        }

        function getInputFields(evt) {
            const m = { ...evt };
            delete m.id; delete m.parent_id; delete m.session_id;
            delete m.timestamp; delete m.duration; delete m.type; delete m.status;
            // Remove output-ish fields
            delete m.content; delete m.result; delete m.response_status;
            delete m.response_body; delete m.token_count; delete m.finish_reason;
            delete m.cost_usd; delete m.error_type; delete m.error_message;
            delete m.stack_trace; delete m.source_event_id; delete m.total_events;
            delete m.error; delete m.is_error; delete m.row_count; delete m.value_before;
            delete m.value_after; delete m.documents;
            return m;
        }

        function getOutputFields(evt) {
            const keep = {};
            if (evt.content !== undefined) keep.content = evt.content;
            if (evt.result !== undefined) keep.result = evt.result;
            if (evt.response_status !== undefined) keep.response_status = evt.response_status;
            if (evt.response_body !== undefined) keep.response_body = evt.response_body;
            if (evt.token_count !== undefined) keep.token_count = evt.token_count;
            if (evt.finish_reason !== undefined) keep.finish_reason = evt.finish_reason;
            if (evt.total_events !== undefined) keep.total_events = evt.total_events;
            if (evt.row_count !== undefined) keep.row_count = evt.row_count;
            if (evt.value_after !== undefined) keep.value_after = evt.value_after;
            return keep;
        }

        function k(key, val) { return '<div class="key">' + key + '</div><div class="val">' + val + '</div>'; }
        function formatVal(v) {
            if (v === null || v === undefined) return '<span class="json-null">null</span>';
            if (typeof v === 'boolean') return '<span class="json-boolean">' + v + '</span>';
            if (typeof v === 'number') return '<span class="json-number">' + v + '</span>';
            if (typeof v === 'string') return v.length > 200 ? escapeHtml(v.slice(0,200)) + '...' : escapeHtml(v);
            if (typeof v === 'object') return renderJson(v);
            return String(v);
        }

        function renderJson(data, depth) {
            depth = depth || 0;
            if (data === null) return '<span class="json-null">null</span>';
            if (typeof data === 'boolean') return '<span class="json-boolean">' + data + '</span>';
            if (typeof data === 'number') return '<span class="json-number">' + data + '</span>';
            if (typeof data === 'string') return '<span class="json-string">"' + escapeHtml(data.length > 100 ? data.slice(0,100)+'...' : data) + '"</span>';

            if (Array.isArray(data)) {
                if (data.length === 0) return '<span class="json-null">[]</span>';
                var id = 'j' + Math.random().toString(36).slice(2);
                var collapsed = depth > 2;
                var html = '<span class="json-toggle" onclick="toggleJson(\\'' + id + '\\')">' + (collapsed ? '\\u25b6' : '\\u25bc') + '</span> [';
                html += '<div id="' + id + '" class="json-node" style="display:' + (collapsed ? 'none' : 'block') + '">';
                for (var i = 0; i < data.length; i++) {
                    html += '<span class="json-number">' + i + '</span>: ' + renderJson(data[i], depth+1);
                    if (i < data.length-1) html += ',';
                    html += '<br>';
                }
                html += '</div>]';
                return html;
            }

            if (typeof data === 'object') {
                var keys = Object.keys(data);
                if (keys.length === 0) return '<span class="json-null">{}</span>';
                var id = 'j' + Math.random().toString(36).slice(2);
                var collapsed = depth > 2;
                var html = '<span class="json-toggle" onclick="toggleJson(\\'' + id + '\\')">' + (collapsed ? '\\u25b6' : '\\u25bc') + '</span> {';
                html += '<div id="' + id + '" class="json-node" style="display:' + (collapsed ? 'none' : 'block') + '">';
                for (var i = 0; i < keys.length; i++) {
                    html += '<span class="json-key">"' + escapeHtml(keys[i]) + '"</span>: ' + renderJson(data[keys[i]], depth+1);
                    if (i < keys.length-1) html += ',';
                    html += '<br>';
                }
                html += '</div>}';
                return html;
            }

            return String(data);
        }

        function escapeHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
        function toggleJson(id) {
            var el = document.getElementById(id);
            if (el) {
                var toggle = el.previousElementSibling;
                var isHidden = el.style.display === 'none';
                el.style.display = isHidden ? 'block' : 'none';
                if (toggle && toggle.classList.contains('json-toggle')) {
                    toggle.textContent = isHidden ? '\\u25bc' : '\\u25b6';
                }
            }
        }

        vscode.postMessage({ type: 'ready' });
    </script>
</body>
</html>`;
  }
};

// src/panels/CurrentStatePanel.ts
var vscode6 = __toESM(require("vscode"));
var CurrentStatePanel = class {
  constructor(store2) {
    this.store = store2;
    this._disposables.push(
      store2.onEventAdded(() => this.refresh()),
      store2.onActiveSessionChanged(() => this.refresh())
    );
    this._startTimer();
  }
  _onDidChangeTreeData = new vscode6.EventEmitter();
  onDidChangeTreeData = this._onDidChangeTreeData.event;
  _timer = null;
  _disposables = [];
  refresh() {
    this._onDidChangeTreeData.fire(void 0);
  }
  dispose() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    for (const d of this._disposables) {
      d.dispose();
    }
    this._disposables = [];
    this._onDidChangeTreeData.dispose();
  }
  // --- TreeDataProvider ---
  getTreeItem(element) {
    return element;
  }
  getChildren() {
    const session = this.store.getActiveSession();
    if (!session) {
      const item = new vscode6.TreeItem("\u23F8  No Active Session");
      item.tooltip = "Run an agent with agentlens.init() to start debugging";
      return [item];
    }
    const state = this.store.getCurrentState(session.session_id);
    const statusIcon = state.status === "running" ? "\u{1F7E2}" : state.status === "failed" ? "\u{1F534}" : state.status === "completed" ? "\u2705" : "\u23F3";
    const elapsed = state.elapsedMs < 1e3 ? `${state.elapsedMs}ms` : `${(state.elapsedMs / 1e3).toFixed(1)}s`;
    const items = [];
    const main = new vscode6.TreeItem(`${statusIcon} ${state.status} \xB7 ${state.sessionName}`);
    main.tooltip = `Status: ${state.status}
Session: ${state.sessionName}`;
    items.push(main);
    if (state.currentStep && state.currentStep !== "idle") {
      const step = new vscode6.TreeItem(`   Step: ${state.currentStep}`);
      step.iconPath = new vscode6.ThemeIcon("debug-step-into");
      items.push(step);
    }
    if (state.currentModel) {
      const model = new vscode6.TreeItem(`   Model: ${state.currentModel}`);
      model.iconPath = new vscode6.ThemeIcon("symbol-method");
      items.push(model);
    }
    const time = new vscode6.TreeItem(`   Elapsed: ${elapsed}`);
    time.iconPath = new vscode6.ThemeIcon("watch");
    items.push(time);
    return items;
  }
  _startTimer() {
    this._timer = setInterval(() => this.refresh(), 1e3);
  }
};

// src/panels/LiveMetricsPanel.ts
var vscode7 = __toESM(require("vscode"));
var LiveMetricsPanel = class {
  constructor(store2) {
    this.store = store2;
    store2.onEventAdded(() => this.refresh());
    store2.onActiveSessionChanged(() => this.refresh());
  }
  _onDidChangeTreeData = new vscode7.EventEmitter();
  onDidChangeTreeData = this._onDidChangeTreeData.event;
  refresh() {
    this._onDidChangeTreeData.fire(void 0);
  }
  // --- TreeDataProvider ---
  getTreeItem(element) {
    return element;
  }
  getChildren() {
    const session = this.store.getActiveSession();
    if (!session) {
      return [new vscode7.TreeItem("No data")];
    }
    const m = this.store.getMetrics(session.session_id);
    const dur = session.duration_ms < 1e3 ? `${session.duration_ms}ms` : `${(session.duration_ms / 1e3).toFixed(1)}s`;
    const metrics = [
      ["Total Events", m.totalEvents, "list-tree"],
      ["LLM Calls", m.llmCalls, "comment"],
      ["LLM Responses", m.llmResponses, "comment-discussion"],
      ["Tool Calls", m.toolCalls, "tools"],
      ["Token Usage", m.tokenUsage.toLocaleString(), "symbol-number"],
      ["Errors", m.errorCount, m.errorCount > 0 ? "error" : "pass"],
      ["Duration", dur, "watch"]
    ];
    return metrics.map(([label, value, icon]) => {
      const item = new vscode7.TreeItem(label);
      item.description = String(value);
      item.iconPath = new vscode7.ThemeIcon(icon);
      return item;
    });
  }
};

// src/panels/ContextPanel.ts
var ContextPanel = class {
  constructor(extensionUri, store2) {
    this.extensionUri = extensionUri;
    this.store = store2;
    store2.onActiveSessionChanged((id) => {
      this._sessionId = id;
      this._update();
    });
    store2.onEventAdded(({ sessionId }) => {
      if (sessionId === this._sessionId) {
        this._update();
      }
    });
  }
  _view = null;
  _sessionId = null;
  resolveWebviewView(webviewView) {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri]
    };
    webviewView.webview.html = this._getHtml();
    this._update();
  }
  _update() {
    if (!this._view || !this._sessionId) {
      if (this._view) {
        this._view.webview.postMessage({ type: "clear" });
      }
      return;
    }
    const ctx = this.store.getContext(this._sessionId);
    this._view.webview.postMessage({
      type: "updateContext",
      memoryUpdates: ctx.memoryUpdates.map((e) => ({
        operation: e.operation,
        key: e.key,
        valueBefore: e.value_before,
        valueAfter: e.value_after
      })),
      toolResults: ctx.toolResults.map((e) => ({
        toolName: e.tool_name,
        result: e.result,
        isError: e.is_error,
        timestamp: e.timestamp
      })),
      llmResponses: ctx.llmResponses.map((e) => ({
        content: e.content,
        model: e.model,
        tokenCount: e.token_count,
        timestamp: e.timestamp
      }))
    });
  }
  _getHtml() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: var(--vscode-font-family, sans-serif);
            font-size: 12px; color: var(--vscode-foreground);
            background: var(--vscode-sideBar-background); padding: 8px;
            max-height: 240px;
            overflow-y: auto;
        }
        .section { margin-bottom: 12px; }
        .section-title {
            font-weight: 600; font-size: 11px; text-transform: uppercase;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 6px; padding-bottom: 3px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .item {
            padding: 4px 6px; margin-bottom: 4px; border-radius: 3px;
            background: var(--vscode-list-inactiveSelectionBackground);
            font-size: 11px;
        }
        .item .label { color: var(--vscode-descriptionForeground); }
        .item.add { border-left: 3px solid #28a745; }
        .item.update { border-left: 3px solid #007acc; }
        .item.remove { border-left: 3px solid #dc3545; }
        .item.error { border-left: 3px solid #dc3545; }
        .empty { font-style: italic; color: var(--vscode-descriptionForeground); font-size: 11px; }
        pre {
            background: var(--vscode-textCodeBlock-background);
            padding: 6px; border-radius: 3px; font-size: 10px;
            max-height: 100px; overflow: auto; white-space: pre-wrap;
        }
    </style>
</head>
<body>
    <div id="content">
        <div class="section">
            <div class="section-title">\u{1F9E0} Memory Diff</div>
            <div id="memory"></div>
        </div>
        <div class="section">
            <div class="section-title">\u{1F527} Tool Outputs</div>
            <div id="tools"></div>
        </div>
        <div class="section">
            <div class="section-title">\u{1F4AC} LLM Responses</div>
            <div id="llm"></div>
        </div>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        window.addEventListener('message', (e) => {
            const msg = e.data;
            if (msg.type === 'clear') {
                document.getElementById('memory').innerHTML = '<div class="empty">No session selected</div>';
                document.getElementById('tools').innerHTML = '';
                document.getElementById('llm').innerHTML = '';
            } else if (msg.type === 'updateContext') {
                renderMemory(msg.memoryUpdates || []);
                renderTools(msg.toolResults || []);
                renderLLM(msg.llmResponses || []);
            }
        });

        function renderMemory(items) {
            const el = document.getElementById('memory');
            if (items.length === 0) { el.innerHTML = '<div class="empty">No memory updates</div>'; return; }
            // Only allow known operation values as CSS classes
            const KNOWN_OPS = new Set(['add', 'update', 'remove']);
            el.innerHTML = items.slice(-10).reverse().map(m =>
                '<div class="item ' + (KNOWN_OPS.has(m.operation) ? m.operation : '') + '">' +
                '<span class="label">' + escapeHtml((m.operation || '').toUpperCase()) + '</span> ' +
                escapeHtml(m.key || '') +
                (m.valueAfter ? ' <span class="label">\u2192</span> ' + escapeHtml(truncate(JSON.stringify(m.valueAfter), 100)) : '') +
                '</div>'
            ).join('');
        }

        function renderTools(items) {
            const el = document.getElementById('tools');
            if (items.length === 0) { el.innerHTML = '<div class="empty">No tool outputs</div>'; return; }
            el.innerHTML = items.slice(-10).reverse().map(t =>
                '<div class="item' + (t.isError ? ' error' : '') + '">' +
                '<strong>' + escapeHtml(t.toolName || 'tool') + '</strong>' +
                (t.result ? '<pre>' + escapeHtml(truncate(JSON.stringify(t.result, null, 2), 500)) + '</pre>' : '') +
                '</div>'
            ).join('');
        }

        function renderLLM(items) {
            const el = document.getElementById('llm');
            if (items.length === 0) { el.innerHTML = '<div class="empty">No responses</div>'; return; }
            el.innerHTML = items.slice(-10).reverse().map(r =>
                '<div class="item">' +
                '<span class="label">' + escapeHtml(r.model || 'LLM') + '</span> \xB7 ' + (r.tokenCount || 0) + ' tokens' +
                '<pre>' + escapeHtml(truncate(r.content || '', 300)) + '</pre>' +
                '</div>'
            ).join('');
        }

        function escapeHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
        function truncate(s, n) { return s.length > n ? s.slice(0,n) + '...' : s; }
    </script>
</body>
</html>`;
  }
};

// src/extension.ts
var client;
var store;
var currentStatePanel;
function activate(context) {
  console.log("AgentLens extension activated");
  store = new Store();
  const statusPanel = new StatusPanel();
  context.subscriptions.push(
    vscode8.window.createTreeView("agentlens.status", {
      treeDataProvider: statusPanel
    })
  );
  currentStatePanel = new CurrentStatePanel(store);
  context.subscriptions.push(currentStatePanel);
  context.subscriptions.push(
    vscode8.window.createTreeView("agentlens.currentState", {
      treeDataProvider: currentStatePanel
    })
  );
  const metricsPanel = new LiveMetricsPanel(store);
  context.subscriptions.push(
    vscode8.window.createTreeView("agentlens.metrics", {
      treeDataProvider: metricsPanel
    })
  );
  const sessionPanel = new SessionListPanel(store);
  context.subscriptions.push(
    vscode8.window.createTreeView("agentlens.sessions", {
      treeDataProvider: sessionPanel
    })
  );
  const treePanel = new ExecutionTreePanel(store);
  const treeView = vscode8.window.createTreeView("agentlens.executionTree", {
    treeDataProvider: treePanel
  });
  context.subscriptions.push(treeView);
  const inspectorPanel = new InspectorPanel(context.extensionUri);
  context.subscriptions.push(
    vscode8.window.registerWebviewViewProvider("agentlens.inspector", inspectorPanel)
  );
  const contextPanel = new ContextPanel(context.extensionUri, store);
  context.subscriptions.push(
    vscode8.window.registerWebviewViewProvider("agentlens.context", contextPanel)
  );
  context.subscriptions.push(
    treeView.onDidChangeSelection((e) => {
      if (e.selection.length > 0) {
        const item = e.selection[0];
        if (item && "event" in item) {
          inspectorPanel.showEvent(item.event);
        }
      }
    })
  );
  context.subscriptions.push(
    vscode8.commands.registerCommand("agentlens.selectSession", (sessionId) => {
      store.setActiveSession(sessionId);
      treePanel.setSession(sessionId);
      sessionPanel.refresh();
    })
  );
  client = new AgentLensClient("127.0.0.1", 9876);
  context.subscriptions.push(
    client.onStatusChange((status) => {
      statusPanel.setStatus(status, client.url);
    })
  );
  context.subscriptions.push(
    client.onSessionList((sessions) => {
      store.addSessions(sessions);
    })
  );
  context.subscriptions.push(
    client.onEvent((event) => {
      store.addEvent(event);
    })
  );
  client.connect();
  context.subscriptions.push(
    new vscode8.Disposable(() => {
      client.disconnect();
      currentStatePanel.dispose();
    })
  );
}
function deactivate() {
  if (client) client.disconnect();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map
