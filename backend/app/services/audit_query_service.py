"""Read-only audit log queries.

Does not create, update, or delete audit_logs rows.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.user import User


def list_audit_logs(
    db: Session,
    *,
    user_id: UUID | None = None,
    user_name: str | None = None,
    email: str | None = None,
    phone: str | None = None,
    request_id: str | None = None,
    search: str | None = None,
    event_type: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    platform: str | None = None,
    device: str | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    entity: str | None = None,
    sort: str = "desc",
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[tuple[AuditLog, User | None]], int]:
    """Newest-first (default) paginated audit logs with optional search/filters."""
    page = max(1, page)
    page_size = min(max(1, page_size), 100)
    sort_dir = (sort or "desc").lower()
    if sort_dir not in ("asc", "desc"):
        sort_dir = "desc"

    query = db.query(AuditLog).outerjoin(User, AuditLog.user_id == User.id)

    if user_id is not None:
        query = query.filter(AuditLog.user_id == user_id)

    if user_name:
        query = query.filter(User.name.ilike(f"%{user_name.strip()}%"))

    if email:
        query = query.filter(User.email.ilike(f"%{email.strip()}%"))

    if phone:
        digits = "".join(c for c in phone if c.isdigit())
        if digits:
            query = query.filter(User.phone.ilike(f"%{digits}%"))
        else:
            query = query.filter(User.phone.ilike(f"%{phone.strip()}%"))

    if request_id:
        query = query.filter(AuditLog.request_id.ilike(f"%{request_id.strip()}%"))

    if search:
        term = search.strip()
        if term:
            search_filters = [
                User.name.ilike(f"%{term}%"),
                User.email.ilike(f"%{term}%"),
                AuditLog.request_id.ilike(f"%{term}%"),
            ]
            digits = "".join(c for c in term if c.isdigit())
            if digits:
                search_filters.append(User.phone.ilike(f"%{digits}%"))
            try:
                search_filters.append(AuditLog.user_id == UUID(term))
            except ValueError:
                pass
            query = query.filter(or_(*search_filters))

    if event_type:
        query = query.filter(AuditLog.event_type == event_type.strip().lower())

    if date_from is not None:
        query = query.filter(AuditLog.created_at >= date_from)
    if date_to is not None:
        query = query.filter(AuditLog.created_at <= date_to)

    if platform:
        query = query.filter(AuditLog.platform.ilike(f"%{platform.strip()}%"))

    if device:
        query = query.filter(AuditLog.device.ilike(f"%{device.strip()}%"))

    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type.strip())

    if entity_id:
        query = query.filter(AuditLog.entity_id == entity_id.strip())

    if entity:
        ent = entity.strip()
        if ent:
            query = query.filter(
                or_(
                    AuditLog.entity_type.ilike(f"%{ent}%"),
                    AuditLog.entity_id.ilike(f"%{ent}%"),
                )
            )

    total = query.with_entities(func.count(AuditLog.id)).scalar() or 0

    order_col = AuditLog.created_at.asc() if sort_dir == "asc" else AuditLog.created_at.desc()
    rows = (
        query.with_entities(AuditLog, User)
        .order_by(order_col)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    result: list[tuple[AuditLog, User | None]] = []
    for log, joined_user in rows:
        # OUTER JOIN may yield a blank User row when user_id is null.
        user = joined_user if joined_user is not None and joined_user.id is not None else None
        result.append((log, user))
    return result, int(total)
