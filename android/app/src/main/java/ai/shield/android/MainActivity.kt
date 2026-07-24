package ai.shield.android

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.isVisible
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import ai.shield.android.data.ApiConfig
import ai.shield.android.databinding.ActivityMainBinding
import ai.shield.android.sms.DeviceSms
import ai.shield.android.ui.SmsViewModel
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

class MainActivity : AppCompatActivity() {
    private lateinit var binding: ActivityMainBinding
    private val viewModel: SmsViewModel by viewModels()
    private val adapter = SmsAdapter()

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        viewModel.onPermissionResult(granted)
        if (granted) viewModel.connect()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.apiUrlText.text = "API: ${ApiConfig.BASE_URL}"
        binding.smsList.layoutManager = LinearLayoutManager(this)
        binding.smsList.adapter = adapter

        binding.tokenInput.setText(viewModel.state.value.tokenInput)
        binding.tokenInput.addTextChangedListener(SimpleWatcher(viewModel::onTokenChange))
        binding.searchInput.addTextChangedListener(SimpleWatcher(viewModel::onSearchChange))

        binding.connectButton.setOnClickListener {
            if (hasReadSmsPermission()) {
                viewModel.connect()
            } else {
                permissionLauncher.launch(Manifest.permission.READ_SMS)
            }
        }
        binding.disconnectSwitch.setOnCheckedChangeListener { _, checked ->
            if (!checked) viewModel.disconnect()
        }

        binding.smsList.addOnScrollListener(object : RecyclerView.OnScrollListener() {
            override fun onScrolled(recyclerView: RecyclerView, dx: Int, dy: Int) {
                val lm = recyclerView.layoutManager as LinearLayoutManager
                val last = lm.findLastVisibleItemPosition()
                if (last >= adapter.itemCount - 3) {
                    viewModel.loadMore()
                }
            }
        })

        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.state.collect { state ->
                    binding.connectionHint.text = if (state.connected) {
                        "Inbox syncing to fraud pipeline"
                    } else {
                        "Grant READ_SMS to connect"
                    }
                    binding.connectButton.isVisible = !state.connected
                    binding.disconnectSwitch.isVisible = state.connected
                    if (state.connected && !binding.disconnectSwitch.isChecked) {
                        binding.disconnectSwitch.isChecked = true
                    }
                    binding.searchLayout.isVisible = state.connected
                    binding.loadingBar.isVisible = state.loading && state.messages.isEmpty()
                    val status = listOfNotNull(state.error, state.lastSyncMessage).joinToString("\n")
                    binding.statusText.text = status
                    adapter.submit(state.messages)
                }
            }
        }
    }

    private fun hasReadSmsPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.READ_SMS,
        ) == PackageManager.PERMISSION_GRANTED
    }
}

private class SimpleWatcher(private val onChanged: (String) -> Unit) : TextWatcher {
    override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
    override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) = Unit
    override fun afterTextChanged(s: Editable?) {
        onChanged(s?.toString().orEmpty())
    }
}

private class SmsAdapter : RecyclerView.Adapter<SmsAdapter.Holder>() {
    private val items = mutableListOf<DeviceSms>()
    private val formatter = DateTimeFormatter.ofPattern("dd MMM, hh:mm a")
        .withZone(ZoneId.systemDefault())

    fun submit(next: List<DeviceSms>) {
        items.clear()
        items.addAll(next)
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): Holder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_sms, parent, false)
        return Holder(view)
    }

    override fun getItemCount(): Int = items.size

    override fun onBindViewHolder(holder: Holder, position: Int) {
        holder.bind(items[position], formatter)
    }

    class Holder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val unreadDot: View = itemView.findViewById(R.id.unreadDot)
        private val senderText: TextView = itemView.findViewById(R.id.senderText)
        private val timeText: TextView = itemView.findViewById(R.id.timeText)
        private val phoneText: TextView = itemView.findViewById(R.id.phoneText)
        private val bodyText: TextView = itemView.findViewById(R.id.bodyText)
        private val otpText: TextView = itemView.findViewById(R.id.otpText)

        fun bind(sms: DeviceSms, formatter: DateTimeFormatter) {
            unreadDot.isVisible = !sms.isRead
            senderText.text = sms.sender
            timeText.text = formatter.format(Instant.ofEpochMilli(sms.receivedAtEpochMs))
            phoneText.text = sms.address
            bodyText.text = sms.body
            if (sms.isOtp) {
                otpText.isVisible = true
                otpText.text = "OTP detected" + (sms.otpCode?.let { ": $it" } ?: "")
            } else {
                otpText.isVisible = false
            }
        }
    }
}
