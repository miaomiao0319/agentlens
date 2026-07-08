/**
 * InspectorPanel — Webview-based detail view for a selected event.
 *
 * Shows 5 tabs: General, Input, Output, Metrics, Raw.
 * Communication via postMessage.
 */

import * as vscode from 'vscode';
import type { BaseEvent } from '../types';

export class InspectorPanel implements vscode.WebviewViewProvider {
    private _view: vscode.WebviewView | null = null;
    private _currentEvent: BaseEvent | null = null;

    constructor(
        private readonly extensionUri: vscode.Uri,
    ) {}

    // --- WebviewViewProvider ---

    resolveWebviewView(webviewView: vscode.WebviewView): void {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri],
        };

        webviewView.webview.html = this._getHtml();

        webviewView.webview.onDidReceiveMessage((msg) => {
            if (msg.type === 'ready') {
                // Re-send current event if any
                if (this._currentEvent) {
                    this._postEvent(this._currentEvent);
                }
            }
        });
    }

    // --- public API ---

    showEvent(event: BaseEvent): void {
        this._currentEvent = event;
        this._postEvent(event);
    }

    clear(): void {
        this._currentEvent = null;
        if (this._view) {
            this._view.webview.postMessage({ type: 'clear' });
        }
    }

    // --- internal ---

    private _postEvent(event: BaseEvent): void {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'showEvent',
                event: JSON.parse(JSON.stringify(event)),
            });
        }
    }

    private _getHtml(): string {
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
                html += '<div class="title">❌ ' + escapeHtml(evt.error_type || 'Error') + '</div>';
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
}
