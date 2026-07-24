import re
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier

MODEL_PATH = Path(__file__).resolve().parent.parent / "ml" / "artifacts" / "fraud_rf_model.joblib"

URGENT_KEYWORDS = (
    "urgent",
    "kyc",
    "lottery",
    "winner",
    "account blocked",
    "account will be blocked",
    "verify immediately",
    "click here",
    "share otp",
    "share pin",
    "upi pin",
    "atm pin",
    "gift card",
    "claim reward",
    "suspended",
    "unusual activity",
    "confirm your details",
)


class FraudRandomForest:
    def __init__(self) -> None:
        self.model: RandomForestClassifier | None = None
        self._load_or_train()

    def _load_or_train(self) -> None:
        if MODEL_PATH.exists():
            try:
                self.model = joblib.load(MODEL_PATH)
                # Ensure binary fraud class exists at index 1 when possible
                if self.model is not None and getattr(self.model, "n_features_in_", 6) == 6:
                    return
            except Exception:
                self.model = None

        # Synthetic bootstrap: class 0 = safe, class 1 = fraud
        rng = np.random.default_rng(42)
        n = 800
        X = rng.random((n, 6))
        # Fraud more likely with links, urgency, risky channel, high amount, velocity, low trust
        fraud_signal = (
            X[:, 0] * 0.28
            + X[:, 1] * 0.28
            + X[:, 2] * 0.18
            + X[:, 3] * 0.12
            + X[:, 4] * 0.08
            + X[:, 5] * 0.10
            + rng.random(n) * 0.05
        )
        y = (fraud_signal > 0.52).astype(int)
        self.model = RandomForestClassifier(n_estimators=120, random_state=42, class_weight="balanced")
        self.model.fit(X, y)
        MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(self.model, MODEL_PATH)

    def extract_features(
        self,
        *,
        scan_type: str,
        content: str,
        amount: float = 0.0,
        velocity_count: int = 0,
        merchant_trust: float = 50.0,
    ) -> np.ndarray:
        content_lower = (content or "").lower()
        has_link = 1.0 if re.search(r"https?://|bit\.ly|tinyurl|t\.me/", content_lower) else 0.0
        has_urgent = 1.0 if any(w in content_lower for w in URGENT_KEYWORDS) else 0.0
        channel_map = {"qr": 0.25, "sms": 0.75, "upi": 0.35, "phone": 0.55, "link": 0.9}
        channel_risk = channel_map.get(scan_type, 0.5)
        amount_norm = min(max(amount, 0.0) / 50000.0, 1.0)
        velocity_norm = min(max(velocity_count, 0) / 10.0, 1.0)
        trust_norm = 1.0 - (min(max(merchant_trust, 0.0), 100.0) / 100.0)
        return np.array([[has_link, has_urgent, channel_risk, amount_norm, velocity_norm, trust_norm]])

    def predict(
        self,
        *,
        scan_type: str,
        content: str,
        amount: float = 0.0,
        velocity_count: int = 0,
        merchant_trust: float = 50.0,
    ) -> tuple[float, str]:
        if self.model is None:
            return 0.0, "safe"

        features = self.extract_features(
            scan_type=scan_type,
            content=content,
            amount=amount,
            velocity_count=velocity_count,
            merchant_trust=merchant_trust,
        )
        proba_row = self.model.predict_proba(features)[0]
        classes = list(getattr(self.model, "classes_", [0, 1]))
        if 1 in classes:
            proba = float(proba_row[classes.index(1)])
        else:
            proba = float(proba_row[-1])

        proba = max(0.0, min(1.0, proba))
        if proba >= 0.75:
            status = "danger"
        elif proba >= 0.45:
            status = "warning"
        else:
            status = "safe"
        return proba, status


fraud_model = FraudRandomForest()
