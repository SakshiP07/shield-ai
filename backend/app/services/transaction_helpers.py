from sqlalchemy.orm import Session

from app.models.behaviour_profile import BehaviourProfile
from app.models.merchant import Merchant
from app.models.user import User


def get_or_create_profile(db: Session, user: User) -> BehaviourProfile:
    profile = user.behaviour_profile
    if profile is None:
        profile = BehaviourProfile(user_id=user.id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


def find_merchant(db: Session, scan_type: str, content: str) -> Merchant | None:
    if scan_type == "upi":
        return db.query(Merchant).filter(Merchant.upi_id == content.strip().lower()).first()
    if scan_type == "phone":
        digits = "".join(c for c in content if c.isdigit())[-10:]
        return db.query(Merchant).filter(Merchant.phone.endswith(digits)).first()
    return None
