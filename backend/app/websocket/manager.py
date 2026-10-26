"""
WebSocket connection manager.

Maintains the set of connected dashboard clients and broadcasts each analysed
event to all of them. The dashboard handles reconnection on its side; here we
just send events to currently connected clients and ignore send failures.
"""
from __future__ import annotations

import logging
from typing import Set

from fastapi import WebSocket

logger = logging.getLogger("intelliapi.ws")


class ConnectionManager:
    def __init__(self):
        self._active: Set[WebSocket] = set()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self._active.add(ws)
        logger.info("WebSocket client connected (total=%d)", len(self._active))

    def disconnect(self, ws: WebSocket) -> None:
        self._active.discard(ws)
        logger.info("WebSocket client disconnected (total=%d)", len(self._active))

    async def broadcast(self, message: dict) -> None:
        if not self._active:
            return
        dead: list[WebSocket] = []
        for ws in list(self._active):
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

    @property
    def connection_count(self) -> int:
        return len(self._active)


manager = ConnectionManager()
