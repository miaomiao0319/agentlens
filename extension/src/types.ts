/**
 * AgentLens TypeScript type definitions — mirrors sdk/agentlens/schema.py.
 *
 * These types represent the JSON messages received over the WebSocket
 * from the AgentLens Python SDK.
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export type EventType =
    | 'llm_call'
    | 'llm_response'
    | 'tool_call'
    | 'tool_result'
    | 'http_request'
    | 'database_query'
    | 'memory_update'
    | 'retrieval'
    | 'embedding'
    | 'error'
    | 'agent_start'
    | 'agent_end'
    | 'custom';

export type EventStatus = 'running' | 'success' | 'failed' | 'pending';

// ---------------------------------------------------------------------------
// Base Event (common fields)
// ---------------------------------------------------------------------------

export interface BaseEvent {
    id: string;
    parent_id: string | null;
    session_id: string;
    timestamp: number;
    duration: number;
    type: EventType;
    status: EventStatus;
}

// ---------------------------------------------------------------------------
// Concrete Event types
// ---------------------------------------------------------------------------

export interface LLMCallEvent extends BaseEvent {
    type: 'llm_call';
    model: string;
    messages: Record<string, unknown>[];
    parameters: Record<string, unknown>;
}

export interface LLMResponseEvent extends BaseEvent {
    type: 'llm_response';
    model: string;
    content: string;
    token_count: number;
    finish_reason: string;
    cost_usd: number;
}

export interface ToolCallEvent extends BaseEvent {
    type: 'tool_call';
    tool_name: string;
    parameters: Record<string, unknown>;
}

export interface ToolResultEvent extends BaseEvent {
    type: 'tool_result';
    tool_name: string;
    result: unknown;
    is_error: boolean;
}

export interface HTTPRequestEvent extends BaseEvent {
    type: 'http_request';
    method: string;
    url: string;
    request_headers: Record<string, string>;
    request_body: string | null;
    response_status: number | null;
    response_body: string | null;
}

export interface DatabaseQueryEvent extends BaseEvent {
    type: 'database_query';
    query: string;
    params: unknown;
    row_count: number | null;
}

export interface MemoryUpdateEvent extends BaseEvent {
    type: 'memory_update';
    operation: string;
    key: string;
    value_before: unknown;
    value_after: unknown;
}

export interface RetrievalEvent extends BaseEvent {
    type: 'retrieval';
    query: string;
    documents: Record<string, unknown>[];
    top_k: number;
}

export interface EmbeddingEvent extends BaseEvent {
    type: 'embedding';
    model: string;
    input_text: string;
    token_count: number;
}

export interface ErrorEvent extends BaseEvent {
    type: 'error';
    error_type: string;
    error_message: string;
    stack_trace: string | null;
    source_event_id: string | null;
}

export interface AgentStartEvent extends BaseEvent {
    type: 'agent_start';
    agent_name: string;
    framework: string;
}

export interface AgentEndEvent extends BaseEvent {
    type: 'agent_end';
    agent_name: string;
    total_events: number;
    error: string | null;
}

export interface CustomEvent extends BaseEvent {
    type: 'custom';
    name: string;
    data: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Union type and discriminator map
// ---------------------------------------------------------------------------

export type AgentLensEvent =
    | LLMCallEvent
    | LLMResponseEvent
    | ToolCallEvent
    | ToolResultEvent
    | HTTPRequestEvent
    | DatabaseQueryEvent
    | MemoryUpdateEvent
    | RetrievalEvent
    | EmbeddingEvent
    | ErrorEvent
    | AgentStartEvent
    | AgentEndEvent
    | CustomEvent;

// ---------------------------------------------------------------------------
// Wire protocol messages
// ---------------------------------------------------------------------------

export interface ConnectedMessage {
    type: 'connected';
    version: string;
}

export interface SessionSummary {
    session_id: string;
    framework: string;
    agent_name: string;
    created_at: number;
    ended_at: number | null;
    status: string;
    event_count: number;
    duration_ms: number;
}

export interface SessionListMessage {
    type: 'session_list';
    sessions: SessionSummary[];
}

export type WireMessage = ConnectedMessage | SessionListMessage | AgentLensEvent;

// ---------------------------------------------------------------------------
// Connection status
// ---------------------------------------------------------------------------

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';
