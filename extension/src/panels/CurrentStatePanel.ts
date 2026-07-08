/**
 * CurrentStatePanel — always-visible live status of the active session.
 */

import * as vscode from 'vscode';
import { Store } from '../store';

export class CurrentStatePanel implements vscode.TreeDataProvider<vscode.TreeItem>, vscode.Disposable {
    private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private _timer: NodeJS.Timeout | null = null;
    private _disposables: vscode.Disposable[] = [];

    constructor(private store: Store) {
        this._disposables.push(
            store.onEventAdded(() => this.refresh()),
            store.onActiveSessionChanged(() => this.refresh()),
        );
        this._startTimer();
    }

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    dispose(): void {
        if (this._timer) { clearInterval(this._timer); this._timer = null; }
        for (const d of this._disposables) { d.dispose(); }
        this._disposables = [];
        this._onDidChangeTreeData.dispose();
    }

    // --- TreeDataProvider ---

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(): vscode.TreeItem[] {
        const session = this.store.getActiveSession();
        if (!session) {
            const item = new vscode.TreeItem('⏸  No Active Session');
            item.tooltip = 'Run an agent with agentlens.init() to start debugging';
            return [item];
        }

        const state = this.store.getCurrentState(session.session_id);
        const statusIcon = state.status === 'running' ? '🟢'
            : state.status === 'failed' ? '🔴'
            : state.status === 'completed' ? '✅'
            : '⏳';

        const elapsed = state.elapsedMs < 1000
            ? `${state.elapsedMs}ms`
            : `${(state.elapsedMs / 1000).toFixed(1)}s`;

        const items: vscode.TreeItem[] = [];

        // Main status
        const main = new vscode.TreeItem(`${statusIcon} ${state.status} · ${state.sessionName}`);
        main.tooltip = `Status: ${state.status}\nSession: ${state.sessionName}`;
        items.push(main);

        // Current step
        if (state.currentStep && state.currentStep !== 'idle') {
            const step = new vscode.TreeItem(`   Step: ${state.currentStep}`);
            step.iconPath = new vscode.ThemeIcon('debug-step-into');
            items.push(step);
        }

        // Model
        if (state.currentModel) {
            const model = new vscode.TreeItem(`   Model: ${state.currentModel}`);
            model.iconPath = new vscode.ThemeIcon('symbol-method');
            items.push(model);
        }

        // Elapsed
        const time = new vscode.TreeItem(`   Elapsed: ${elapsed}`);
        time.iconPath = new vscode.ThemeIcon('watch');
        items.push(time);

        return items;
    }

    private _startTimer(): void {
        this._timer = setInterval(() => this.refresh(), 1000);
    }
}
