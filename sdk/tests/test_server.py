"""Integration tests for the WebSocket server."""

import asyncio
import json
import time

import pytest
import websockets

from agentlens.event_bus import EventBus
from agentlens.schema import LLMCallEvent, CustomEvent, parse_event
from agentlens.session import SessionManager
from agentlens.server import AgentLensServer


def _find_free_port() -> int:
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class TestAgentLensServer:
    def test_start_and_stop(self):
        port = _find_free_port()
        server = AgentLensServer(port=port)
        server.start()
        assert server.is_running
        server.stop()
        assert not server.is_running

    def test_client_count_zero_initially(self):
        port = _find_free_port()
        server = AgentLensServer(port=port)
        assert server.client_count == 0

    def test_client_connects(self):
        port = _find_free_port()
        server = AgentLensServer(port=port)
        server.start()

        async def connect():
            async with websockets.connect(f"ws://127.0.0.1:{port}") as ws:
                msg = await asyncio.wait_for(ws.recv(), timeout=2.0)
                return json.loads(msg)

        data = asyncio.run(connect())
        assert data["type"] == "connected"
        server.stop()

    def test_event_broadcast_to_client(self):
        port = _find_free_port()
        bus = EventBus()
        server = AgentLensServer(port=port)
        server.attach_event_bus(bus)
        server.start()

        received: list[dict] = []

        async def client():
            async with websockets.connect(f"ws://127.0.0.1:{port}") as ws:
                await asyncio.wait_for(ws.recv(), timeout=2.0)  # drain "connected"
                event = LLMCallEvent(model="gpt-4o", session_id="test_sess")
                bus.publish(event)
                msg = await asyncio.wait_for(ws.recv(), timeout=2.0)
                received.append(json.loads(msg))

        asyncio.run(client())

        assert len(received) == 1
        assert received[0]["type"] == "llm_call"
        assert received[0]["model"] == "gpt-4o"
        server.stop()

    def test_multiple_events_arrive_in_order(self):
        port = _find_free_port()
        bus = EventBus()
        server = AgentLensServer(port=port)
        server.attach_event_bus(bus)
        server.start()

        async def client():
            async with websockets.connect(f"ws://127.0.0.1:{port}") as ws:
                await asyncio.wait_for(ws.recv(), timeout=2.0)  # drain "connected"
                bus.publish(CustomEvent(name="first"))
                bus.publish(CustomEvent(name="second"))
                bus.publish(CustomEvent(name="third"))

                results = []
                for _ in range(3):
                    msg = await asyncio.wait_for(ws.recv(), timeout=2.0)
                    results.append(json.loads(msg)["name"])
                return results

        results = asyncio.run(client())
        assert results == ["first", "second", "third"]
        server.stop()

    def test_event_not_lost_when_no_clients_connected(self):
        port = _find_free_port()
        bus = EventBus()
        server = AgentLensServer(port=port)
        server.attach_event_bus(bus)
        server.start()

        # Publish without any client — should not crash
        bus.publish(CustomEvent(name="orphan"))

        server.stop()

    def test_server_sends_session_list_on_connect(self):
        port = _find_free_port()
        bus = EventBus()
        mgr = SessionManager()
        mgr.create_session(framework="test", agent_name="demo_agent")
        mgr.create_session(framework="test", agent_name="another")

        server = AgentLensServer(port=port)
        server.attach_event_bus(bus)
        server.attach_session_manager(mgr)
        server.start()

        async def client():
            async with websockets.connect(f"ws://127.0.0.1:{port}") as ws:
                # Drain "connected" welcome
                await asyncio.wait_for(ws.recv(), timeout=2.0)
                # Get session_list
                msg = await asyncio.wait_for(ws.recv(), timeout=2.0)
                return json.loads(msg)

        data = asyncio.run(client())
        assert data["type"] == "session_list"
        assert len(data["sessions"]) == 2
        server.stop()

    def test_session_list_empty_when_no_sessions(self):
        port = _find_free_port()
        bus = EventBus()
        mgr = SessionManager()

        server = AgentLensServer(port=port)
        server.attach_event_bus(bus)
        server.attach_session_manager(mgr)
        server.start()

        async def client():
            async with websockets.connect(f"ws://127.0.0.1:{port}") as ws:
                # Drain "connected" welcome
                await asyncio.wait_for(ws.recv(), timeout=2.0)
                # Get session_list
                msg = await asyncio.wait_for(ws.recv(), timeout=2.0)
                return json.loads(msg)

        data = asyncio.run(client())
        assert data["type"] == "session_list"
        assert data["sessions"] == []
        server.stop()

    def test_disconnected_client_does_not_crash_server(self):
        port = _find_free_port()
        bus = EventBus()
        server = AgentLensServer(port=port)
        server.attach_event_bus(bus)
        server.start()

        async def client():
            async with websockets.connect(f"ws://127.0.0.1:{port}") as ws:
                pass  # connect and immediately disconnect

        asyncio.run(client())
        time.sleep(0.2)

        # Should still be running
        assert server.is_running
        # Publish after client left — should not crash
        bus.publish(CustomEvent(name="post_disconnect"))
        server.stop()

    def test_parse_event_roundtrip_through_server(self):
        """Full roundtrip: create Event → JSON → WebSocket → parse Event."""
        port = _find_free_port()
        bus = EventBus()
        server = AgentLensServer(port=port)
        server.attach_event_bus(bus)
        server.start()

        async def client():
            async with websockets.connect(f"ws://127.0.0.1:{port}") as ws:
                await asyncio.wait_for(ws.recv(), timeout=2.0)  # drain "connected"
                original = LLMCallEvent(
                    model="claude-opus-4-8",
                    messages=[{"role": "user", "content": "hello"}],
                    parameters={"temperature": 0.7},
                    session_id="sess_xyz",
                    parent_id="evt_parent",
                )
                original.mark_success()
                bus.publish(original)

                msg = await asyncio.wait_for(ws.recv(), timeout=2.0)
                parsed = parse_event(json.loads(msg))

                assert parsed.type == original.type
                assert parsed.model == "claude-opus-4-8"
                assert parsed.session_id == "sess_xyz"
                assert parsed.parent_id == "evt_parent"
                assert parsed.status == original.status

        asyncio.run(client())
        server.stop()

    def test_multiple_clients_all_receive_events(self):
        port = _find_free_port()
        bus = EventBus()
        server = AgentLensServer(port=port)
        server.attach_event_bus(bus)
        server.start()

        async def run():
            ready = asyncio.Event()
            ready_count = 0
            lock = asyncio.Lock()

            async def client(label: str) -> str:
                nonlocal ready_count
                async with websockets.connect(f"ws://127.0.0.1:{port}") as ws:
                    # Drain the initial "connected" welcome message
                    await asyncio.wait_for(ws.recv(), timeout=3.0)
                    # Signal that we're ready
                    async with lock:
                        ready_count += 1
                        if ready_count >= 2:
                            ready.set()
                    # Now wait for the broadcast event
                    msg = await asyncio.wait_for(ws.recv(), timeout=3.0)
                    data = json.loads(msg)
                    return f"{label}:{data['name']}"

            tasks = [asyncio.create_task(client("a")), asyncio.create_task(client("b"))]
            # Wait for both clients to drain welcome messages
            await asyncio.wait_for(ready.wait(), timeout=5.0)
            # Small extra settle time for cross-thread broadcast scheduling
            await asyncio.sleep(0.05)
            bus.publish(CustomEvent(name="broadcast"))
            results = await asyncio.gather(*tasks)
            return results

        results = asyncio.run(run())
        assert results == ["a:broadcast", "b:broadcast"]
        server.stop()
