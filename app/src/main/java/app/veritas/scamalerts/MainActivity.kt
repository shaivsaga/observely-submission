package app.veritas.scamalerts

import android.Manifest
import android.app.NotificationManager
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

/** Single Compose activity. Reads the four independent Android gates and offers a fixed way to fix each one. */
class MainActivity : ComponentActivity() {
    private var state by mutableStateOf(initialState())
    private var askedForWarningPermission by mutableStateOf(false)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        askedForWarningPermission = savedInstanceState?.getBoolean(KEY_ASKED_FOR_WARNING_PERMISSION) ?: false
        enableEdgeToEdge()
        setContent {
            ObservelyTheme {
                ObservelyScreen(
                    state = state,
                    permissionActionLabel = permissionActionLabel(),
                    onListenerAction = ::openListenerSettings,
                    onPermissionAction = ::allowWarningNotifications,
                    onAppNotificationsAction = ::openAppNotificationSettings,
                    onChannelAction = ::openWarningChannelSettings,
                )
            }
        }
        refreshSetup()
    }

    override fun onResume() {
        super.onResume()
        refreshSetup()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        outState.putBoolean(KEY_ASKED_FOR_WARNING_PERMISSION, askedForWarningPermission)
        super.onSaveInstanceState(outState)
    }

    private val requestWarningPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) {
            askedForWarningPermission = true
            refreshSetup()
        }

    private fun refreshSetup() {
        val manager = getSystemService(NotificationManager::class.java)
        val channel = manager.getNotificationChannel(ScamListener.WARNING_CHANNEL_ID)
        state = SetupEvaluator.evaluate(
            SetupSnapshot(
                listenerEnabled = listenerAccessGranted(),
                notificationsPermissionGranted = warningPermissionGranted(),
                appNotificationsEnabled = manager.areNotificationsEnabled(),
                warningChannelExists = channel != null,
                warningChannelBlocked = channel?.importance == NotificationManager.IMPORTANCE_NONE,
                sdkInt = Build.VERSION.SDK_INT,
            )
        )
    }

    private fun listenerAccessGranted(): Boolean {
        val enabled = Settings.Secure.getString(contentResolver, "enabled_notification_listeners") ?: return false
        return ListenerAccessChecker.isGranted(enabled, packageName, ScamListener::class.java.name)
    }

    private fun warningPermissionGranted(): Boolean =
        Build.VERSION.SDK_INT < SetupEvaluator.POST_NOTIFICATIONS_SDK ||
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    private fun permissionActionLabel(): Int {
        val canAskAgain = Build.VERSION.SDK_INT >= SetupEvaluator.POST_NOTIFICATIONS_SDK &&
            shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS)
        return if (askedForWarningPermission && !canAskAgain) {
            R.string.setup_notification_settings_action
        } else {
            R.string.setup_permission_action
        }
    }

    private fun allowWarningNotifications() {
        if (Build.VERSION.SDK_INT < SetupEvaluator.POST_NOTIFICATIONS_SDK) {
            refreshSetup()
            return
        }
        val canAskAgain = !askedForWarningPermission || shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS)
        if (canAskAgain) {
            askedForWarningPermission = true
            requestWarningPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        } else {
            openAppNotificationSettings()
        }
    }

    private fun openListenerSettings() {
        openSettings(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
    }

    private fun openAppNotificationSettings() {
        val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
            .putExtra(Settings.EXTRA_APP_PACKAGE, packageName)
        openSettings(intent)
    }

    private fun openWarningChannelSettings() {
        val intent = Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS)
            .putExtra(Settings.EXTRA_APP_PACKAGE, packageName)
            .putExtra(Settings.EXTRA_CHANNEL_ID, ScamListener.WARNING_CHANNEL_ID)
        openSettings(intent)
    }

    private fun openSettings(intent: Intent) {
        try {
            startActivity(intent)
        } catch (_: Exception) {
            val fallback = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$packageName"))
            try {
                startActivity(fallback)
            } catch (_: Exception) {
                Toast.makeText(this, R.string.settings_unavailable, Toast.LENGTH_LONG).show()
            }
        }
    }

    private companion object {
        const val KEY_ASKED_FOR_WARNING_PERMISSION = "asked_for_warning_permission"

        /** Everything starts off until Android is actually asked. */
        fun initialState() = SetupState(
            listenerAccess = ListenerAccess.OFF,
            notificationPermission = NotificationPermission.DENIED,
            appNotifications = AppNotificationState.OFF,
            warningChannel = WarningChannel.NOT_CREATED,
        )
    }
}
