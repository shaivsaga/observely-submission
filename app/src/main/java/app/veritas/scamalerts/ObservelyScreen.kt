package app.veritas.scamalerts

import androidx.compose.foundation.background
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.colorResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** Green identity carried over from the previous Views layout, in light and dark. */
@Composable
fun ObservelyTheme(content: @Composable () -> Unit) {
    val scheme = if (isSystemInDarkTheme()) {
        darkColorScheme(
            primary = colorResource(R.color.observely_green),
            background = colorResource(R.color.observely_surface),
            surface = colorResource(R.color.observely_surface),
            onSurface = colorResource(R.color.observely_on_surface),
        )
    } else {
        lightColorScheme(
            primary = colorResource(R.color.observely_bar),
            background = colorResource(R.color.observely_surface),
            surface = colorResource(R.color.observely_surface),
            onSurface = colorResource(R.color.observely_on_surface),
        )
    }
    MaterialTheme(colorScheme = scheme, content = content)
}

/** One scrolling setup screen: honest state per gate, and a button only when that gate can be fixed. */
@Composable
fun ObservelyScreen(
    state: SetupState,
    permissionActionLabel: Int,
    onListenerAction: () -> Unit,
    onPermissionAction: () -> Unit,
    onAppNotificationsAction: () -> Unit,
    onChannelAction: () -> Unit,
) {
    val surface = colorResource(R.color.observely_surface)
    val muted = colorResource(R.color.observely_muted)
    val ok = colorResource(R.color.observely_ok)
    val off = colorResource(R.color.observely_off)
    val warn = colorResource(R.color.observely_warn)

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(surface)
            .safeDrawingPadding()
            .verticalScroll(rememberScrollState())
            .padding(start = 24.dp, top = 24.dp, end = 24.dp, bottom = 32.dp),
    ) {
        SectionText(stringResource(R.string.app_name), 32, colorResource(R.color.observely_green), bold = true, heading = true)
        SectionText(stringResource(R.string.tagline), 18, colorResource(R.color.observely_on_surface))
        SectionText(stringResource(R.string.setup_heading), 22, colorResource(R.color.observely_green), bold = true, top = 8.dp, heading = true)

        val ready = state.warningsReady
        Column(modifier = Modifier.fillMaxWidth().background(colorResource(R.color.observely_summary))) {
            Text(
                text = stringResource(if (ready) R.string.summary_ready else R.string.summary_not_ready),
                color = if (ready) ok else off,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier
                    .padding(start = 16.dp, top = 14.dp, end = 16.dp, bottom = 8.dp)
                    .semantics { liveRegion = LiveRegionMode.Polite },
            )
            Text(
                text = stringResource(if (ready) R.string.summary_detail_ready else R.string.summary_detail_not_ready),
                color = muted,
                fontSize = 16.sp,
                lineHeight = 21.sp,
                modifier = Modifier.padding(start = 16.dp, end = 16.dp, bottom = 14.dp),
            )
        }

        val listenerOn = state.listenerAccess == ListenerAccess.ON
        SetupStep(
            title = stringResource(R.string.setup_listener_title),
            status = stringResource(if (listenerOn) R.string.setup_listener_on else R.string.setup_listener_off),
            statusColor = if (listenerOn) ok else off,
            detail = stringResource(R.string.setup_listener_detail),
            actionLabel = stringResource(if (listenerOn) R.string.setup_listener_action_on else R.string.setup_listener_action_off),
            onAction = onListenerAction,
        )

        SetupStep(
            title = stringResource(R.string.setup_permission_title),
            status = when (state.notificationPermission) {
                NotificationPermission.NOT_REQUIRED -> stringResource(R.string.setup_permission_not_required)
                NotificationPermission.GRANTED -> stringResource(R.string.setup_permission_granted)
                NotificationPermission.DENIED -> stringResource(R.string.setup_permission_denied)
            },
            statusColor = if (state.notificationPermission == NotificationPermission.DENIED) off else ok,
            detail = stringResource(R.string.setup_permission_detail),
            actionLabel = if (state.notificationPermission == NotificationPermission.DENIED) {
                stringResource(permissionActionLabel)
            } else {
                null
            },
            onAction = onPermissionAction,
        )

        val appOn = state.appNotifications == AppNotificationState.ON
        SetupStep(
            title = stringResource(R.string.setup_app_notifications_title),
            status = stringResource(if (appOn) R.string.setup_app_notifications_on else R.string.setup_app_notifications_off),
            statusColor = if (appOn) ok else off,
            detail = stringResource(R.string.setup_app_notifications_detail),
            actionLabel = if (appOn) null else stringResource(R.string.setup_notification_settings_action),
            onAction = onAppNotificationsAction,
        )

        SetupStep(
            title = stringResource(R.string.setup_channel_title),
            status = when (state.warningChannel) {
                WarningChannel.READY -> stringResource(R.string.setup_channel_ready)
                WarningChannel.NOT_CREATED -> stringResource(R.string.setup_channel_not_created)
                WarningChannel.BLOCKED -> stringResource(R.string.setup_channel_blocked)
            },
            statusColor = when (state.warningChannel) {
                WarningChannel.READY -> ok
                WarningChannel.NOT_CREATED -> warn
                WarningChannel.BLOCKED -> off
            },
            detail = stringResource(R.string.setup_channel_detail),
            actionLabel = if (state.warningChannel == WarningChannel.BLOCKED) {
                stringResource(R.string.setup_channel_action)
            } else {
                null
            },
            onAction = onChannelAction,
        )

        SectionText(stringResource(R.string.about_heading), 22, colorResource(R.color.observely_green), bold = true, top = 20.dp, heading = true)
        SectionText(stringResource(R.string.about_prototype), 16, muted)
        SectionText(stringResource(R.string.about_sources), 16, muted)
        SectionText(stringResource(R.string.about_privacy), 16, muted)
    }
}

@Composable
private fun SetupStep(
    title: String,
    status: String,
    statusColor: Color,
    detail: String,
    actionLabel: String?,
    onAction: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        SectionText(title, 20, colorResource(R.color.observely_on_surface), bold = true, top = 20.dp, heading = true)
        SectionText(status, 18, statusColor, bold = true)
        SectionText(detail, 16, colorResource(R.color.observely_muted))
        if (actionLabel != null) {
            Button(
                onClick = onAction,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 10.dp, bottom = 8.dp)
                    .heightIn(min = 56.dp),
            ) {
                Text(text = actionLabel, fontSize = 17.sp)
            }
        }
    }
}

@Composable
private fun SectionText(
    text: String,
    size: Int,
    color: Color,
    bold: Boolean = false,
    top: Dp = 0.dp,
    heading: Boolean = false,
) {
    Text(
        text = text,
        color = color,
        fontSize = size.sp,
        lineHeight = (size * 1.15f).sp,
        fontWeight = if (bold) FontWeight.Bold else FontWeight.Normal,
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = top, bottom = 4.dp)
            .then(if (heading) Modifier.semantics { heading() } else Modifier),
    )
}
