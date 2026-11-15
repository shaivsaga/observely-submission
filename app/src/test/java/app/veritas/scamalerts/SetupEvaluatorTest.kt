package app.veritas.scamalerts

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SetupEvaluatorTest {
    private fun ready(
        listenerEnabled: Boolean = true,
        notificationsPermissionGranted: Boolean = true,
        appNotificationsEnabled: Boolean = true,
        warningChannelExists: Boolean = true,
        warningChannelBlocked: Boolean = false,
        sdkInt: Int = 34,
    ) = SetupSnapshot(
        listenerEnabled = listenerEnabled,
        notificationsPermissionGranted = notificationsPermissionGranted,
        appNotificationsEnabled = appNotificationsEnabled,
        warningChannelExists = warningChannelExists,
        warningChannelBlocked = warningChannelBlocked,
        sdkInt = sdkInt,
    )

    @Test
    fun fullyReadyStateIsTheOnlyStateThatClaimsWarningsAreOn() {
        val state = SetupEvaluator.evaluate(ready())

        assertEquals(ListenerAccess.ON, state.listenerAccess)
        assertEquals(NotificationPermission.GRANTED, state.notificationPermission)
        assertEquals(AppNotificationState.ON, state.appNotifications)
        assertEquals(WarningChannel.READY, state.warningChannel)
        assertTrue(state.warningsReady)
    }

    @Test
    fun listenerAccessOffKeepsWarningsOff() {
        val state = SetupEvaluator.evaluate(ready(listenerEnabled = false))

        assertEquals(ListenerAccess.OFF, state.listenerAccess)
        assertFalse(state.warningsReady)
    }

    @Test
    fun deniedPostingPermissionKeepsWarningsOff() {
        val state = SetupEvaluator.evaluate(ready(notificationsPermissionGranted = false))

        assertEquals(NotificationPermission.DENIED, state.notificationPermission)
        assertFalse(state.warningsReady)
    }

    @Test
    fun appNotificationsDisabledKeepsWarningsOff() {
        val state = SetupEvaluator.evaluate(ready(appNotificationsEnabled = false))

        assertEquals(AppNotificationState.OFF, state.appNotifications)
        assertFalse(state.warningsReady)
    }

    @Test
    fun blockedWarningChannelKeepsWarningsOff() {
        val state = SetupEvaluator.evaluate(ready(warningChannelBlocked = true))

        assertEquals(WarningChannel.BLOCKED, state.warningChannel)
        assertFalse(state.warningsReady)
    }

    @Test
    fun missingWarningChannelKeepsWarningsOff() {
        val state = SetupEvaluator.evaluate(ready(warningChannelExists = false))

        assertEquals(WarningChannel.NOT_CREATED, state.warningChannel)
        assertFalse(state.warningsReady)
    }

    @Test
    fun preAndroid13NeedsNoPostingPermissionButStillNeedsTheOtherGates() {
        val state = SetupEvaluator.evaluate(ready(notificationsPermissionGranted = false, sdkInt = 32))

        assertEquals(NotificationPermission.NOT_REQUIRED, state.notificationPermission)
        assertTrue(state.warningsReady)
    }

    @Test
    fun preAndroid13DoesNotHideOtherBlockedGates() {
        val state = SetupEvaluator.evaluate(ready(notificationsPermissionGranted = false, warningChannelBlocked = true, sdkInt = 32))

        assertEquals(NotificationPermission.NOT_REQUIRED, state.notificationPermission)
        assertEquals(WarningChannel.BLOCKED, state.warningChannel)
        assertFalse(state.warningsReady)
    }

    @Test
    fun listenerAccessRequiresTheExactComponent() {
        val packageName = "app.veritas.scamalerts"
        val className = "app.veritas.scamalerts.ScamListener"

        assertTrue(ListenerAccessChecker.isGranted("$packageName/$className", packageName, className))
        assertTrue(ListenerAccessChecker.isGranted("other.app/OtherService:$packageName/$className", packageName, className))
        assertTrue(ListenerAccessChecker.isGranted("$packageName/.ScamListener", packageName, className))
        assertFalse(ListenerAccessChecker.isGranted("$packageName/app.veritas.scamalerts.OtherListener", packageName, className))
        assertFalse(ListenerAccessChecker.isGranted("com.example.$packageName/$className", packageName, className))
        assertFalse(ListenerAccessChecker.isGranted("", packageName, className))
        assertFalse(ListenerAccessChecker.isGranted(null, packageName, className))
    }
}
