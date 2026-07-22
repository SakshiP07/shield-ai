package ai.shield.android.data

import ai.shield.android.BuildConfig

/**
 * Single runtime access point for the FastAPI backend URL.
 *
 * Source of truth (build time):
 * 1. `android/local.properties` → `API_BASE_URL=...` (optional override)
 * 2. `android/gradle.properties` → `API_BASE_URL=...` (default)
 * 3. Injected into `BuildConfig.API_BASE_URL` by `app/build.gradle.kts`
 *
 * Every network client must use [BASE_URL] (not hard-coded hosts).
 */
object ApiConfig {
    val BASE_URL: String
        get() {
            val raw = BuildConfig.API_BASE_URL.trim()
            require(raw.isNotEmpty()) { "API_BASE_URL is empty — set it in gradle.properties or local.properties" }
            return if (raw.endsWith("/")) raw else "$raw/"
        }
}
