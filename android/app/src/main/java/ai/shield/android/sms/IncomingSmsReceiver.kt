package ai.shield.android.sms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import ai.shield.android.data.SessionStore
import ai.shield.android.data.ShieldApi
import ai.shield.android.data.ShieldApiClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * Pushes newly received SMS to the backend fraud pipeline (Android only).
 */
class IncomingSmsReceiver : BroadcastReceiver() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
        if (!SessionStore(context).isSmsConnected()) return

        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return
        val reader = SmsContentProviderReader(context)
        val parsed = messages.mapNotNull { pdus ->
            val address = pdus.originatingAddress ?: return@mapNotNull null
            val body = pdus.messageBody ?: ""
            val date = pdus.timestampMillis
            val otp = OtpDetector.detect(body)
            // Prefer Content Provider id when available shortly after insert
            DeviceSms(
                androidSmsId = "pdu-${address.hashCode()}-$date",
                address = address,
                body = body,
                sender = address,
                receivedAtEpochMs = date,
                isRead = false,
                threadId = null,
                isOtp = otp.isOtp,
                otpCode = otp.code,
            )
        }
        if (parsed.isEmpty()) return

        // Also try to re-read newest inbox rows for stable _ID
        val newest = reader.readPage(limit = parsed.size.coerceAtLeast(5), offset = 0)
        val toSend = if (newest.isNotEmpty()) newest.take(parsed.size) else parsed

        val token = SessionStore(context).getToken() ?: return
        scope.launch {
            runCatching {
                ShieldApiClient.create(token).ingestSms(
                    ShieldApi.IngestRequest(
                        messages = toSend.map { it.toIngestItem() },
                        deviceInfo = mapOf("platform" to "android", "source" to "sms_received"),
                        autoScan = true,
                    ),
                )
            }
        }
    }
}

fun DeviceSms.toIngestItem(): ShieldApi.IngestItem = ShieldApi.IngestItem(
    androidSmsId = androidSmsId,
    address = address,
    body = body,
    sender = sender,
    receivedAt = SmsContentProviderReader.epochMsToIso(receivedAtEpochMs),
    isRead = isRead,
    threadId = threadId,
    isOtp = isOtp,
    otpCode = otpCode,
)
