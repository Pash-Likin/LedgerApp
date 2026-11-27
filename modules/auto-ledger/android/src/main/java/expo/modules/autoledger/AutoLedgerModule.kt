package expo.modules.autoledger

import android.Manifest
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.app.ActivityCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import org.json.JSONObject

class AutoLedgerModule : Module() {
  private val contextOrNull: Context?
    get() = appContext.reactContext

  private val bridgeListener = object : AutoLedgerBridge.Listener {
    override fun onCapturesUpdated() {
      sendEvent("onCapturesChanged", mapOf("timestamp" to System.currentTimeMillis().toDouble()))
    }

    override fun onLaunchActionReceived(action: String, captureId: String?) {
      sendEvent(
        "onLaunchAction",
        mapOf(
          "action" to action,
          "captureId" to (captureId ?: "")
        )
      )
    }
  }

  override fun definition() = ModuleDefinition {
    Name("AutoLedger")

    Events("onCapturesChanged", "onLaunchAction")

    OnCreate {
      contextOrNull?.let { CaptureNotifier.ensureChannels(it) }
      AutoLedgerBridge.setListener(bridgeListener)
      handleLaunchIntent(appContext.currentActivity?.intent)
    }

    OnDestroy {
      AutoLedgerBridge.setListener(null)
    }

    OnNewIntent { intent ->
      handleLaunchIntent(intent)
    }

    OnActivityEntersForeground {
      handleLaunchIntent(appContext.currentActivity?.intent)
    }

    Function("getPermissionStatus") {
      val ctx = contextOrNull ?: return@Function mapOf(
        "notificationListener" to false,
        "accessibility" to false,
        "postNotifications" to false
      )
      mapOf(
        "notificationListener" to AutoLedgerStore.isNotificationAccessGranted(ctx),
        "accessibility" to AutoLedgerStore.isAccessibilityAccessGranted(ctx),
        "postNotifications" to AutoLedgerStore.canPostNotifications(ctx)
      )
    }

    Function("requestPostNotificationsPermission") {
      val ctx = contextOrNull ?: return@Function false
      if (AutoLedgerStore.canPostNotifications(ctx)) {
        return@Function true
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        val activity = appContext.currentActivity
        if (activity != null) {
          ActivityCompat.requestPermissions(
            activity,
            arrayOf(Manifest.permission.POST_NOTIFICATIONS),
            9401
          )
          return@Function false
        }
      }
      openAppNotificationSettings(ctx)
      false
    }

    Function("openNotificationListenerSettings") {
      val ctx = contextOrNull ?: return@Function Unit
      val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      startSafeActivity(ctx, intent)
    }

    Function("openAccessibilitySettings") {
      val ctx = contextOrNull ?: return@Function Unit
      val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      startSafeActivity(ctx, intent)
    }

    Function("openAppNotificationSettings") {
      val ctx = contextOrNull ?: return@Function Unit
      openAppNotificationSettings(ctx)
    }

    Function("openBatteryOptimizationSettings") {
      val ctx = contextOrNull ?: return@Function Unit
      val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
      } else {
        Intent(Settings.ACTION_SETTINGS)
      }.apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      startSafeActivity(ctx, intent)
    }

    Function("getSettings") {
      val ctx = contextOrNull ?: return@Function mapOf(
        "notificationEnabled" to false,
        "accessibilityEnabled" to false,
        "hapticsEnabled" to true
      )
      mapOf(
        "notificationEnabled" to AutoLedgerStore.isNotificationListenerFeatureEnabled(ctx),
        "accessibilityEnabled" to AutoLedgerStore.isAccessibilityFeatureEnabled(ctx),
        "hapticsEnabled" to AutoLedgerStore.isHapticsEnabled(ctx)
      )
    }

    Function("updateSettings") { notificationEnabled: Boolean, accessibilityEnabled: Boolean ->
      val ctx = contextOrNull ?: return@Function Unit
      AutoLedgerStore.setFeatureSettings(ctx, notificationEnabled, accessibilityEnabled)
    }

    Function("getHapticsEnabled") {
      val ctx = contextOrNull ?: return@Function true
      AutoLedgerStore.isHapticsEnabled(ctx)
    }

    Function("setHapticsEnabled") { enabled: Boolean ->
      val ctx = contextOrNull ?: return@Function Unit
      AutoLedgerStore.setHapticsEnabled(ctx, enabled)
    }

    Function("getCaptureLogs") {
      val ctx = contextOrNull ?: return@Function "[]"
      AutoLedgerStore.getLogsJson(ctx)
    }

    Function("clearCaptureLogs") {
      val ctx = contextOrNull ?: return@Function Unit
      AutoLedgerStore.clearLogs(ctx)
    }

    Function("getCaptures") {
      val ctx = contextOrNull ?: return@Function "[]"
      AutoLedgerStore.getCapturesJson(ctx)
    }

    Function("removeCapture") { id: String ->
      val ctx = contextOrNull ?: return@Function Unit
      val removed = AutoLedgerStore.removeCapture(ctx, id)
      if (removed != null) {
        CaptureNotifier.cancelNotification(ctx, removed.notificationId)
        LedgerSummaryWidgetProvider.refreshAllWidgets(ctx)
      }
    }

    Function("clearConfirmedCaptures") { idsJson: String ->
      val ctx = contextOrNull ?: return@Function Unit
      val ids = mutableListOf<String>()
      try {
        val arr = JSONArray(idsJson)
        for (i in 0 until arr.length()) {
          val id = arr.optString(i)
          if (id.isNotEmpty()) ids.add(id)
        }
      } catch (_: Exception) {
        // Ignore malformed json
      }
      AutoLedgerStore.removeCapturesByIds(ctx, ids)
      LedgerSummaryWidgetProvider.refreshAllWidgets(ctx)
    }

    Function("consumeLaunchAction") {
      val pair = AutoLedgerBridge.consumeLaunchAction() ?: return@Function null
      JSONObject().apply {
        put("action", pair.first)
        put("captureId", pair.second ?: "")
      }.toString()
    }

    Function("updateWidgetData") { monthLabel: String, totalExpenseCents: Double, totalIncomeCents: Double, netCents: Double, latestSummary: String ->
      val ctx = contextOrNull ?: return@Function Unit
      AutoLedgerStore.saveWidgetSnapshot(
        context = ctx,
        monthLabel = monthLabel,
        totalExpenseCents = totalExpenseCents.toLong(),
        totalIncomeCents = totalIncomeCents.toLong(),
        netCents = netCents.toLong(),
        latestSummary = latestSummary
      )
      LedgerSummaryWidgetProvider.refreshAllWidgets(ctx)
    }

    Function("requestPinWidget") {
      val ctx = contextOrNull ?: return@Function false
      LedgerSummaryWidgetProvider.requestPinWidget(ctx)
    }

    Function("simulateCaptureNotification") { sourceApp: String, sampleText: String ->
      val ctx = contextOrNull ?: return@Function false
      val outcome = PaymentTextParser.parseWithReason(
        sourceApp = sourceApp,
        title = sourceApp,
        content = sampleText,
        requireCompletionHeader = false
      )
      val parsed = outcome.parsed ?: return@Function false
      val record = AutoLedgerStore.addCapture(ctx, parsed, "demo")
      val yuan = AutoLedgerStore.formatCentsYuan(parsed.amountCents)
      AutoLedgerStore.appendLog(
        context = ctx,
        sourceApp = sourceApp,
        channel = "demo",
        rawSnippet = sampleText,
        outcome = "模拟识别 ¥$yuan → ${parsed.suggestedCategoryName}",
        matched = true
      )
      CaptureNotifier.showCaptureNotification(ctx, record)
      LedgerSummaryWidgetProvider.refreshAllWidgets(ctx)
      AutoLedgerBridge.notifyCapturesUpdated()
      true
    }
  }

  private fun handleLaunchIntent(intent: Intent?) {
    if (intent == null) return
    val action = intent.getStringExtra(AutoLedgerStore.EXTRA_ACTION) ?: return
    val captureId = intent.getStringExtra(AutoLedgerStore.EXTRA_CAPTURE_ID)
    intent.removeExtra(AutoLedgerStore.EXTRA_ACTION)
    intent.removeExtra(AutoLedgerStore.EXTRA_CAPTURE_ID)
    AutoLedgerBridge.postLaunchAction(action, captureId)
  }

  private fun openAppNotificationSettings(ctx: Context) {
    val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
        putExtra(Settings.EXTRA_APP_PACKAGE, ctx.packageName)
      }
    } else {
      Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
        data = Uri.parse("package:${ctx.packageName}")
      }
    }.apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    startSafeActivity(ctx, intent)
  }

  private fun startSafeActivity(ctx: Context, intent: Intent) {
    try {
      ctx.startActivity(intent)
    } catch (_: Exception) {
      try {
        val fallback = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
          data = Uri.parse("package:${ctx.packageName}")
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        ctx.startActivity(fallback)
      } catch (_: Exception) {
        // Ignore if device restricts settings navigation
      }
    }
  }
}
