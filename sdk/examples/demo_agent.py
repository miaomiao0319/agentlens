"""
AgentLens Demo Agent — demonstrates the full SDK pipeline without external APIs.

This example simulates a research agent with LLM calls, tool calls, and
memory updates, streaming all events through the WebSocket server.

Usage:
    python examples/demo_agent.py

Then connect a WebSocket client to ws://127.0.0.1:9876 to see events in real time.
"""

import time
import agentlens


def simulate_llm_call(model: str, prompt: str) -> str:
    """Simulate an LLM API call (no real API key needed)."""
    time.sleep(0.15)
    return f"[{model}] Responding to: {prompt[:50]}... This is a simulated response."


def simulate_tool_call(tool_name: str, params: dict) -> dict:
    """Simulate a tool invocation."""
    time.sleep(0.08)
    return {
        "tool": tool_name,
        "params": params,
        "results": [
            {"title": "Result 1", "score": 0.95},
            {"title": "Result 2", "score": 0.87},
            {"title": "Result 3", "score": 0.72},
        ],
    }


def main():
    # --- One line to start AgentLens ---
    runtime = agentlens.init(auto_detect=False)
    print(f"AgentLens server running on ws://127.0.0.1:9876")
    print(f"Connect the VS Code Extension to see live events.\n")

    # Create a debug session
    session = runtime.session_manager.create_session(
        framework="demo",
        agent_name="research_agent",
    )

    # Shortcut: publish to event bus AND track in session
    def emit(event):
        runtime.event_bus.publish(event)
        runtime.session_manager.add_event(session.session_id, event)

    from agentlens.schema import (
        AgentStartEvent,
        LLMCallEvent,
        LLMResponseEvent,
        ToolCallEvent,
        ToolResultEvent,
        MemoryUpdateEvent,
        AgentEndEvent,
    )

    # 1. Agent starts
    start = AgentStartEvent(
        session_id=session.session_id,
        agent_name="research_agent",
        framework="demo",
    )
    start.mark_success()
    emit(start)

    # 2. LLM Call — analyze the query
    llm1 = LLMCallEvent(
        parent_id=start.id,
        session_id=session.session_id,
        model="gpt-4o",
        messages=[{"role": "user", "content": "What is AI agent observability?"}],
        parameters={"temperature": 0.7},
    )
    llm1.mark_running()
    emit(llm1)
    time.sleep(0.3)
    llm1.mark_success()
    emit(llm1)

    response1 = simulate_llm_call("gpt-4o", "What is AI agent observability?")
    resp1 = LLMResponseEvent(
        parent_id=llm1.id,
        session_id=session.session_id,
        model="gpt-4o",
        content=response1,
        token_count=150,
        finish_reason="stop",
    )
    resp1.mark_success()
    emit(resp1)

    # 3. Tool Call — search for information
    tool = ToolCallEvent(
        parent_id=resp1.id,
        session_id=session.session_id,
        tool_name="web_search",
        parameters={"query": "AI agent observability tools 2024"},
    )
    tool.mark_running()
    emit(tool)
    time.sleep(0.2)
    tool.mark_success()
    emit(tool)

    result_data = simulate_tool_call("web_search", {"query": "AI agent observability"})
    tres = ToolResultEvent(
        parent_id=tool.id,
        session_id=session.session_id,
        tool_name="web_search",
        result=result_data,
    )
    tres.mark_success()
    emit(tres)

    # 4. Memory Update — store search results
    mem = MemoryUpdateEvent(
        parent_id=tres.id,
        session_id=session.session_id,
        operation="add",
        key="search_results",
        value_after=result_data,
    )
    mem.mark_success()
    emit(mem)

    # 5. LLM Call — summarize findings
    llm2 = LLMCallEvent(
        parent_id=tres.id,
        session_id=session.session_id,
        model="gpt-4o",
        messages=[
            {"role": "system", "content": "Summarize the search results."},
            {"role": "user", "content": str(result_data)},
        ],
    )
    llm2.mark_running()
    emit(llm2)
    time.sleep(0.3)
    llm2.mark_success()
    emit(llm2)

    response2 = simulate_llm_call("gpt-4o", "Summarize results")
    resp2 = LLMResponseEvent(
        parent_id=llm2.id,
        session_id=session.session_id,
        model="gpt-4o",
        content=response2,
        token_count=80,
        finish_reason="stop",
    )
    resp2.mark_success()
    emit(resp2)

    # 6. Agent ends
    end = AgentEndEvent(
        parent_id=start.id,
        session_id=session.session_id,
        agent_name="research_agent",
        total_events=session.event_count,
    )
    end.mark_success()
    emit(end)

    # Finalize session
    runtime.session_manager.end_session(session.session_id, status="completed")

    print(f"\nDone! {session.event_count} events generated.")
    print(f"Session: {session.session_id}")
    print("Press Ctrl+C to stop the server and exit.")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nShutting down...")
        runtime.shutdown()


if __name__ == "__main__":
    main()
