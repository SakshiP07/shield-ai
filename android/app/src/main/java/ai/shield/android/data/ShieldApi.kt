package ai.shield.android.data

import com.squareup.moshi.Json
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Query

interface ShieldApi {
    data class ConnectionResponse(
        val connected: Boolean,
        val platform: String = "android",
        @Json(name = "ios_supported") val iosSupported: Boolean = false,
    )

    data class IngestItem(
        @Json(name = "android_sms_id") val androidSmsId: String,
        val address: String,
        val body: String,
        val sender: String?,
        @Json(name = "received_at") val receivedAt: String,
        @Json(name = "is_read") val isRead: Boolean,
        @Json(name = "thread_id") val threadId: String?,
        @Json(name = "is_otp") val isOtp: Boolean?,
        @Json(name = "otp_code") val otpCode: String?,
    )

    data class IngestRequest(
        val messages: List<IngestItem>,
        @Json(name = "device_info") val deviceInfo: Map<String, String>? = null,
        @Json(name = "auto_scan") val autoScan: Boolean = true,
    )

    data class IngestResponse(
        val created: Int,
        val updated: Int,
        val scanned: Int,
    )

    data class InboxItem(
        val id: String,
        @Json(name = "android_sms_id") val androidSmsId: String,
        val address: String,
        @Json(name = "phone_number") val phoneNumber: String,
        val sender: String,
        val body: String,
        @Json(name = "received_at") val receivedAt: String,
        val timestamp: String,
        @Json(name = "is_read") val isRead: Boolean,
        val unread: Boolean,
        @Json(name = "is_otp") val isOtp: Boolean,
        @Json(name = "otp_code") val otpCode: String?,
        val badge: String?,
        val decision: String?,
    )

    data class InboxResponse(
        val items: List<InboxItem>,
        val total: Int,
        val page: Int,
        @Json(name = "page_size") val pageSize: Int,
        @Json(name = "total_pages") val totalPages: Int,
        val connected: Boolean,
    )

    @GET("sms/connection")
    suspend fun connection(): ConnectionResponse

    @POST("sms/connect")
    suspend fun connect(): ConnectionResponse

    @POST("sms/disconnect")
    suspend fun disconnect(): ConnectionResponse

    @POST("sms/ingest")
    suspend fun ingestSms(@Body body: IngestRequest): IngestResponse

    @GET("sms/inbox")
    suspend fun inbox(
        @Query("search") search: String? = null,
        @Query("page") page: Int = 1,
        @Query("page_size") pageSize: Int = 20,
        @Query("unread_only") unreadOnly: Boolean? = null,
        @Query("otp_only") otpOnly: Boolean? = null,
    ): InboxResponse
}

object ShieldApiClient {
    /** All HTTP traffic goes to [ApiConfig.BASE_URL] (from BuildConfig.API_BASE_URL). */
    fun create(token: String): ShieldApi {
        val auth = Interceptor { chain ->
            val req = chain.request().newBuilder()
                .header("Authorization", "Bearer $token")
                .header("Accept", "application/json")
                .build()
            chain.proceed(req)
        }
        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BASIC
        }
        val client = OkHttpClient.Builder()
            .addInterceptor(auth)
            .addInterceptor(logging)
            .build()
        val moshi = Moshi.Builder()
            .add(KotlinJsonAdapterFactory())
            .build()
        return Retrofit.Builder()
            .baseUrl(ApiConfig.BASE_URL)
            .client(client)
            .addConverterFactory(MoshiConverterFactory.create(moshi))
            .build()
            .create(ShieldApi::class.java)
    }
}
