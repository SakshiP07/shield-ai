import asyncio
import json
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.security import decode_access_token
from app.models.fraud_log import FraudLog
from app.models.user import User

router = APIRouter(tags=["websocket"])

active_connections: dict[str, set[WebSocket]] = {}


async def _authenticate_ws(token: str, db: Session) -> User | None:
    payload = decode_access_token(token)
    if payload is None or "sub" not in payload:
        return None
    return db.get(User, UUID(payload["sub"]))


@router.websocket("/ws/alerts")
async def alerts_websocket(websocket: WebSocket, token: str) -> None:
    await websocket.accept()
    db = SessionLocal()
    user = await _authenticate_ws(token, db)
    if user is None:
        await websocket.send_json({"type": "error", "message": "Unauthorized"})
        await websocket.close(code=1008)
        db.close()
        return

    user_key = str(user.id)
    active_connections.setdefault(user_key, set()).add(websocket)

    try:
        await websocket.send_json({"type": "connected", "user_id": user_key})
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        pass
    finally:
        active_connections.get(user_key, set()).discard(websocket)
        db.close()


async def broadcast_alert(user_id: str, alert: FraudLog) -> None:
    sockets = active_connections.get(user_id, set())
    if not sockets:
        return
    payload = {
        "type": "alert",
        "data": {
            "id": str(alert.id),
            "title": alert.title,
            "description": alert.description,
            "severity": alert.severity,
            "alert_type": alert.alert_type,
            "is_read": alert.is_read,
            "created_at": alert.created_at.isoformat(),
            "transaction_id": str(alert.transaction_id) if alert.transaction_id else None,
            "source": alert.source,
            "fraud_score": alert.fraud_score,
        },
    }
    dead: list[WebSocket] = []
    for ws in sockets:
        try:
            await ws.send_text(json.dumps(payload))
        except Exception:
            dead.append(ws)
    for ws in dead:
        sockets.discard(ws)


async def alert_polling_loop() -> None:
    """Optional background loop placeholder for future push integrations."""
    while True:
        await asyncio.sleep(30)
