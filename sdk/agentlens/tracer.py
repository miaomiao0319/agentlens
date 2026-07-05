"""Core tracer — intercepts and records agent execution events."""

from __future__ import annotations

import json
import os
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from functools import wraps
from pathlib import Path
from typing import Any, Callable, Optional

from agentlens.models import EventType, EventStatus, TraceEvent, TraceRun, _utc_now_ts


# ---------------------------------------------------------------------------
# Thread-local state so that nested / concurrent agent runs don't interfere.
# ---------------------------------------------------------------------------
_current_tracer: Optional["AgentTracer"] = None


def get_current_tracer() -> Optional["AgentTracer"]:
    return _current_tracer


def record(
    type: str,
    input: dict[str, Any] | None = None,
    output: dict[str, Any] | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    """Quick record helper that delegates to the active tracer.

    Usage inside a traced function::

        from agentlens import record
        record("llm_call", input={"prompt": "..."}, output={"text": "..."})
    """
    tracer = _current_tracer
    if tracer is None:
        raise RuntimeError("No active AgentTracer. Use @trace or with session() first.")
    tracer.record(type=type, input=input or {}, output=output or {}, metadata=metadata or {})


# ---------------------------------------------------------------------------
# AgentTracer
# ---------------------------------------------------------------------------
class AgentTracer:
    """Records a sequence of TraceEvents and persists them as a JSON file."""

    def __init__(self, agent_name: str = "unknown", output_dir: str = "./traces") -> None:
        self._run = TraceRun(agent_name=agent_name)
        self._output_dir = Path(output_dir)
        self._output_dir.mkdir(parents=True, exist_ok=True)

    # -- public API -----------------------------------------------------------

    @property
    def run_id(self) -> str:
        return self._run.run_id

    def record(
        self,
        type: str,
        input: dict[str, Any],
        output: dict[str, Any],
        metadata: dict[str, Any] | None = None,
    ) -> TraceEvent:
        """Record a single event and append it to the run."""
        event = TraceEvent(
            run_id=self._run.run_id,
            type=EventType(type),
            input=input,
            output=output,
            metadata=metadata or {},
        )
        event.mark_success()
        self._run.add_event(event)
        return event

    def get_trace(self) -> TraceRun:
        """Return the current TraceRun (in-memory representation)."""
        return self._run

    def save(self) -> Path:
        """Persist the entire run as a JSON file; returns the file path."""
        self._run.finalize()

        ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
        short_id = self._run.run_id[:8]
        filename = f"{self._run.agent_name}_{short_id}_{ts}.json"
        filepath = self._output_dir / filename

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(self._run.model_dump(), f, indent=2, ensure_ascii=False)

        print(f"Trace saved to {filepath}")
        return filepath


# ---------------------------------------------------------------------------
# Decorator
# ---------------------------------------------------------------------------
def trace(name: str | None = None):
    """Decorator that wraps a function so every call produces a trace file.

    Automatically records ``agent_start`` and ``agent_end`` events.
    Exceptions are caught, recorded as ``failed``, and re-raised.
    """

    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            global _current_tracer
            agent_name = name or func.__name__
            tracer = AgentTracer(agent_name=agent_name)
            _current_tracer = tracer

            # Record agent_start
            start_event = tracer.record(
                type="agent_start",
                input={"function": func.__name__, "args_preview": str(args)[:200]},
                output={},
            )
            start_event.mark_success()

            try:
                result = func(*args, **kwargs)

                # Record agent_end with success
                end_event = tracer.record(
                    type="agent_end",
                    input={},
                    output={"result_preview": str(result)[:500]} if result is not None else {},
                )
                end_event.mark_success()

            except Exception as exc:
                # Record agent_end with failure
                end_event = tracer.record(
                    type="agent_end",
                    input={},
                    output={"error": str(exc)},
                )
                end_event.mark_failed()
                raise
            finally:
                tracer.save()
                _current_tracer = None

            return result

        return wrapper

    # Support both @trace and @trace(name="...")
    if callable(name):
        func, name = name, None
        return decorator(func)
    return decorator


# ---------------------------------------------------------------------------
# Context manager
# ---------------------------------------------------------------------------
@contextmanager
def session(name: str = "agent_session"):
    """Context manager that creates a tracer for the duration of a ``with`` block.

    Usage::

        with session("my_agent") as tracer:
            tracer.record("llm_call", input={...}, output={...})
    """
    global _current_tracer
    tracer = AgentTracer(agent_name=name)
    _current_tracer = tracer

    start_event = tracer.record(
        type="agent_start",
        input={"context": "session"},
        output={},
    )
    start_event.mark_success()

    try:
        yield tracer
        end_event = tracer.record(
            type="agent_end",
            input={},
            output={},
        )
        end_event.mark_success()
    except Exception as exc:
        end_event = tracer.record(
            type="agent_end",
            input={},
            output={"error": str(exc)},
        )
        end_event.mark_failed()
        raise
    finally:
        tracer.save()
        _current_tracer = None
