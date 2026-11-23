package expo.modules.autoledger

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

class AutoLedgerNotificationListener : NotificationListenerService() {
  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    super.onNotificationPosted(sbn)
    if (sbn == null) return

    val pkg = sbn.packageName ?: return
    if (pkg == applicationContext.packageName) return
    if (!AutoLedgerStore.isNotificationListenerFeatureEnabled(applicationContext)) return
    if (!PaymentTextParser.isMonitoredPackage(pkg)) return

    val notification = sbn.notification ?: return
    if ((notification.flags and Notification.FLAG_GROUP_SUMMARY) != 0) return

    val extras = notification.extras ?: return
    val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString() ?: ""
    val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString() ?: ""
    val bigText = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString() ?: ""
    val subText = extras.getCharSequence(Notification.EXTRA_SUB_TEXT)?.toString() ?: ""

    val combinedContent = listOf(bigText, text, subText)
      .filter { it.isNotBlank() }
      .distinct()
      .joinToString(" ")

    val sourceApp = PaymentTextParser.getSourceAppName(pkg)
    val parsed = PaymentTextParser.parse(
      sourceApp = sourceApp,
      title = title,
      content = combinedContent,
      requireCompletionHeader = false
    ) ?: return

    if (AutoLedgerStore.isDuplicateCapture(
        applicationContext,
        parsed.amountCents,
        parsed.type,
        parsed.sourceApp
      )
    ) {
      return
    }

    val record = AutoLedgerStore.addCapture(applicationContext, parsed, "notification")
    CaptureNotifier.showCaptureNotification(applicationContext, record)
    LedgerSummaryWidgetProvider.refreshAllWidgets(applicationContext)
    AutoLedgerBridge.notifyCapturesUpdated()
  }
}
