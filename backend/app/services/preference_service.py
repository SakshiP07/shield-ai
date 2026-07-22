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
        previous_android = prefs.android_sms_connected
        for key, value in updates.items():
            if value is not None and hasattr(prefs, key):
                setattr(prefs, key, value)

        if (
            "android_sms_connected" in updates
            and updates["android_sms_connected"] is not None
            and updates["android_sms_connected"] != previous_android
        ):
            AuditService.append(
                db,
                event_type=(
                    AuditEventType.SMS_CONNECTED
                    if prefs.android_sms_connected
                    else AuditEventType.SMS_DISCONNECTED
                ),
                user_id=user.id,
                entity_type="android_sms",
                entity_id=user.id,
                previous_value={"android_sms_connected": previous_android},
                new_value={"android_sms_connected": prefs.android_sms_connected},
            )

        db.commit()
        db.refresh(prefs)
        return prefs
