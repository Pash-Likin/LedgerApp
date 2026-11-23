package expo.modules.autoledger

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.widget.RemoteViews

class LedgerSummaryWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetIds: IntArray
  ) {
    for (widgetId in appWidgetIds) {
      updateSingleWidget(context, appWidgetManager, widgetId)
    }
  }

  companion object {
    fun refreshAllWidgets(context: Context) {
      try {
        val appContext = context.applicationContext
        val manager = AppWidgetManager.getInstance(appContext)
        val component = ComponentName(appContext, LedgerSummaryWidgetProvider::class.java)
        val ids = manager.getAppWidgetIds(component)
        if (ids != null && ids.isNotEmpty()) {
          for (widgetId in ids) {
            updateSingleWidget(appContext, manager, widgetId)
          }
        }
      } catch (_: Exception) {
        // Ignore if launcher widget manager is unavailable
      }
    }

    fun requestPinWidget(context: Context): Boolean {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
        return false
      }
      val appContext = context.applicationContext
      val manager = AppWidgetManager.getInstance(appContext)
      if (!manager.isRequestPinAppWidgetSupported) {
        return false
      }
      val component = ComponentName(appContext, LedgerSummaryWidgetProvider::class.java)
      return try {
        manager.requestPinAppWidget(component, null, null)
      } catch (_: Exception) {
        false
      }
    }

    private fun updateSingleWidget(
      context: Context,
      manager: AppWidgetManager,
      appWidgetId: Int
    ) {
      val snapshot = AutoLedgerStore.getWidgetSnapshot(context)
      val views = RemoteViews(context.packageName, R.layout.widget_ledger_summary)

      views.setTextViewText(R.id.tv_widget_month, snapshot.monthLabel)
      views.setTextViewText(
        R.id.tv_widget_expense,
        "¥${AutoLedgerStore.formatCentsYuan(snapshot.totalExpenseCents)}"
      )
      views.setTextViewText(
        R.id.tv_widget_income,
        "¥${AutoLedgerStore.formatCentsYuan(snapshot.totalIncomeCents)}"
      )
      val netPrefix = if (snapshot.netCents < 0L) "-¥" else "¥"
      views.setTextViewText(
        R.id.tv_widget_net,
        "$netPrefix${AutoLedgerStore.formatCentsYuan(kotlin.math.abs(snapshot.netCents))}"
      )

      val latestLine = if (snapshot.pendingCount > 0) {
        "待确认自动记账 ${snapshot.pendingCount} 笔 · 点击查看"
      } else {
        snapshot.latestSummary
      }
      views.setTextViewText(R.id.tv_widget_latest, latestLine)

      val openAppIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        ?: Intent()
      openAppIntent.addFlags(
        Intent.FLAG_ACTIVITY_NEW_TASK or
          Intent.FLAG_ACTIVITY_SINGLE_TOP or
          Intent.FLAG_ACTIVITY_CLEAR_TOP
      )
      val openPendingIntent = PendingIntent.getActivity(
        context,
        appWidgetId * 10 + 1,
        openAppIntent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
      views.setOnClickPendingIntent(R.id.widget_root, openPendingIntent)

      val quickAddIntent = CaptureNotifier.createLaunchIntent(
        context = context,
        action = AutoLedgerStore.ACTION_QUICK_ADD,
        captureId = null
      )
      val quickAddPendingIntent = PendingIntent.getActivity(
        context,
        appWidgetId * 10 + 2,
        quickAddIntent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
      views.setOnClickPendingIntent(R.id.btn_widget_quick_add, quickAddPendingIntent)

      manager.updateAppWidget(appWidgetId, views)
    }
  }
}
