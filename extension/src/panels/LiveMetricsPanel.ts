/**
 * LiveMetricsPanel — real-time execution statistics.
 */

import * as vscode from 'vscode';
import { Store } from '../store';

export class LiveMetricsPanel implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(private store: Store) {
        store.onEventAdded(() => this.refresh());
        store.onActiveSessionChanged(() => this.refresh());
    }

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    // --- TreeDataProvider ---

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(): vscode.TreeItem[] {
        const session = this.store.getActiveSession();
        if (!session) {
            return [new vscode.TreeItem('No data')];
        }

        const m = this.store.getMetrics(session.session_id);
        const dur = session.duration_ms < 1000
            ? `${session.duration_ms}ms`
            : `${(session.duration_ms / 1000).toFixed(1)}s`;

        const metrics: Array<[string, string | number, string]> = [
            ['Total Events', m.totalEvents, 'list-tree'],
            ['LLM Calls', m.llmCalls, 'comment'],
            ['LLM Responses', m.llmResponses, 'comment-discussion'],
            ['Tool Calls', m.toolCalls, 'tools'],
            ['Token Usage', m.tokenUsage.toLocaleString(), 'symbol-number'],
            ['Errors', m.errorCount, m.errorCount > 0 ? 'error' : 'pass'],
            ['Duration', dur, 'watch'],
        ];

        return metrics.map(([label, value, icon]) => {
            const item = new vscode.TreeItem(label);
            item.description = String(value);
            item.iconPath = new vscode.ThemeIcon(icon);
            return item;
        });
    }
}
