/**
 * AgentLensClient — WebSocket client that connects to the AgentLens SDK server.
 *
 * Handles connection lifecycle, auto-reconnect with exponential backoff,
 * and message dispatch to registered listeners.
 */

import * as vscode from 'vscode';
import { WebSocket } from 'ws';
import type { ConnectionStatus, WireMessage, AgentLensEvent, SessionSummary } from './types';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 9876;
const MAX_RECONNECT_DELAY_MS = 30_000;
const MAX_CONSECUTIVE_FAILURES = 10;
const INITIAL_RECONNECT_DELAY_MS = 1_000;

export class AgentLensClient {
    private _status: ConnectionStatus = 'disconnected';
    private _ws: WebSocket | null = null;
    private _reconnectTimer: NodeJS.Timeout | null = null;
    private _reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
    private _consecutiveFailures = 0;
    private _shouldReconnect = true;

    private _eventListeners: Array<(event: AgentLensEvent) => void> = [];
    private _statusListeners: Array<(status: ConnectionStatus) => void> = [];
    private _sessionListListeners: Array<(sessions: SessionSummary[]) => void> = [];

    constructor(
        public readonly host: string = DEFAULT_HOST,
        public readonly port: number = DEFAULT_PORT,
    ) {}

    // --- public API ---

    get status(): ConnectionStatus {
        return this._status;
    }

    get url(): string {
        return `ws://${this.host}:${this.port}`;
    }

    connect(): void {
        if (this._status === 'connecting' || this._status === 'connected') {
            return;
        }
        this._shouldReconnect = true;
        this._doConnect();
    }

    disconnect(): void {
        this._shouldReconnect = false;
        this._cancelReconnect();
        if (this._ws) {
            try { this._ws.close(); } catch { /* ignore */ }
            this._ws = null;
        }
        this._setStatus('disconnected');
    }

    onEvent(callback: (event: AgentLensEvent) => void): vscode.Disposable {
        this._eventListeners.push(callback);
        return new vscode.Disposable(() => {
            const idx = this._eventListeners.indexOf(callback);
            if (idx >= 0) this._eventListeners.splice(idx, 1);
        });
    }

    onStatusChange(callback: (status: ConnectionStatus) => void): vscode.Disposable {
        this._statusListeners.push(callback);
        return new vscode.Disposable(() => {
            const idx = this._statusListeners.indexOf(callback);
            if (idx >= 0) this._statusListeners.splice(idx, 1);
        });
    }

    onSessionList(callback: (sessions: SessionSummary[]) => void): vscode.Disposable {
        this._sessionListListeners.push(callback);
        return new vscode.Disposable(() => {
            const idx = this._sessionListListeners.indexOf(callback);
            if (idx >= 0) this._sessionListListeners.splice(idx, 1);
        });
    }

    // --- internal ---

    private _setStatus(status: ConnectionStatus): void {
        if (this._status !== status) {
            this._status = status;
            for (const listener of this._statusListeners) {
                try { listener(status); } catch { /* ignore */ }
            }
        }
    }

    private _doConnect(): void {
        this._setStatus('connecting');

        try {
            this._ws = new WebSocket(this.url);
        } catch (err) {
            console.error('[AgentLens] Failed to create WebSocket:', err);
            this._scheduleReconnect();
            return;
        }

        this._ws.on('open', () => {
            console.log(`[AgentLens] Connected to ${this.url}`);
            this._setStatus('connected');
            this._reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
            this._consecutiveFailures = 0;
        });

        this._ws.on('message', (data: Buffer) => {
            try {
                const msg: WireMessage = JSON.parse(data.toString());
                this._dispatch(msg);
            } catch (err) {
                console.error('[AgentLens] Failed to parse message:', err);
            }
        });

        this._ws.on('close', () => {
            console.log('[AgentLens] Connection closed');
            this._ws = null;
            this._setStatus('disconnected');
            if (this._shouldReconnect) {
                this._scheduleReconnect();
            }
        });

        this._ws.on('error', (err: Error) => {
            console.error('[AgentLens] WebSocket error:', err.message);
        });
    }

    private _dispatch(msg: WireMessage): void {
        // Handle protocol-level messages
        if (msg.type === 'connected') {
            console.log(`[AgentLens] SDK version: ${(msg as { version: string }).version}`);
            return;
        }
        if (msg.type === 'session_list') {
            const sessions = (msg as { sessions: SessionSummary[] }).sessions;
            for (const listener of this._sessionListListeners) {
                try { listener(sessions); } catch { /* ignore */ }
            }
            return;
        }

        // It's an event — dispatch to event listeners
        const event = msg as AgentLensEvent;
        for (const listener of this._eventListeners) {
            try { listener(event); } catch { /* ignore */ }
        }
    }

    private _scheduleReconnect(): void {
        if (this._consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            console.log('[AgentLens] Max reconnect attempts reached. Giving up.');
            vscode.window.showWarningMessage(
                `AgentLens: Failed to connect to SDK after ${MAX_CONSECUTIVE_FAILURES} attempts. ` +
                'Make sure agentlens.init() is called in your Python script.',
                'Retry',
            ).then((choice) => {
                if (choice === 'Retry') {
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
            `[AgentLens] Reconnecting in ${this._reconnectDelay / 1000}s (attempt ${this._consecutiveFailures})`
        );

        this._reconnectTimer = setTimeout(() => {
            this._reconnectTimer = null;
            this._doConnect();
            // Exponential backoff with cap
            this._reconnectDelay = Math.min(
                this._reconnectDelay * 2,
                MAX_RECONNECT_DELAY_MS,
            );
        }, this._reconnectDelay);
    }

    private _cancelReconnect(): void {
        if (this._reconnectTimer) {
            clearTimeout(this._reconnectTimer);
            this._reconnectTimer = null;
        }
    }
}
