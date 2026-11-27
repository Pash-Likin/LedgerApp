package expo.modules.autoledger

import android.app.Notification
import android.content.ComponentName
import android.os.Build
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

class AutoLedgerNotificationListener : NotificationListenerService() {
  override fun onListenerDisconnected() {
    super.onListenerDisconnected()
    if (!AutoLedgerStore.isNotificationListenerFeatureEnabled(applicationContext)) return
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      try {
        requestRebind(ComponentName(this, AutoLedgerNotificationListener::class.java))
      } catch (_: Exception) {
        // Ignore if system refuses immediate rebind
      }
    }
  }

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

    val rawPreview = listOf(title, combinedContent).filter { it.isNotBlank() }.joinToString(" · ")
    if (rawPreview.isBlank()) return

    val sourceApp = PaymentTextParser.getSourceAppName(pkg)
    val isSms = PaymentTextParser.isSmsPackage(pkg)
    val outcome = PaymentTextParser.parseWithReason(
      sourceApp = sourceApp,
      title = title,
      content = combinedContent,
      requireCompletionHeader = false,
      isSms = isSms
    )

    val parsed = outcome.parsed
    if (parsed == null) {
      // Only log notifications that look remotely financial (contain digits or payment words)
      if (rawPreview.any { it.isDigit() } || rawPreview.contains("支付") || rawPreview.contains("付款") || rawPreview.contains("收款")) {
        AutoLedgerStore.appendLog(
          context = applicationContext,
          sourceApp = sourceApp,
          channel = "notification",
          rawSnippet = rawPreview,
          outcome = "跳过：${outcome.rejectReason ?: "未匹配"}",
          matched = false
        )
      }
      return
    }

    if (AutoLedgerStore.isDuplicateCapture(
        applicationContext,
        parsed.amountCents,
        parsed.type,
        parsed.sourceApp
      )
    ) {
      AutoLedgerStore.appendLog(
        context = applicationContext,
        sourceApp = sourceApp,
        channel = "notification",
        rawSnippet = rawPreview,
        outcome = "跳过：20秒内重复记录",
        matched = false
      )
      return
    }

    val record = AutoLedgerStore.addCapture(applicationContext, parsed, "notification")
    val yuan = AutoLedgerStore.formatCentsYuan(parsed.amountCents)
    AutoLedgerStore.appendLog(
      context = applicationContext,
      sourceApp = sourceApp,
      channel = "notification",
      rawSnippet = rawPreview,
      outcome = "已识别 ¥$yuan → ${parsed.suggestedCategoryName}",
      matched = true
    )
    CaptureNotifier.showCaptureNotification(applicationContext, record)
    LedgerSummaryWidgetProvider.refreshAllWidgets(applicationContext)
    AutoLedgerBridge.notifyCapturesUpdated()
  }
}
