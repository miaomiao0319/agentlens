import * as vscode from 'vscode';
import { AgentLensClient } from './client';
import { Store } from './store';
import { StatusPanel } from './panels/StatusPanel';
import { SessionListPanel } from './panels/SessionListPanel';
import { ExecutionTreePanel } from './panels/ExecutionTreePanel';
import { InspectorPanel } from './panels/InspectorPanel';
import { CurrentStatePanel } from './panels/CurrentStatePanel';
import { LiveMetricsPanel } from './panels/LiveMetricsPanel';
import { ContextPanel } from './panels/ContextPanel';

let client: AgentLensClient;
let store: Store;
let currentStatePanel: CurrentStatePanel;

export function activate(context: vscode.ExtensionContext) {
    console.log('AgentLens extension activated');

    // --- Store ---
    store = new Store();

    // --- Status Panel (1) ---
    const statusPanel = new StatusPanel();
    context.subscriptions.push(
        vscode.window.createTreeView('agentlens.status', {
            treeDataProvider: statusPanel,
        }),
    );

    // --- Current State Panel (2) ---
    currentStatePanel = new CurrentStatePanel(store);
    context.subscriptions.push(currentStatePanel);
    context.subscriptions.push(
        vscode.window.createTreeView('agentlens.currentState', {
            treeDataProvider: currentStatePanel,
        }),
    );

    // --- Live Metrics Panel (3) ---
    const metricsPanel = new LiveMetricsPanel(store);
    context.subscriptions.push(
        vscode.window.createTreeView('agentlens.metrics', {
            treeDataProvider: metricsPanel,
        }),
    );

    // --- Session List Panel (4) ---
    const sessionPanel = new SessionListPanel(store);
    context.subscriptions.push(
        vscode.window.createTreeView('agentlens.sessions', {
            treeDataProvider: sessionPanel,
        }),
    );

    // --- Execution Tree Panel (5) ---
    const treePanel = new ExecutionTreePanel(store);
    const treeView = vscode.window.createTreeView('agentlens.executionTree', {
        treeDataProvider: treePanel,
    });
    context.subscriptions.push(treeView);

    // --- Inspector Panel (6) ---
    const inspectorPanel = new InspectorPanel(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('agentlens.inspector', inspectorPanel),
    );

    // --- Context Panel (7) ---
    const contextPanel = new ContextPanel(context.extensionUri, store);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('agentlens.context', contextPanel),
    );

    // --- Tree selection → Inspector ---
    context.subscriptions.push(
        treeView.onDidChangeSelection((e) => {
            if (e.selection.length > 0) {
                const item = e.selection[0];
                if (item && 'event' in item) {
                    inspectorPanel.showEvent((item as { event: import('./types').BaseEvent }).event);
                }
            }
        }),
    );

    // --- Select Session command ---
    context.subscriptions.push(
        vscode.commands.registerCommand('agentlens.selectSession', (sessionId: string) => {
            store.setActiveSession(sessionId);
            treePanel.setSession(sessionId);
            sessionPanel.refresh();
        }),
    );

    // --- WebSocket Client ---
    client = new AgentLensClient('127.0.0.1', 9876);

    context.subscriptions.push(
        client.onStatusChange((status) => {
            statusPanel.setStatus(status, client.url);
        }),
    );

    context.subscriptions.push(
        client.onSessionList((sessions) => {
            store.addSessions(sessions);
        }),
    );

    context.subscriptions.push(
        client.onEvent((event) => {
            store.addEvent(event);
        }),
    );

    client.connect();

    // Cleanup
    context.subscriptions.push(
        new vscode.Disposable(() => {
            client.disconnect();
            currentStatePanel.dispose();
        }),
    );
}

export function deactivate() {
    if (client) client.disconnect();
}
