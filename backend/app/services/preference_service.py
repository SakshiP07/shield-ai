from sqlalchemy.orm import Session

from app.models.user import User
from app.models.user_preference import UserPreference
from app.services.audit_service import AuditEventType, AuditService


class PreferenceService:
    @staticmethod
    def get_or_create(db: Session, user: User) -> UserPreference:
        prefs = db.get(UserPreference, user.id)
        if prefs is None:
            prefs = UserPreference(user_id=user.id)
            db.add(prefs)
            db.commit()
            db.refresh(prefs)
        return prefs

    @staticmethod
    def update(db: Session, user: User, updates: dict) -> UserPreference:
        prefs = PreferenceService.get_or_create(db, user)
        previous_sms = prefs.sms_alerts
        for key, value in updates.items():
            if value is not None and hasattr(prefs, key):
                setattr(prefs, key, value)

        if "sms_alerts" in updates and updates["sms_alerts"] is not None and updates["sms_alerts"] != previous_sms:
            AuditService.append(
                db,
                event_type=AuditEventType.SMS_CONNECTED if prefs.sms_alerts else AuditEventType.SMS_DISCONNECTED,
                user_id=user.id,
                entity_type="user_preference",
                entity_id=user.id,
                previous_value={"sms_alerts": previous_sms},
                new_value={"sms_alerts": prefs.sms_alerts},
            )

        db.commit()
        db.refresh(prefs)
        return prefs
