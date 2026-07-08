/**
 * Store — central state management for the AgentLens Extension.
 *
 * Holds all sessions, events, and derived state. Components observe
 * the store via VS Code EventEmitters to react to changes.
 */

import * as vscode from 'vscode';
import type {
    BaseEvent,
    AgentLensEvent,
    SessionSummary,
    MemoryUpdateEvent,
    ToolResultEvent,
    LLMResponseEvent,
} from './types';

// ---------------------------------------------------------------------------
// Session state
// ---------------------------------------------------------------------------

export interface SessionState extends SessionSummary {
    events: BaseEvent[];
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

export interface MetricsSnapshot {
    totalEvents: number;
    llmCalls: number;
    toolCalls: number;
    llmResponses: number;
    tokenUsage: number;
    errorCount: number;
}

// ---------------------------------------------------------------------------
// Current state
// ---------------------------------------------------------------------------

export interface CurrentStateSnapshot {
    status: string;
    sessionName: string;
    currentStep: string;
    currentModel: string;
    elapsedMs: number;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export interface ContextState {
    memoryUpdates: MemoryUpdateEvent[];
    toolResults: ToolResultEvent[];
    llmResponses: LLMResponseEvent[];
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const MAX_EVENTS_PER_SESSION = 100_000; // safety cap to prevent unbounded memory growth

export class Store {
    private _sessions = new Map<string, SessionState>();
    private _activeSessionId: string | null = null;

    // Event emitters
    private _onSessionAdded = new vscode.EventEmitter<SessionState>();
    readonly onSessionAdded = this._onSessionAdded.event;

    private _onEventAdded = new vscode.EventEmitter<{ sessionId: string; event: BaseEvent }>();
    readonly onEventAdded = this._onEventAdded.event;

    private _onActiveSessionChanged = new vscode.EventEmitter<string | null>();
    readonly onActiveSessionChanged = this._onActiveSessionChanged.event;

    private _onSessionUpdated = new vscode.EventEmitter<SessionState>();
    readonly onSessionUpdated = this._onSessionUpdated.event;

    // --- session management ---

    addSession(summary: SessionSummary): void {
        if (this._sessions.has(summary.session_id)) {
            // Update existing session
            const existing = this._sessions.get(summary.session_id)!;
            existing.status = summary.status;
            existing.ended_at = summary.ended_at;
            existing.event_count = summary.event_count;
            existing.duration_ms = summary.duration_ms;
            this._onSessionUpdated.fire(existing);
            return;
        }

        const state: SessionState = { ...summary, events: [] };
        this._sessions.set(summary.session_id, state);
        this._onSessionAdded.fire(state);

        // Auto-select first session
        if (!this._activeSessionId) {
            this.setActiveSession(summary.session_id);
        }
    }

    addEvent(event: BaseEvent): void {
        let session = this._sessions.get(event.session_id);
        if (!session) {
            // Auto-create session from event if it doesn't exist
            session = {
                session_id: event.session_id,
                framework: '',
                agent_name: '',
                created_at: event.timestamp,
                ended_at: null,
                status: 'running',
                event_count: 0,
                duration_ms: 0,
                events: [],
            };
            this._sessions.set(event.session_id, session);
            this._onSessionAdded.fire(session);
            if (!this._activeSessionId) {
                this.setActiveSession(event.session_id);
            }
        }

        // Deduplicate by event ID: update existing event rather than push duplicate
        const existingIdx = session.events.findIndex((e) => e.id === event.id);
        if (existingIdx >= 0) {
            session.events[existingIdx] = event;
        } else {
            // Silently drop events beyond the safety cap
            if (session.events.length >= MAX_EVENTS_PER_SESSION) {
                return;
            }
            session.events.push(event);
        }
        session.event_count = session.events.length;

        // Update session metadata from agent_start/agent_end events
        if (event.type === 'agent_start') {
            const se = event as { agent_name: string; framework: string };
            session.agent_name = se.agent_name || session.agent_name;
            session.framework = se.framework || session.framework;
        }
        if (event.type === 'agent_end') {
            session.status = event.status === 'failed' ? 'failed' : 'completed';
            session.ended_at = event.timestamp;
            session.duration_ms = event.duration || session.duration_ms;
        }

        this._onEventAdded.fire({ sessionId: event.session_id, event });
        this._onSessionUpdated.fire(session);
    }

    addSessions(summaries: SessionSummary[]): void {
        for (const s of summaries) {
            this.addSession(s);
        }
    }

    // --- queries ---

    getSession(sessionId: string): SessionState | undefined {
        return this._sessions.get(sessionId);
    }

    getActiveSession(): SessionState | null {
        if (this._activeSessionId) {
            return this._sessions.get(this._activeSessionId) ?? null;
        }
        return null;
    }

    listSessions(): SessionState[] {
        return Array.from(this._sessions.values())
            .sort((a, b) => b.created_at - a.created_at);
    }

    setActiveSession(sessionId: string | null): void {
        this._activeSessionId = sessionId;
        this._onActiveSessionChanged.fire(sessionId);
    }

    getEventTree(sessionId: string): BaseEvent[] {
        const session = this._sessions.get(sessionId);
        if (!session) return [];

        // Build parent→children map for root events
        const childrenMap = new Map<string, BaseEvent[]>();
        for (const event of session.events) {
            const parentKey = event.parent_id ?? '__root__';
            if (!childrenMap.has(parentKey)) {
                childrenMap.set(parentKey, []);
            }
            childrenMap.get(parentKey)!.push(event);
        }
        return childrenMap.get('__root__') ?? [];
    }

    getChildrenOf(parentId: string, sessionId: string): BaseEvent[] {
        const session = this._sessions.get(sessionId);
        if (!session) return [];
        return session.events.filter((e) => e.parent_id === parentId);
    }

    // --- metrics ---

    getMetrics(sessionId: string): MetricsSnapshot {
        const events = this._sessions.get(sessionId)?.events ?? [];
        let llmCalls = 0, toolCalls = 0, llmResponses = 0, tokenUsage = 0, errorCount = 0;

        for (const e of events) {
            if (e.type === 'llm_call') llmCalls++;
            if (e.type === 'llm_response') {
                llmResponses++;
                tokenUsage += (e as LLMResponseEvent).token_count || 0;
            }
            if (e.type === 'tool_call') toolCalls++;
            if (e.type === 'error' || e.status === 'failed') errorCount++;
        }

        return {
            totalEvents: events.length,
            llmCalls,
            toolCalls,
            llmResponses,
            tokenUsage,
            errorCount,
        };
    }

    getCurrentState(sessionId: string): CurrentStateSnapshot {
        const session = this._sessions.get(sessionId);
        if (!session) {
            return { status: 'none', sessionName: '', currentStep: '', currentModel: '', elapsedMs: 0 };
        }

        const events = session.events;
        const lastRunning = [...events].reverse().find((e) => e.status === 'running');
        const lastLLM = [...events].reverse().find((e) => e.type === 'llm_call');

        const now = Date.now();
        const elapsedMs = session.ended_at
            ? session.ended_at - session.created_at
            : now - session.created_at;

        return {
            status: session.status,
            sessionName: session.agent_name || session.session_id,
            currentStep: lastRunning
                ? `${lastRunning.type} · ${(lastRunning as Record<string, unknown>).tool_name || (lastRunning as Record<string, unknown>).model || ''}`
                : 'idle',
            currentModel: (lastLLM as Record<string, unknown>)?.model as string || '',
            elapsedMs,
        };
    }

    getContext(sessionId: string): ContextState {
        const events = this._sessions.get(sessionId)?.events ?? [];
        return {
            memoryUpdates: events.filter((e) => e.type === 'memory_update') as MemoryUpdateEvent[],
            toolResults: events.filter((e) => e.type === 'tool_result') as ToolResultEvent[],
            llmResponses: events.filter((e) => e.type === 'llm_response') as LLMResponseEvent[],
        };
    }

    // --- lifecycle ---

    clear(): void {
        this._sessions.clear();
        this._activeSessionId = null;
    }

    get activeSessionId(): string | null {
        return this._activeSessionId;
    }
}
