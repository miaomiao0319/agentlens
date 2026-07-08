"""WebSocket server — streams Events from the EventBus to connected clients.

The server runs inside the user's Python process and broadcasts Events in
real time to the VS Code Extension (or any other WebSocket client).
"""

from __future__ import annotations

import asyncio
import json
import logging
import threading
from collections.abc import Callable

import websockets
from websockets.asyncio.server import ServerConnection

from agentlens.event_bus import EventBus
from agentlens.schema import BaseEvent
from agentlens.session import Session, SessionManager

logger = logging.getLogger("agentlens.server")


class AgentLensServer:
    """WebSocket server that streams AgentLens Events to connected clients.

    Runs in a background thread so it does not block the user's main thread.
    """

    def __init__(
        self,
        host: str = "127.0.0.1",
        port: int = 9876,
    ) -> None:
        self._host = host
        self._port = port
        self._event_bus: EventBus | None = None
        self._session_manager: SessionManager | None = None
        self._clients: set[ServerConnection] = set()
        self._server: websockets.asyncio.server.Server | None = None
        self._loop: asyncio.AbstractEventLoop | None = None
        self._thread: threading.Thread | None = None
        self._running = False

    # --- configuration ---

    def attach_event_bus(self, bus: EventBus) -> None:
        """Connect to an EventBus. Published events will be broadcast."""
        self._event_bus = bus
        bus.subscribe(self._on_event)

    def attach_session_manager(self, mgr: SessionManager) -> None:
        """Connect to a SessionManager for session lifecycle messages."""
        self._session_manager = mgr

    # --- lifecycle ---

    def start(self) -> None:
        """Start the WebSocket server in a background thread.

        Non-blocking. Call ``stop()`` to shut down.
        """
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        """Stop the server and close all connections.

        Blocks until the server thread exits (with a timeout).
        """
        self._running = False
        if self._loop and self._server:
            # Schedule shutdown in the event loop
            self._loop.call_soon_threadsafe(self._shutdown)
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=5.0)

    def _shutdown(self) -> None:
        """Internal: close all connections and stop the server (must run in event loop)."""
        # Close all client connections
        for client in list(self._clients):
            try:
                client.close()
            except Exception:
                pass
        self._clients.clear()
        # Explicitly close the server socket to free the port immediately
        if self._server:
            self._server.close()

    # --- internal ---

    def _run_loop(self) -> None:
        """Run the asyncio event loop with the WebSocket server."""
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)

        async def serve() -> None:
            self._server = await websockets.serve(
                self._handle_connection,
                self._host,
                self._port,
            )
            # Keep server alive while _running is True
            while self._running:
                await asyncio.sleep(0.1)
            if self._server:
                self._server.close()
                await self._server.wait_closed()

        try:
            self._loop.run_until_complete(serve())
        except Exception:
            logger.debug("Server event loop stopped", exc_info=True)
        finally:
            self._loop.close()

    async def _handle_connection(self, ws: ServerConnection) -> None:
        """Handle a new WebSocket client connection."""
        self._clients.add(ws)

        # Send welcome message
        await ws.send(json.dumps({"type": "connected", "version": "0.1.0"}))

        # Send session list on connect if available
        if self._session_manager:
            sessions = [s.to_dict() for s in self._session_manager.list_sessions()]
            await ws.send(json.dumps({
                "type": "session_list",
                "sessions": sessions,
            }))

        try:
            # Keep connection alive; listen for client messages (if any)
            async for _message in ws:
                # Client messages are ignored for now
                pass
        except Exception:
            logger.debug("Client connection closed", exc_info=True)
        finally:
            self._clients.discard(ws)

    def _on_event(self, event: BaseEvent) -> None:
        """Callback from EventBus — serialize and broadcast."""
        try:
            payload = json.dumps(event.model_dump(), default=str)
        except Exception:
            logger.warning(
                "Failed to serialize event id=%s type=%s",
                event.id,
                event.type,
                exc_info=True,
            )
            return

        # We need to send from the event loop thread
        if self._loop and self._loop.is_running():
            asyncio.run_coroutine_threadsafe(
                self._broadcast(payload), self._loop
            )

    async def _broadcast(self, message: str) -> None:
        """Send a message to all connected clients."""
        dead: list[ServerConnection] = []
        for client in list(self._clients):
            try:
                await client.send(message)
            except Exception:
                dead.append(client)

        for client in dead:
            self._clients.discard(client)

    @property
    def client_count(self) -> int:
        return len(self._clients)

    @property
    def is_running(self) -> bool:
        return self._running
