/**
 * StatusPanel — displays the WebSocket connection status as a TreeView item.
 */

import * as vscode from 'vscode';
import type { ConnectionStatus } from '../types';

export class StatusPanel implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private _status: ConnectionStatus = 'disconnected';
    private _url = '';

    // --- public API ---

    setStatus(status: ConnectionStatus, url: string = ''): void {
        this._status = status;
        this._url = url;
        this._onDidChangeTreeData.fire(undefined);
    }

    // --- TreeDataProvider ---

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(): vscode.TreeItem[] {
        let icon: string;
        let label: string;
        let tooltip: string;

        switch (this._status) {
            case 'connected':
                icon = '🟢';
                label = `Connected — ${this._url}`;
                tooltip = 'AgentLens SDK connected';
                break;
            case 'connecting':
                icon = '🟡';
                label = `Connecting — ${this._url}`;
                tooltip = 'Attempting to connect to AgentLens SDK...';
                break;
            case 'disconnected':
            default:
                icon = '🔴';
                label = 'Disconnected — Waiting for SDK...';
                tooltip = 'Run agentlens.init() in your Python script';
                break;
        }

        const item = new vscode.TreeItem(`${icon}  ${label}`);
        item.tooltip = tooltip;
        item.contextValue = 'agentlensStatus';
        return [item];
    }
}
