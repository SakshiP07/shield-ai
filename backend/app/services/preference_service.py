from sqlalchemy.orm import Session

from app.models.user import User
from app.models.user_preference import UserPreference


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
        for key, value in updates.items():
            if value is not None and hasattr(prefs, key):
                setattr(prefs, key, value)
        db.commit()
        db.refresh(prefs)
        return prefs
