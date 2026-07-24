package ai.shield.android.ui

import android.Manifest
import android.app.Application
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import ai.shield.android.data.SessionStore
import ai.shield.android.data.ShieldApi
import ai.shield.android.data.ShieldApiClient
import ai.shield.android.sms.DeviceSms
import ai.shield.android.sms.SmsContentObserver
import ai.shield.android.sms.SmsContentProviderReader
import ai.shield.android.sms.toIngestItem
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class SmsUiState(
    val tokenInput: String = "",
    val hasPermission: Boolean = false,
    val connected: Boolean = false,
    val loading: Boolean = false,
    val syncing: Boolean = false,
    val search: String = "",
    val page: Int = 0,
    val messages: List<DeviceSms> = emptyList(),
    val endReached: Boolean = false,
    val error: String? = null,
    val lastSyncMessage: String? = null,
)

class SmsViewModel(app: Application) : AndroidViewModel(app) {
    private val store = SessionStore(app)
    private val reader = SmsContentProviderReader(app)
    private val pageSize = 20

    private val _state = MutableStateFlow(
        SmsUiState(
            tokenInput = store.getToken().orEmpty(),
            connected = store.isSmsConnected(),
            hasPermission = hasReadSmsPermission(),
        ),
    )
    val state: StateFlow<SmsUiState> = _state.asStateFlow()

    private var observer: SmsContentObserver? = null
    private var debounceJob: Job? = null

    init {
        if (store.isSmsConnected() && hasReadSmsPermission()) {
            startObserver()
            refresh(reset = true)
        }
    }

    fun onTokenChange(value: String) {
        _state.update { it.copy(tokenInput = value) }
        store.setToken(value.trim().ifBlank { null })
    }

    fun onSearchChange(value: String) {
        _state.update { it.copy(search = value) }
        debounceJob?.cancel()
        debounceJob = viewModelScope.launch {
            delay(300)
            if (_state.value.connected && _state.value.hasPermission) {
                refresh(reset = true)
            }
        }
    }

    fun onPermissionResult(granted: Boolean) {
        _state.update { it.copy(hasPermission = granted) }
        if (granted && _state.value.connected) {
            startObserver()
            refresh(reset = true)
            syncToBackend(full = true)
        }
    }

    fun connect() {
        viewModelScope.launch {
            if (!hasReadSmsPermission()) {
                _state.update { it.copy(error = "READ_SMS permission is required") }
                return@launch
            }
            val token = store.getToken()
            if (token.isNullOrBlank()) {
                _state.update { it.copy(error = "Paste your Shield AI access token first") }
                return@launch
            }
            _state.update { it.copy(loading = true, error = null) }
            runCatching {
                ShieldApiClient.create(token).connect()
            }.onSuccess {
                store.setSmsConnected(true)
                _state.update { s -> s.copy(connected = true, loading = false) }
                startObserver()
                refresh(reset = true)
                syncToBackend(full = true)
            }.onFailure { e ->
                // Still allow local inbox if backend is unreachable after permission grant
                store.setSmsConnected(true)
                _state.update {
                    it.copy(
                        connected = true,
                        loading = false,
                        error = "Connected locally; backend sync failed: ${e.message}",
                    )
                }
                startObserver()
                refresh(reset = true)
            }
        }
    }

    fun disconnect() {
        viewModelScope.launch {
            stopObserver()
            store.setSmsConnected(false)
            val token = store.getToken()
            if (!token.isNullOrBlank()) {
                runCatching { ShieldApiClient.create(token).disconnect() }
            }
            _state.update {
                it.copy(
                    connected = false,
                    messages = emptyList(),
                    page = 0,
                    endReached = false,
                    lastSyncMessage = "SMS disconnected",
                )
            }
        }
    }

    fun loadMore() {
        val s = _state.value
        if (!s.connected || !s.hasPermission || s.loading || s.endReached) return
        refresh(reset = false)
    }

    fun refresh(reset: Boolean) {
        viewModelScope.launch {
            if (!hasReadSmsPermission()) return@launch
            _state.update { it.copy(loading = true, error = null) }
            val page = if (reset) 0 else _state.value.page
            val offset = page * pageSize
            val batch = reader.readPage(
                limit = pageSize,
                offset = offset,
                search = _state.value.search,
            )
            _state.update { current ->
                val merged = if (reset) batch else current.messages + batch
                current.copy(
                    loading = false,
                    messages = merged,
                    page = page + 1,
                    endReached = batch.size < pageSize,
                )
            }
        }
    }

    fun syncToBackend(full: Boolean = false) {
        viewModelScope.launch {
            val token = store.getToken() ?: return@launch
            if (!hasReadSmsPermission() || !store.isSmsConnected()) return@launch
            _state.update { it.copy(syncing = true) }
            val since = if (full) 0L else store.lastSyncedEpochMs()
            val batch = if (full) {
                reader.readPage(limit = 100, offset = 0, search = null)
            } else {
                reader.readSince(afterEpochMs = since, limit = 50)
            }
            if (batch.isEmpty()) {
                _state.update { it.copy(syncing = false, lastSyncMessage = "Inbox up to date") }
                return@launch
            }
            runCatching {
                ShieldApiClient.create(token).ingestSms(
                    ShieldApi.IngestRequest(
                        messages = batch.map { it.toIngestItem() },
                        deviceInfo = mapOf("platform" to "android", "source" to "content_provider"),
                        autoScan = true,
                    ),
                )
            }.onSuccess { res ->
                val newest = batch.maxOfOrNull { it.receivedAtEpochMs } ?: store.lastSyncedEpochMs()
                store.setLastSyncedEpochMs(newest)
                _state.update {
                    it.copy(
                        syncing = false,
                        lastSyncMessage = "Synced ${res.scanned} SMS to fraud pipeline",
                    )
                }
            }.onFailure { e ->
                _state.update {
                    it.copy(syncing = false, error = "Sync failed: ${e.message}")
                }
            }
        }
    }

    private fun startObserver() {
        if (observer != null) return
        observer = SmsContentObserver(getApplication()) {
            viewModelScope.launch {
                delay(400)
                refresh(reset = true)
                syncToBackend(full = false)
            }
        }.also { it.start() }
    }

    private fun stopObserver() {
        observer?.stop()
        observer = null
    }

    private fun hasReadSmsPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            getApplication(),
            Manifest.permission.READ_SMS,
        ) == PackageManager.PERMISSION_GRANTED
    }

    override fun onCleared() {
        stopObserver()
        super.onCleared()
    }
}
