package expo.modules.autoledger

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class CaptureActionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context?, intent: Intent?) {
    if (context == null || intent == null) return
    val captureId = intent.getStringExtra(AutoLedgerStore.EXTRA_CAPTURE_ID) ?: return

    when (intent.action) {
      AutoLedgerStore.BROADCAST_CONFIRM -> {
        val updated = AutoLedgerStore.markCaptureConfirmed(context, captureId)
        if (updated != null) {
          CaptureNotifier.cancelNotification(context, updated.notificationId)
          CaptureNotifier.showConfirmedFeedback(context, updated)
          LedgerSummaryWidgetProvider.refreshAllWidgets(context)
          AutoLedgerBridge.notifyCapturesUpdated()
        }
      }

      AutoLedgerStore.BROADCAST_IGNORE -> {
        val removed = AutoLedgerStore.removeCapture(context, captureId)
        if (removed != null) {
          CaptureNotifier.cancelNotification(context, removed.notificationId)
          LedgerSummaryWidgetProvider.refreshAllWidgets(context)
          AutoLedgerBridge.notifyCapturesUpdated()
        }
      }
    }
  }
}
