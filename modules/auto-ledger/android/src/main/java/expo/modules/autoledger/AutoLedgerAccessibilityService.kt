package expo.modules.autoledger

import android.accessibilityservice.AccessibilityService
import android.os.SystemClock
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

class AutoLedgerAccessibilityService : AccessibilityService() {
  private var lastScanAtMs = 0L

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    if (event == null) return
    val pkg = event.packageName?.toString() ?: return
    if (pkg == applicationContext.packageName) return
    if (!AutoLedgerStore.isAccessibilityFeatureEnabled(applicationContext)) return
    if (!PaymentTextParser.isMonitoredPackage(pkg)) return

    val now = SystemClock.elapsedRealtime()
    if (now - lastScanAtMs < 500L) return
    lastScanAtMs = now

    val root = try {
      rootInActiveWindow
    } catch (_: Exception) {
      null
    } ?: return

    val textParts = mutableListOf<String>()
    collectNodeTexts(root, textParts, depth = 0)
    if (textParts.isEmpty()) return

    val combined = textParts.distinct().joinToString(" ")
    val sourceApp = PaymentTextParser.getSourceAppName(pkg)
    val parsed = PaymentTextParser.parse(
      sourceApp = sourceApp,
      title = "",
      content = combined,
      requireCompletionHeader = true
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

    val record = AutoLedgerStore.addCapture(applicationContext, parsed, "accessibility")
    CaptureNotifier.showCaptureNotification(applicationContext, record)
    LedgerSummaryWidgetProvider.refreshAllWidgets(applicationContext)
    AutoLedgerBridge.notifyCapturesUpdated()
  }

  override fun onInterrupt() {
    // Nothing to clean up
  }

  private fun collectNodeTexts(
    node: AccessibilityNodeInfo?,
    out: MutableList<String>,
    depth: Int
  ) {
    if (node == null || depth > 12 || out.size >= 80) return

    val text = node.text?.toString()?.trim()
    if (!text.isNullOrEmpty()) {
      out.add(text)
    } else {
      val desc = node.contentDescription?.toString()?.trim()
      if (!desc.isNullOrEmpty()) {
        out.add(desc)
      }
    }

    val count = node.childCount
    for (i in 0 until count) {
      if (out.size >= 80) break
      val child = try {
        node.getChild(i)
      } catch (_: Exception) {
        null
      }
      if (child != null) {
        collectNodeTexts(child, out, depth + 1)
      }
    }
  }
}
