package ai.shield.sms

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.database.ContentObserver
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Telephony
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import java.util.regex.Pattern

/**
 * Reads real device SMS via Android Content Provider (content://sms).
 * No Twilio / mock data. Android only.
 */
class ShieldAndroidSmsModule : Module() {
  private var observer: ContentObserver? = null
  private var receiver: BroadcastReceiver? = null
  private var lastSeenMs: Long = 0L

  private val otpHint = Pattern.compile(
    "\\b(otp|one[-\\s]?time\\s*(?:password|passcode|code)|verification\\s*code|" +
      "auth(?:entication)?\\s*code|security\\s*code|passcode)\\b",
    Pattern.CASE_INSENSITIVE,
  )
  private val otpLabeled = Pattern.compile(
    "(?:otp|code|passcode|password)\\s*(?:is|:)?\\s*(\\d{4,8})",
    Pattern.CASE_INSENSITIVE,
  )
  private val otpDigits = Pattern.compile("(?<!\\d)(\\d{4,8})(?!\\d)")

  override fun definition() = ModuleDefinition {
    Name("ShieldAndroidSms")

    Events("onSmsChanged")

    Function("isAndroid") {
      true
    }

    Function("hasReadSmsPermission") {
      val ctx = appContext.reactContext ?: return@Function false
      ContextCompat.checkSelfPermission(ctx, Manifest.permission.READ_SMS) ==
        PackageManager.PERMISSION_GRANTED
    }

    AsyncFunction("readInbox") { limit: Int, offset: Int, promise: Promise ->
      try {
        val ctx = appContext.reactContext
          ?: throw IllegalStateException("No Android context")
        if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.READ_SMS)
          != PackageManager.PERMISSION_GRANTED
        ) {
          throw SecurityException("READ_SMS permission not granted")
        }
        promise.resolve(readSms(ctx, limit.coerceIn(1, 200), offset.coerceAtLeast(0), null))
      } catch (e: Exception) {
        promise.reject("SMS_READ_FAILED", e.message, e)
      }
    }

    AsyncFunction("readSince") { afterEpochMs: Double, limit: Int, promise: Promise ->
      try {
        val ctx = appContext.reactContext
          ?: throw IllegalStateException("No Android context")
        if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.READ_SMS)
          != PackageManager.PERMISSION_GRANTED
        ) {
          throw SecurityException("READ_SMS permission not granted")
        }
        promise.resolve(
          readSms(
            ctx,
            limit.coerceIn(1, 100),
            0,
            afterEpochMs.toLong(),
          ),
        )
      } catch (e: Exception) {
        promise.reject("SMS_READ_FAILED", e.message, e)
      }
    }

    AsyncFunction("startWatching") { promise: Promise ->
      try {
        val ctx = appContext.reactContext
          ?: throw IllegalStateException("No Android context")
        stopWatchingInternal(ctx)
        lastSeenMs = System.currentTimeMillis()

        val obs = object : ContentObserver(Handler(Looper.getMainLooper())) {
          override fun onChange(selfChange: Boolean) {
            onChange(selfChange, null)
          }

          override fun onChange(selfChange: Boolean, uri: Uri?) {
            emitIncoming(ctx)
          }
        }
        ctx.contentResolver.registerContentObserver(
          Telephony.Sms.CONTENT_URI,
          true,
          obs,
        )
        observer = obs

        val recv = object : BroadcastReceiver() {
          override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == Telephony.Sms.Intents.SMS_RECEIVED_ACTION) {
              emitIncoming(ctx)
            }
          }
        }
        val filter = IntentFilter(Telephony.Sms.Intents.SMS_RECEIVED_ACTION)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
          ctx.registerReceiver(recv, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
          @Suppress("UnspecifiedRegisterReceiverFlag")
          ctx.registerReceiver(recv, filter)
        }
        receiver = recv
        promise.resolve(true)
      } catch (e: Exception) {
        promise.reject("SMS_WATCH_FAILED", e.message, e)
      }
    }

    AsyncFunction("stopWatching") { promise: Promise ->
      try {
        val ctx = appContext.reactContext
        if (ctx != null) stopWatchingInternal(ctx)
        promise.resolve(true)
      } catch (e: Exception) {
        promise.reject("SMS_WATCH_STOP_FAILED", e.message, e)
      }
    }

    OnDestroy {
      val ctx = appContext.reactContext ?: return@OnDestroy
      stopWatchingInternal(ctx)
    }
  }

  private fun emitIncoming(ctx: Context) {
    try {
      val fresh = readSms(ctx, 20, 0, lastSeenMs)
      if (fresh.isNotEmpty()) {
        val maxTs = fresh.maxOf { (it["timestamp"] as? Number)?.toLong() ?: 0L }
        if (maxTs > lastSeenMs) lastSeenMs = maxTs
        sendEvent("onSmsChanged", mapOf("messages" to fresh))
      }
    } catch (_: Exception) {
      // Ignore transient provider races
    }
  }

  private fun stopWatchingInternal(ctx: Context) {
    observer?.let {
      try {
        ctx.contentResolver.unregisterContentObserver(it)
      } catch (_: Exception) {
      }
    }
    observer = null
    receiver?.let {
      try {
        ctx.unregisterReceiver(it)
      } catch (_: Exception) {
      }
    }
    receiver = null
  }

  private fun detectOtp(body: String): Pair<Boolean, String?> {
    val text = body.trim()
    if (text.isEmpty()) return false to null
    val labeled = otpLabeled.matcher(text)
    if (labeled.find()) return true to labeled.group(1)
    if (otpHint.matcher(text).find()) {
      val dig = otpDigits.matcher(text)
      var six: String? = null
      var any: String? = null
      while (dig.find()) {
        val code = dig.group(1) ?: continue
        any = any ?: code
        if (code.length == 6) six = code
      }
      return true to (six ?: any)
    }
    return false to null
  }

  private fun readSms(
    ctx: Context,
    limit: Int,
    offset: Int,
    afterEpochMs: Long?,
  ): List<Map<String, Any?>> {
    val uri = Telephony.Sms.CONTENT_URI
    val projection = arrayOf(
      Telephony.Sms._ID,
      Telephony.Sms.ADDRESS,
      Telephony.Sms.BODY,
      Telephony.Sms.DATE,
      Telephony.Sms.READ,
      Telephony.Sms.THREAD_ID,
      Telephony.Sms.TYPE,
    )

    val queryArgs = Bundle().apply {
      putInt(android.content.ContentResolver.QUERY_ARG_LIMIT, limit)
      putInt(android.content.ContentResolver.QUERY_ARG_OFFSET, offset)
      putStringArray(
        android.content.ContentResolver.QUERY_ARG_SORT_COLUMNS,
        arrayOf(Telephony.Sms.DATE),
      )
      putInt(
        android.content.ContentResolver.QUERY_ARG_SORT_DIRECTION,
        android.content.ContentResolver.QUERY_SORT_DIRECTION_DESCENDING,
      )
      if (afterEpochMs != null) {
        putString(
          android.content.ContentResolver.QUERY_ARG_SQL_SELECTION,
          "${Telephony.Sms.DATE} > ?",
        )
        putStringArray(
          android.content.ContentResolver.QUERY_ARG_SQL_SELECTION_ARGS,
          arrayOf(afterEpochMs.toString()),
        )
      }
    }

    val out = mutableListOf<Map<String, Any?>>()
    ctx.contentResolver.query(uri, projection, queryArgs, null)?.use { cursor ->
      while (cursor.moveToNext()) {
        val id = cursor.getString(cursor.getColumnIndexOrThrow(Telephony.Sms._ID))
        val address = cursor.getString(cursor.getColumnIndexOrThrow(Telephony.Sms.ADDRESS)) ?: "unknown"
        val body = cursor.getString(cursor.getColumnIndexOrThrow(Telephony.Sms.BODY)) ?: ""
        val date = cursor.getLong(cursor.getColumnIndexOrThrow(Telephony.Sms.DATE))
        val read = cursor.getInt(cursor.getColumnIndexOrThrow(Telephony.Sms.READ)) == 1
        val threadIdx = cursor.getColumnIndex(Telephony.Sms.THREAD_ID)
        val threadId =
          if (threadIdx >= 0 && !cursor.isNull(threadIdx)) cursor.getString(threadIdx) else null
        val typeIdx = cursor.getColumnIndex(Telephony.Sms.TYPE)
        val type =
          if (typeIdx >= 0 && !cursor.isNull(typeIdx)) cursor.getInt(typeIdx) else Telephony.Sms.MESSAGE_TYPE_INBOX
        val folder = if (type == Telephony.Sms.MESSAGE_TYPE_SENT) "sent" else "inbox"
        val (isOtp, otpCode) = detectOtp(body)
        out.add(
          mapOf(
            "id" to id,
            "android_sms_id" to id,
            "address" to address,
            "phone_number" to address,
            "sender" to address,
            "body" to body,
            "timestamp" to date,
            "received_at" to java.time.Instant.ofEpochMilli(date).toString(),
            "is_read" to read,
            "thread_id" to threadId,
            "folder" to folder,
            "is_otp" to isOtp,
            "otp_code" to otpCode,
          ),
        )
      }
    }
    return out
  }
}
