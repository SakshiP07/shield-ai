package ai.shield.android.sms

import android.content.Context
import android.database.ContentObserver
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.provider.Telephony

/**
 * Real-time inbox updates via SMS Content Provider observer.
 */
class SmsContentObserver(
    private val context: Context,
    private val onChange: () -> Unit,
) : ContentObserver(Handler(Looper.getMainLooper())) {
    private var registered = false

    fun start() {
        if (registered) return
        context.contentResolver.registerContentObserver(
            Telephony.Sms.Inbox.CONTENT_URI,
            true,
            this,
        )
        registered = true
    }

    fun stop() {
        if (!registered) return
        context.contentResolver.unregisterContentObserver(this)
        registered = false
    }

    override fun onChange(selfChange: Boolean) {
        onChange()
    }

    override fun onChange(selfChange: Boolean, uri: Uri?) {
        onChange()
    }
}
