package expo.modules.autoledger

import android.accessibilityservice.AccessibilityService
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

class AutoLedgerAccessibilityService : AccessibilityService() {
  private val mainHandler = Handler(Looper.getMainLooper())
  private var lastScanAtMs = 0L
  private var pendingRunnable: Runnable? = null

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    if (event == null) return
    val pkg = event.packageName?.toString() ?: return
    if (pkg == applicationContext.packageName) return
    if (!AutoLedgerStore.isAccessibilityFeatureEnabled(applicationContext)) return
    if (!PaymentTextParser.isMonitoredPackage(pkg) || PaymentTextParser.isSmsPackage(pkg)) return

    // Trailing debounce ensures we always scan the final rendered payment screen
    pendingRunnable?.let { mainHandler.removeCallbacks(it) }
    val now = SystemClock.elapsedRealtime()
    val delayMs = if (now - lastScanAtMs >= 650L) 180L else 320L

    val task = Runnable {
      lastScanAtMs = SystemClock.elapsedRealtime()
      scanActiveWindow(pkg)
    }
    pendingRunnable = task
    mainHandler.postDelayed(task, delayMs)
  }

  override fun onInterrupt() {
    pendingRunnable?.let { mainHandler.removeCallbacks(it) }
    pendingRunnable = null
  }

  override fun onDestroy() {
    pendingRunnable?.let { mainHandler.removeCallbacks(it) }
    pendingRunnable = null
    super.onDestroy()
  }

  private fun scanActiveWindow(pkg: String) {
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
    val outcome = PaymentTextParser.parseWithReason(
      sourceApp = sourceApp,
      title = "",
      content = combined,
      requireCompletionHeader = true,
      isSms = false
    )

    val parsed = outcome.parsed
    if (parsed == null) {
      // Log only when the page had a completion header (avoid spamming logs during casual browsing)
      if (outcome.rejectReason != "未出现支付完成页标志" && PaymentTextParser.hasCompletionOrCurrencyHint(combined)) {
        AutoLedgerStore.appendLog(
          context = applicationContext,
          sourceApp = sourceApp,
          channel = "accessibility",
          rawSnippet = combined,
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
      return
    }

    val record = AutoLedgerStore.addCapture(applicationContext, parsed, "accessibility")
    val yuan = AutoLedgerStore.formatCentsYuan(parsed.amountCents)
    AutoLedgerStore.appendLog(
      context = applicationContext,
      sourceApp = sourceApp,
      channel = "accessibility",
      rawSnippet = combined,
      outcome = "已识别 ¥$yuan → ${parsed.suggestedCategoryName}",
      matched = true
    )
    CaptureNotifier.showCaptureNotification(applicationContext, record)
    LedgerSummaryWidgetProvider.refreshAllWidgets(applicationContext)
    AutoLedgerBridge.notifyCapturesUpdated()
  }

  private fun collectNodeTexts(
    node: AccessibilityNodeInfo?,
    out: MutableList<String>,
    depth: Int
  ) {
    if (node == null || depth > 18 || out.size >= 200) return

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
      if (out.size >= 200) break
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
