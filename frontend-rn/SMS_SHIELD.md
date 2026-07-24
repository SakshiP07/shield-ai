# Shield AI — React Native SMS Shield (Android)

Android-only SMS inbox in **React Native** (`frontend-rn`), reading real device SMS via
`content://sms` (Telephony Content Provider). No Twilio, FCM, or mock SMS.

## Folder structure

```
frontend-rn/
  modules/shield-android-sms/     # Expo native module (READ_SMS, ContentObserver, SMS_RECEIVED)
  src/sms/
    SmsSyncService.ts             # Connect / sync / offline queue / deletion reconcile / client audit
    auditEvents.ts                # Append-only SMS audit event constants
  src/pages/app/SmsPage.tsx       # SMS Shield UI
  src/components/sms/             # CompletePhoneGate, etc.

backend/
  app/models/
    sms_message.py                # sms_messages
    audit_log.py                  # append-only audit_logs (prompt fields)
    transaction_ledger.py         # append-only transaction_ledger
  app/services/
    android_sms_service.py        # ingest + fraud + ledger + audit
    audit_service.py              # write-only AuditService.append
    ledger_service.py             # append_ledger_entry (never update)
    sms_classify.py               # otp|banking|upi|wallet|transaction|suspicious
  app/api/routes/
    android_sms.py                # /sms/*
    audit_logs.py                 # /audit-logs (read-only)
    ledger.py                     # /ledger (read-only)
  scripts/
    create-android-sms.sql
    create-audit-logs.sql
```

## Architecture

| Layer | Role |
|-------|------|
| `modules/shield-android-sms` | Native READ_SMS + observer + broadcast |
| `src/sms/SmsSyncService.ts` | JWT ingest, offline queue, client audit events |
| FastAPI `/api/v1/sms/*` | Store `sms_messages`, fraud pipeline, ledger, audit |
| `audit_logs` | Append-only; never UPDATE/DELETE |
| `transaction_ledger` | Append-only for bank/UPI/wallet/transaction SMS |

## Audit log fields

Each SMS-related action stores: `event_type`, `action`, `description`, `user_id`,
`sms_id`, `transaction_id`, `ip_address`, `device_id`, `device_model`, `manufacturer`,
`android_version`, `app_version`, `timestamp` (`created_at`), `status`, `metadata` (JSON).

## Requirements

1. **Development build** (Expo Go cannot read SMS):
   ```bash
   cd frontend-rn
   npm install
   npx expo prebuild --platform android
   npx expo run:android
   ```
2. Backend on `:8000` with JWT auth.
3. Apply SQL if needed:
   - `backend/scripts/create-android-sms.sql`
   - `backend/scripts/create-audit-logs.sql`

## Flow

1. Open SMS Shield  
2. If phone missing → Complete Profile (link to existing user)  
3. Connect SMS → request `READ_SMS` / `RECEIVE_SMS`  
4. Native module reads `Telephony.Sms`  
5. `POST /sms/ingest` → fraud scan + ledger (financial SMS) + audit  
6. ContentObserver / BroadcastReceiver → auto upload + inbox refresh  
7. Deletion reconcile → `sms_deleted_from_device` audit when detectable  

## Offline

Failed uploads are queued in AsyncStorage and retried on refresh / poll / reconnect.
Duplicates are prevented via local synced-id set + backend `(user_id, android_sms_id)` unique key.
