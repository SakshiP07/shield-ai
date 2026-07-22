package ai.shield.android.sms

import android.content.ContentResolver
import android.content.Context
import android.database.Cursor
import android.net.Uri
import android.os.Bundle
import android.provider.Telephony
import java.time.Instant

data class DeviceSms(
    val androidSmsId: String,
    val address: String,
    val body: String,
    val sender: String,
    val receivedAtEpochMs: Long,
    val isRead: Boolean,
    val threadId: String?,
    val isOtp: Boolean,
    val otpCode: String?,
)

/**
 * Reads inbox SMS via Android Content Provider (`content://sms/inbox`).
 * No Twilio or third-party SMS SDKs.
 */
class SmsContentProviderReader(private val context: Context) {
    private val inboxUri: Uri = Telephony.Sms.Inbox.CONTENT_URI
    private val projection = arrayOf(
        Telephony.Sms._ID,
        Telephony.Sms.ADDRESS,
        Telephony.Sms.BODY,
        Telephony.Sms.DATE,
        Telephony.Sms.READ,
        Telephony.Sms.THREAD_ID,
    )

    fun readPage(
        limit: Int,
        offset: Int,
        search: String? = null,
    ): List<DeviceSms> {
        val q = search?.trim().orEmpty()
        val selection: String?
        val args: Array<String>?
        if (q.isNotEmpty()) {
            selection = "(${Telephony.Sms.ADDRESS} LIKE ? OR ${Telephony.Sms.BODY} LIKE ?)"
            args = arrayOf("%$q%", "%$q%")
        } else {
            selection = null
            args = null
        }

        val queryArgs = Bundle().apply {
            putInt(ContentResolver.QUERY_ARG_LIMIT, limit)
            putInt(ContentResolver.QUERY_ARG_OFFSET, offset)
            putStringArray(ContentResolver.QUERY_ARG_SORT_COLUMNS, arrayOf(Telephony.Sms.DATE))
            putInt(
                ContentResolver.QUERY_ARG_SORT_DIRECTION,
                ContentResolver.QUERY_SORT_DIRECTION_DESCENDING,
            )
            if (selection != null) {
                putString(ContentResolver.QUERY_ARG_SQL_SELECTION, selection)
                putStringArray(ContentResolver.QUERY_ARG_SQL_SELECTION_ARGS, args)
            }
        }

        context.contentResolver.query(inboxUri, projection, queryArgs, null).use { cursor ->
            if (cursor == null) return emptyList()
            return buildList {
                while (cursor.moveToNext()) {
                    add(cursor.toDeviceSms())
                }
            }
        }
    }

    fun readSince(afterEpochMs: Long, limit: Int = 50): List<DeviceSms> {
        val queryArgs = Bundle().apply {
            putInt(ContentResolver.QUERY_ARG_LIMIT, limit)
            putStringArray(ContentResolver.QUERY_ARG_SORT_COLUMNS, arrayOf(Telephony.Sms.DATE))
            putInt(
                ContentResolver.QUERY_ARG_SORT_DIRECTION,
                ContentResolver.QUERY_SORT_DIRECTION_DESCENDING,
            )
            putString(ContentResolver.QUERY_ARG_SQL_SELECTION, "${Telephony.Sms.DATE} > ?")
            putStringArray(
                ContentResolver.QUERY_ARG_SQL_SELECTION_ARGS,
                arrayOf(afterEpochMs.toString()),
            )
        }
        context.contentResolver.query(inboxUri, projection, queryArgs, null).use { cursor ->
            if (cursor == null) return emptyList()
            return buildList {
                while (cursor.moveToNext()) {
                    add(cursor.toDeviceSms())
                }
            }
        }
    }

    private fun Cursor.toDeviceSms(): DeviceSms {
        val id = getString(getColumnIndexOrThrow(Telephony.Sms._ID))
        val address = getString(getColumnIndexOrThrow(Telephony.Sms.ADDRESS)) ?: "unknown"
        val body = getString(getColumnIndexOrThrow(Telephony.Sms.BODY)) ?: ""
        val date = getLong(getColumnIndexOrThrow(Telephony.Sms.DATE))
        val read = getInt(getColumnIndexOrThrow(Telephony.Sms.READ)) == 1
        val threadIdx = getColumnIndex(Telephony.Sms.THREAD_ID)
        val threadId = if (threadIdx >= 0 && !isNull(threadIdx)) getString(threadIdx) else null
        val otp = OtpDetector.detect(body)
        return DeviceSms(
            androidSmsId = id,
            address = address,
            body = body,
            sender = address,
            receivedAtEpochMs = date,
            isRead = read,
            threadId = threadId,
            isOtp = otp.isOtp,
            otpCode = otp.code,
        )
    }

    companion object {
        fun epochMsToIso(epochMs: Long): String = Instant.ofEpochMilli(epochMs).toString()
    }
}
