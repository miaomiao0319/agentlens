"""Tests for agentlens.init() bootstrap."""

import time
import pytest
from agentlens.bootstrap import init, shutdown, get_runtime


class TestInit:
    def teardown_method(self):
        shutdown()

    def test_init_returns_runtime(self):
        runtime = init(host="127.0.0.1", port=19877, auto_detect=False)
        assert runtime is not None
        assert runtime.is_running

    def test_get_runtime(self):
        runtime = init(host="127.0.0.1", port=19878, auto_detect=False)
        assert get_runtime() is runtime

    def test_shutdown(self):
        init(host="127.0.0.1", port=19879, auto_detect=False)
        shutdown()
        assert get_runtime() is None

    def test_init_twice_returns_same_runtime(self):
        r1 = init(host="127.0.0.1", port=19880, auto_detect=False)
        r2 = init(host="127.0.0.1", port=19880, auto_detect=False)
        assert r1 is r2

    def test_server_starts_and_accepts_connections(self):
        import asyncio, json, websockets

        port = 19881
        init(host="127.0.0.1", port=port, auto_detect=False)

        async def connect():
            async with websockets.connect(f"ws://127.0.0.1:{port}") as ws:
                msg = await asyncio.wait_for(ws.recv(), timeout=2.0)
                return json.loads(msg)

        data = asyncio.run(connect())
        assert data["type"] == "connected"

    def test_runtime_components_are_connected(self):
        runtime = init(host="127.0.0.1", port=19882, auto_detect=False)

        assert runtime.event_bus is not None
        assert runtime.session_manager is not None
        assert runtime.adapter_manager is not None
        assert runtime.server is not None

        # EventBus should be connected to server (events flow through)
        assert runtime.event_bus.subscriber_count >= 1

    def test_custom_adapters_list(self):
        """Specify explicit adapter list — should not auto-detect."""
        runtime = init(host="127.0.0.1", port=19883, adapters=[])
        assert runtime.adapter_manager.active_count == 0

    def test_shutdown_is_idempotent(self):
        init(host="127.0.0.1", port=19884, auto_detect=False)
        shutdown()
        shutdown()  # second call is no-op
