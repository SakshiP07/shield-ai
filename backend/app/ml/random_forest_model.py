import re
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier

MODEL_PATH = Path(__file__).resolve().parent.parent / "ml" / "artifacts" / "fraud_rf_model.joblib"


class FraudRandomForest:
    def __init__(self) -> None:
        self.model: RandomForestClassifier | None = None
        self._load_or_train()

    def _load_or_train(self) -> None:
        if MODEL_PATH.exists():
            self.model = joblib.load(MODEL_PATH)
            return

        # Synthetic bootstrap data until real training pipeline exists
        rng = np.random.default_rng(42)
        X = rng.random((500, 6))
        y = (X[:, 0] * 0.4 + X[:, 1] * 0.3 + X[:, 2] * 0.2 + rng.random(500) * 0.1 > 0.55).astype(int)
        self.model = RandomForestClassifier(n_estimators=100, random_state=42)
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
        content_lower = content.lower()
        has_link = 1.0 if re.search(r"https?://|bit\.ly|tinyurl", content_lower) else 0.0
        has_urgent = 1.0 if any(w in content_lower for w in ("urgent", "kyc", "lottery", "winner")) else 0.0
        channel_map = {"qr": 0.2, "sms": 0.8, "upi": 0.3, "phone": 0.6, "link": 0.9}
        channel_risk = channel_map.get(scan_type, 0.5)
        amount_norm = min(amount / 50000.0, 1.0)
        velocity_norm = min(velocity_count / 10.0, 1.0)
        trust_norm = 1.0 - (merchant_trust / 100.0)
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
        proba = float(self.model.predict_proba(features)[0][1])
        if proba >= 0.75:
            status = "danger"
        elif proba >= 0.45:
            status = "warning"
        else:
            status = "safe"
        return proba, status


fraud_model = FraudRandomForest()
