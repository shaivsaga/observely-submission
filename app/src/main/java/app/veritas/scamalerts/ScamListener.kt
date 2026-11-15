package app.veritas.scamalerts

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

/** Runs in the background once the user allows notification access. Reads notifications from a fixed set of SMS and chat apps, warns on scams. Never blocks or deletes anything. */
class ScamListener : NotificationListenerService() {
    private lateinit var clf: Classifier
    private var lastHash = 0

    override fun onCreate() {
        super.onCreate()
        clf = Classifier(this)
        getSystemService(NotificationManager::class.java)
            .createNotificationChannel(NotificationChannel(WARNING_CHANNEL_ID, getString(R.string.warning_channel_name), NotificationManager.IMPORTANCE_HIGH))
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        if (sbn.packageName !in MESSAGE_APPS) return
        val e = sbn.notification.extras
        val text = (e.getCharSequence(Notification.EXTRA_BIG_TEXT) ?: e.getCharSequence(Notification.EXTRA_TEXT))?.toString() ?: return
        if (text.hashCode() == lastHash) return          // skip repeat updates of the same notification
        lastHash = text.hashCode()
        val r = clf.check(text)                          // the text is never stored, logged or sent anywhere
        if (!r.bad) return
        val why = if (r.words.isNotEmpty()) "Suspicious words: ${r.words.joinToString(", ")}" else "Warning signs: ${r.signs.joinToString("; ")}"
        val warn = Notification.Builder(this, WARNING_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setContentTitle("Careful: this text looks like a scam")
            .setContentText("Don’t tap links or reply.")
            .setStyle(Notification.BigTextStyle().bigText("$why\nDon’t tap links or reply. If you’re unsure, contact the company using a number you already trust."))
            .setAutoCancel(true).build()
        getSystemService(NotificationManager::class.java).notify(1, warn)
    }

    companion object {
        const val WARNING_CHANNEL_ID = "scam"
        val MESSAGE_APPS = setOf(
            // SMS
            "com.google.android.apps.messaging", "com.android.messaging", "com.android.mms",
            "com.samsung.android.messaging", "com.oneplus.mms", "com.miui.mms",
            // Chat apps whose notifications carry the message text
            "com.whatsapp", "com.whatsapp.w4b", "org.telegram.messenger", "com.facebook.orca",
            "org.thoughtcrime.securesms", "com.viber.voip", "jp.naver.line.android",
        )
    }
}
