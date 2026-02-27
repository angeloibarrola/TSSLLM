from fastapi import WebSocket
from collections import defaultdict
import json


class ConnectionManager:
    def __init__(self):
        self._connections: dict[str, list[WebSocket]] = defaultdict(list)

    async def connect(self, workspace_id: str, ws: WebSocket):
        await ws.accept()
        self._connections[workspace_id].append(ws)

    def disconnect(self, workspace_id: str, ws: WebSocket):
        self._connections[workspace_id].remove(ws)
        if not self._connections[workspace_id]:
            del self._connections[workspace_id]

    async def broadcast(self, workspace_id: str, event_type: str):
        message = json.dumps({"type": event_type})
        dead: list[WebSocket] = []
        for ws in self._connections.get(workspace_id, []):
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            try:
                self._connections[workspace_id].remove(ws)
            except ValueError:
                pass


manager = ConnectionManager()
