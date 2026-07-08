/**
 * ContextPanel — displays agent internal state: Memory Diff, Tool Outputs, etc.
 */

import * as vscode from 'vscode';
import { Store } from '../store';

export class ContextPanel implements vscode.WebviewViewProvider {
    private _view: vscode.WebviewView | null = null;
    private _sessionId: string | null = null;

    constructor(
        private readonly extensionUri: vscode.Uri,
        private store: Store,
    ) {
        store.onActiveSessionChanged((id) => {
            this._sessionId = id;
            this._update();
        });
        store.onEventAdded(({ sessionId }) => {
            if (sessionId === this._sessionId) {
                this._update();
            }
        });
    }

    resolveWebviewView(webviewView: vscode.WebviewView): void {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri],
        };
        webviewView.webview.html = this._getHtml();
        this._update();
    }

    private _update(): void {
        if (!this._view || !this._sessionId) {
            if (this._view) {
                this._view.webview.postMessage({ type: 'clear' });
            }
            return;
        }

        const ctx = this.store.getContext(this._sessionId);
        this._view.webview.postMessage({
            type: 'updateContext',
            memoryUpdates: ctx.memoryUpdates.map((e) => ({
                operation: e.operation,
                key: e.key,
                valueBefore: e.value_before,
                valueAfter: e.value_after,
            })),
            toolResults: ctx.toolResults.map((e) => ({
                toolName: e.tool_name,
                result: e.result,
                isError: e.is_error,
                timestamp: e.timestamp,
            })),
            llmResponses: ctx.llmResponses.map((e) => ({
                content: e.content,
                model: e.model,
                tokenCount: e.token_count,
                timestamp: e.timestamp,
            })),
        });
    }

    private _getHtml(): string {
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
            <div class="section-title">🧠 Memory Diff</div>
            <div id="memory"></div>
        </div>
        <div class="section">
            <div class="section-title">🔧 Tool Outputs</div>
            <div id="tools"></div>
        </div>
        <div class="section">
            <div class="section-title">💬 LLM Responses</div>
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
                (m.valueAfter ? ' <span class="label">→</span> ' + escapeHtml(truncate(JSON.stringify(m.valueAfter), 100)) : '') +
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
                '<span class="label">' + escapeHtml(r.model || 'LLM') + '</span> · ' + (r.tokenCount || 0) + ' tokens' +
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
}
