/**
 * ExecutionTreePanel — recursive tree visualization of agent execution.
 */

import * as vscode from 'vscode';
import { Store } from '../store';
import type { BaseEvent } from '../types';

export class ExecutionTreePanel implements vscode.TreeDataProvider<EventTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<EventTreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private _sessionId: string | null = null;

    constructor(private store: Store) {
        store.onActiveSessionChanged((id) => {
            this._sessionId = id;
            this.refresh();
        });
        store.onEventAdded(({ sessionId }) => {
            if (sessionId === this._sessionId) {
                this.refresh();
            }
        });
    }

    setSession(sessionId: string | null): void {
        this._sessionId = sessionId;
        this.refresh();
    }

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    // --- TreeDataProvider ---

    getTreeItem(element: EventTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: EventTreeItem): EventTreeItem[] {
        if (!this._sessionId) return [];

        if (!element) {
            // Root level: events with no parent
            return this.store.getEventTree(this._sessionId).map((e) => this._toItem(e));
        }

        // Children of a specific event
        return this.store.getChildrenOf(element.event.id, this._sessionId).map((e) => this._toItem(e));
    }

    getParent(element: EventTreeItem): EventTreeItem | null {
        if (!element.event.parent_id || !this._sessionId) return null;

        const session = this.store.getSession(this._sessionId);
        if (!session) return null;

        const parent = session.events.find((e) => e.id === element.event.parent_id);
        if (!parent) return null;

        return this._toItem(parent);
    }

    // --- helpers ---

    private _toItem(event: BaseEvent): EventTreeItem {
        const label = this._formatLabel(event);
        const icon = this._getIcon(event);
        const hasChildren = this._sessionId
            ? this.store.getChildrenOf(event.id, this._sessionId).length > 0
            : false;

        const collapsible = hasChildren
            ? vscode.TreeItemCollapsibleState.Expanded
            : vscode.TreeItemCollapsibleState.None;

        const item = new EventTreeItem(label, collapsible, event);

        // Description (right-aligned text)
        const durStr = event.duration > 0
            ? event.duration < 1000 ? `${event.duration}ms` : `${(event.duration / 1000).toFixed(1)}s`
            : '';
        item.description = durStr;

        // Icon
        item.iconPath = new vscode.ThemeIcon(
            icon,
            event.status === 'running' ? new vscode.ThemeColor('charts.blue')
            : event.status === 'failed' ? new vscode.ThemeColor('charts.red')
            : undefined,
        );

        // Running animation
        if (event.status === 'running') {
            item.iconPath = new vscode.ThemeIcon('sync~spin');
        }

        // Tooltip
        item.tooltip = `${event.type} · ${event.status}\nDuration: ${durStr}\nID: ${event.id}`;

        return item;
    }

    private _formatLabel(event: BaseEvent): string {
        switch (event.type) {
            case 'agent_start': {
                const e = event as { agent_name: string };
                return `Agent: ${e.agent_name || 'start'}`;
            }
            case 'agent_end': {
                const e = event as { total_events: number };
                return `Agent End · ${e.total_events || 0} events`;
            }
            case 'llm_call': {
                const e = event as { model: string };
                return `LLM · ${e.model || 'unknown'}`;
            }
            case 'llm_response': {
                const e = event as { token_count: number };
                return `Response · ${e.token_count || 0} tokens`;
            }
            case 'tool_call': {
                const e = event as { tool_name: string };
                return `Tool · ${e.tool_name || 'unknown'}`;
            }
            case 'tool_result': {
                const e = event as { tool_name: string; is_error: boolean };
                const prefix = e.is_error ? '❌ ' : '';
                return `${prefix}Result · ${e.tool_name || 'unknown'}`;
            }
            case 'http_request': {
                const e = event as { method: string; url: string };
                return `${e.method || 'GET'} ${e.url || ''}`;
            }
            case 'database_query': {
                const e = event as { query: string };
                const short = (e.query || '').slice(0, 60);
                return `DB · ${short}`;
            }
            case 'memory_update': {
                const e = event as { operation: string; key: string };
                return `Memory · ${e.operation} ${e.key || ''}`;
            }
            case 'retrieval': {
                const e = event as { query: string };
                return `Retrieval · ${(e.query || '').slice(0, 50)}`;
            }
            case 'embedding': {
                const e = event as { model: string };
                return `Embed · ${e.model || 'unknown'}`;
            }
            case 'error': {
                const e = event as { error_type: string; error_message: string };
                return `${e.error_type || 'Error'}: ${(e.error_message || '').slice(0, 80)}`;
            }
            case 'custom': {
                const e = event as { name: string };
                return `Custom · ${e.name || 'event'}`;
            }
            default:
                return event.type;
        }
    }

    private _getIcon(_event: BaseEvent): string {
        const icons: Record<string, string> = {
            agent_start: 'debug-start',
            agent_end: 'debug-stop',
            llm_call: 'comment',
            llm_response: 'comment-discussion',
            tool_call: 'tools',
            tool_result: 'pass',
            http_request: 'globe',
            database_query: 'database',
            memory_update: 'archive',
            retrieval: 'search',
            embedding: 'symbol-numeric',
            error: 'error',
            custom: 'symbol-misc',
        };
        return icons[_event.type] || 'circle-outline';
    }
}

export class EventTreeItem extends vscode.TreeItem {
    constructor(
        label: string,
        collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly event: BaseEvent,
    ) {
        super(label, collapsibleState);
        this.contextValue = 'event';
        this.id = event.id;
    }
}
