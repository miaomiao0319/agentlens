/**
 * SessionListPanel — displays all Debug Sessions in a TreeView.
 */

import * as vscode from 'vscode';
import { Store, type SessionState } from '../store';

export class SessionListPanel implements vscode.TreeDataProvider<SessionTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<SessionTreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(private store: Store) {
        // Refresh when sessions change
        store.onSessionAdded(() => this.refresh());
        store.onSessionUpdated(() => this.refresh());
    }

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    // --- TreeDataProvider ---

    getTreeItem(element: SessionTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(): SessionTreeItem[] {
        return this.store.listSessions().map((s) => this._toTreeItem(s));
    }

    // --- helpers ---

    private _toTreeItem(session: SessionState): SessionTreeItem {
        const isActive = this.store.activeSessionId === session.session_id;

        const statusIcon =
            session.status === 'running' ? '🟢'
            : session.status === 'failed' ? '🔴'
            : '✅';

        const label = `${statusIcon} ${session.agent_name || session.session_id.slice(0, 8)}`;
        const shortId = session.session_id.slice(0, 12);

        const dur = session.duration_ms < 1000
            ? `${session.duration_ms}ms`
            : `${(session.duration_ms / 1000).toFixed(1)}s`;

        const item = new SessionTreeItem(
            label,
            isActive ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.None,
        );
        item.description = `${session.event_count} events · ${dur}`;
        item.tooltip = [
            `Session: ${shortId}`,
            `Framework: ${session.framework || 'unknown'}`,
            `Status: ${session.status}`,
            `Events: ${session.event_count}`,
            `Duration: ${dur}`,
        ].join('\n');
        item.id = session.session_id;
        item.contextValue = 'session';
        item.iconPath = isActive
            ? new vscode.ThemeIcon('arrow-right')
            : undefined;

        // Click handler
        item.command = {
            command: 'agentlens.selectSession',
            title: 'Select Session',
            arguments: [session.session_id],
        };

        return item;
    }
}

export class SessionTreeItem extends vscode.TreeItem {
    constructor(label: string, collapsibleState: vscode.TreeItemCollapsibleState) {
        super(label, collapsibleState);
    }
}
