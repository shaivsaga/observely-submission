package app.veritas.scamalerts

/** Immutable snapshot of the independent Android settings that decide whether Observely may warn. */
data class SetupSnapshot(
    val listenerEnabled: Boolean,
    val notificationsPermissionGranted: Boolean,
    val appNotificationsEnabled: Boolean,
    val warningChannelExists: Boolean,
    val warningChannelBlocked: Boolean,
    val sdkInt: Int,
)

enum class ListenerAccess { ON, OFF }

enum class NotificationPermission { NOT_REQUIRED, GRANTED, DENIED }

enum class AppNotificationState { ON, OFF }

enum class WarningChannel { READY, NOT_CREATED, BLOCKED }

data class SetupState(
    val listenerAccess: ListenerAccess,
    val notificationPermission: NotificationPermission,
    val appNotifications: AppNotificationState,
    val warningChannel: WarningChannel,
) {
    /** Alerts are only advertised as ready when every independent Android gate permits a warning. */
    val warningsReady: Boolean
        get() = listenerAccess == ListenerAccess.ON &&
            notificationPermission != NotificationPermission.DENIED &&
            appNotifications == AppNotificationState.ON &&
            warningChannel == WarningChannel.READY
}

/** Pure decision table kept free of Android APIs so every setup combination can be tested as a unit. */
object SetupEvaluator {
    const val POST_NOTIFICATIONS_SDK = 33

    fun evaluate(snapshot: SetupSnapshot): SetupState {
        val permission = when {
            snapshot.sdkInt < POST_NOTIFICATIONS_SDK -> NotificationPermission.NOT_REQUIRED
            snapshot.notificationsPermissionGranted -> NotificationPermission.GRANTED
            else -> NotificationPermission.DENIED
        }
        val channel = when {
            !snapshot.warningChannelExists -> WarningChannel.NOT_CREATED
            snapshot.warningChannelBlocked -> WarningChannel.BLOCKED
            else -> WarningChannel.READY
        }
        return SetupState(
            listenerAccess = if (snapshot.listenerEnabled) ListenerAccess.ON else ListenerAccess.OFF,
            notificationPermission = permission,
            appNotifications = if (snapshot.appNotificationsEnabled) AppNotificationState.ON else AppNotificationState.OFF,
            warningChannel = channel,
        )
    }
}

/**
 * Parses Android's colon-separated enabled-listener setting without a package-substring shortcut.
 * The system stores flattened ComponentName values, so only the exact component counts as access.
 */
object ListenerAccessChecker {
    fun isGranted(enabledListeners: String?, expectedPackage: String, expectedClass: String): Boolean {
        if (enabledListeners.isNullOrBlank()) return false
        val expectedComponentClass = canonicalClass(expectedPackage, expectedClass)
        return enabledListeners.split(':').any { entry ->
            val separator = entry.indexOf('/')
            if (separator <= 0 || separator == entry.lastIndex) return@any false
            val packageName = entry.substring(0, separator)
            val className = canonicalClass(packageName, entry.substring(separator + 1))
            packageName == expectedPackage && className == expectedComponentClass
        }
    }

    private fun canonicalClass(packageName: String, className: String): String =
        if (className.startsWith('.')) packageName + className else className
}
