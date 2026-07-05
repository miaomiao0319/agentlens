"""
Simple Agent Example — AgentLens Demo

A mock AI agent that simulates a research workflow:
  1. agent_start — execution begins
  2. llm_call    — LLM call to process the query
  3. tool_call   — call external tool (simulated web search)
  4. tool_result — tool returns results
  5. agent_end   — execution completes

No real API keys required — all LLM and tool calls are mocked.
Run:  python examples/simple_agent.py
"""

import time

from agentlens import trace, record


# ---------------------------------------------------------------------------
# Mock functions — simulate LLM and external tool calls
# ---------------------------------------------------------------------------
def mock_llm(prompt: str, model: str = "gpt-4o") -> str:
    """Simulate an LLM call with realistic timing."""
    time.sleep(0.03)
    return (
        f"Analysis based on '{prompt[:60]}': The key findings suggest that AI agent "
        "observability requires structured tracing, timeline visualization, and event-level "
        "debugging capabilities similar to Chrome DevTools."
    )


def mock_web_search(query: str) -> list[dict]:
    """Simulate a web search tool returning structured results."""
    time.sleep(0.05)
    return [
        {"title": "AI Agent Observability — A Comprehensive Guide", "url": "https://example.com/1", "relevance": 0.95},
        {"title": "Debugging LLM Workflows in Production", "url": "https://example.com/2", "relevance": 0.88},
        {"title": "Tracing Standards for Agent Execution", "url": "https://example.com/3", "relevance": 0.82},
    ]


# ---------------------------------------------------------------------------
# Agent definition using @trace decorator
# ---------------------------------------------------------------------------
@trace(name="simple_agent")
def run_agent(query: str) -> str:
    """
    Execute a simple research agent workflow.

    Workflow:
      Step 1: LLM call to process the query
      Step 2: Tool call to perform web search
      Step 3: Tool receives and returns results
    """
    print(f"\n{'='*60}")
    print(f"  AgentLens Demo — Simple Research Agent")
    print(f"  Query: '{query}'")
    print(f"{'='*60}\n")

    # --- Step 1: LLM call ---
    print("  [1/2] Calling LLM to analyze query...")
    response = mock_llm(query)
    record(
        type="llm_call",
        input={"prompt": query, "model": "gpt-4o", "temperature": 0.7},
        output={"text": response},
        metadata={"duration_ms": 35, "token_count": 128},
    )

    # --- Step 2: Tool call ---
    print("  [2/2] Calling web_search tool...")
    search_results = mock_web_search(query)
    record(
        type="tool_call",
        input={"tool_name": "web_search", "query": query},
        output={"num_results": len(search_results)},
        metadata={"duration_ms": 55},
    )

    # --- Step 3: Tool result ---
    record(
        type="tool_result",
        input={"tool_name": "web_search"},
        output={"results": search_results},
        metadata={"result_count": len(search_results)},
    )

    print(f"\n  [OK] Agent completed successfully.")
    print(f"       -> LLM responded with {len(response.split())} words")
    print(f"       -> Web search returned {len(search_results)} results\n")
    return response


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    run_agent("What is AI agent observability?")
