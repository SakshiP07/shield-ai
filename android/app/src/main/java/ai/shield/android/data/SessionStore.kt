package ai.shield.android.data

import android.content.Context

class SessionStore(context: Context) {
    private val prefs = context.getSharedPreferences("shield_ai", Context.MODE_PRIVATE)

    fun getToken(): String? = prefs.getString(KEY_TOKEN, null)?.takeIf { it.isNotBlank() }

    fun setToken(token: String?) {
        prefs.edit().putString(KEY_TOKEN, token).apply()
    }

    fun isSmsConnected(): Boolean = prefs.getBoolean(KEY_SMS_CONNECTED, false)

    fun setSmsConnected(connected: Boolean) {
        prefs.edit().putBoolean(KEY_SMS_CONNECTED, connected).apply()
    }

    fun lastSyncedEpochMs(): Long = prefs.getLong(KEY_LAST_SYNC, 0L)

    fun setLastSyncedEpochMs(value: Long) {
        prefs.edit().putLong(KEY_LAST_SYNC, value).apply()
    }

    companion object {
        private const val KEY_TOKEN = "access_token"
        private const val KEY_SMS_CONNECTED = "android_sms_connected"
        private const val KEY_LAST_SYNC = "sms_last_synced_ms"
    }
}
