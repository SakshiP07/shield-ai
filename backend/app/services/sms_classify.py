"""Classify Android SMS content (OTP / bank / UPI / wallet / phishing / other)."""

from __future__ import annotations

import re

BANK_HINT = re.compile(
    r"\b(bank|a/c|acct|account|debit|credit|neft|imps|rtgs|card\s*xx|avl\s*bal|available\s*bal|"
    r"credit\s*card|debit\s*card)\b",
    re.I,
)
UPI_HINT = re.compile(r"\b(upi|vpa|@oksbi|@paytm|@ybl|@axl|gpay|phonepe|bhim)\b", re.I)
WALLET_HINT = re.compile(
    r"\b(wallet|paytm\s*wallet|amazon\s*pay|mobikwik|freecharge|airtel\s*payments?\s*bank)\b",
    re.I,
)
TXN_HINT = re.compile(
    r"\b(txn|transaction|spent|paid|received|credited|debited|withdrawn|transferred)\b",
    re.I,
)
PHISH_HINT = re.compile(
    r"\b(click\s*here|verify\s*now|urgent|suspended|kyc\s*update|bit\.ly|tinyurl|free\s*gift)\b",
    re.I,
)
URL_HINT = re.compile(r"https?://|www\.", re.I)

# Types that should always append to transaction_ledger when scanned.
LEDGER_SMS_TYPES = frozenset({"banking", "upi", "wallet", "transaction", "suspicious"})


def classify_sms(body: str, *, is_otp: bool = False) -> str:
    text = (body or "").strip()
    if is_otp:
        return "otp"
    if UPI_HINT.search(text):
        return "upi"
    if WALLET_HINT.search(text):
        return "wallet"
    if BANK_HINT.search(text):
        return "banking"
    if TXN_HINT.search(text):
        return "transaction"
    if PHISH_HINT.search(text) or (URL_HINT.search(text) and "otp" not in text.lower()):
        return "suspicious"
    return "other"


def should_append_ledger(sms_type: str | None) -> bool:
    """Financial / transaction-related SMS always go to the append-only ledger."""
    return (sms_type or "") in LEDGER_SMS_TYPES
