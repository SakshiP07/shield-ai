/** SMS Shield audit event types (append-only backend audit_logs). */

export const SmsAuditEvent = {
  CONNECTED: 'sms_connected',
  DISCONNECTED: 'sms_disconnected',
  PERMISSION_GRANTED: 'sms_permission_granted',
  PERMISSION_DENIED: 'sms_permission_denied',
  PERMISSION_REVOKED: 'sms_permission_revoked',
  SYNC_STARTED: 'sms_sync_started',
  SYNC_COMPLETED: 'sms_sync_completed',
  INCOMING_DETECTED: 'sms_incoming_detected',
  UPLOADED: 'sms_uploaded',
  CONNECTION_LOST: 'sms_connection_lost',
  DELETED_FROM_DEVICE: 'sms_deleted_from_device',
  FRAUD_ANALYSIS_STARTED: 'fraud_analysis_started',
  FRAUD_ANALYSIS_COMPLETED: 'fraud_analysis_completed',
  OTP_DETECTED: 'otp_detected',
  BANK_SMS_DETECTED: 'bank_sms_detected',
  UPI_SMS_DETECTED: 'upi_sms_detected',
  BACKEND_ERROR: 'sms_backend_error',
  API_FAILURE: 'sms_api_failure',
  RETRY_ATTEMPT: 'sms_retry_attempt',
  PROFILE_PHONE_UPDATED: 'profile_phone_updated',
} as const;

export type SmsAuditEventType = (typeof SmsAuditEvent)[keyof typeof SmsAuditEvent];
