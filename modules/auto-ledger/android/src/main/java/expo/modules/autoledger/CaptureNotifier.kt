package expo.modules.autoledger

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

object CaptureNotifier {
  private const val CHANNEL_CAPTURE_VIBRATE = "auto_ledger_capture_v1"
  private const val CHANNEL_CAPTURE_QUIET = "auto_ledger_capture_quiet_v1"
  private const val CHANNEL_FEEDBACK = "auto_ledger_feedback_v1"

  fun ensureChannels(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
      ?: return

    val vibrateChannel = NotificationChannel(
      CHANNEL_CAPTURE_VIBRATE,
      "自动记账提醒（含震动）",
      NotificationManager.IMPORTANCE_HIGH
    ).apply {
      description = "识别到微信、支付宝、美团等收支通知时，弹窗询问是否记账及类型"
      enableVibration(true)
    }

    val quietChannel = NotificationChannel(
      CHANNEL_CAPTURE_QUIET,
      "自动记账提醒（静音无震动）",
      NotificationManager.IMPORTANCE_HIGH
    ).apply {
      description = "识别到收支时弹出横幅提醒，但不触发手机震动"
      enableVibration(false)
      vibrationPattern = null
    }

    val feedbackChannel = NotificationChannel(
      CHANNEL_FEEDBACK,
      "记账完成提示",
      NotificationManager.IMPORTANCE_LOW
    ).apply {
      description = "在通知栏一键确认记账后的简短回执"
      setSound(null, null)
      enableVibration(false)
    }

    manager.createNotificationChannel(vibrateChannel)
    manager.createNotificationChannel(quietChannel)
    manager.createNotificationChannel(feedbackChannel)
  }

  fun showCaptureNotification(context: Context, record: CapturedRecord) {
    ensureChannels(context)
    if (!AutoLedgerStore.canPostNotifications(context)) {
      return
    }

    val vibrateEnabled = AutoLedgerStore.isHapticsEnabled(context)
    val channelId = if (vibrateEnabled) CHANNEL_CAPTURE_VIBRATE else CHANNEL_CAPTURE_QUIET

    val typeLabel = if (record.type == "income") "收入" else "支出"
    val yuan = AutoLedgerStore.formatCentsYuan(record.amountCents)
    val title = "检测到${typeLabel} ¥${yuan} · ${record.merchant}"
    val body = "来源：${record.sourceApp} · 推荐分类「${record.suggestedCategoryName}」，是否记账？"

    val reviewIntent = createLaunchIntent(
      context = context,
      action = AutoLedgerStore.ACTION_REVIEW_CAPTURE,
      captureId = record.id
    )
    val reviewPendingIntent = PendingIntent.getActivity(
      context,
      record.notificationId * 10 + 2,
      reviewIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val confirmIntent = Intent(context, CaptureActionReceiver::class.java).apply {
      action = AutoLedgerStore.BROADCAST_CONFIRM
      putExtra(AutoLedgerStore.EXTRA_CAPTURE_ID, record.id)
    }
    val confirmPendingIntent = PendingIntent.getBroadcast(
      context,
      record.notificationId * 10 + 1,
      confirmIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val ignoreIntent = Intent(context, CaptureActionReceiver::class.java).apply {
      action = AutoLedgerStore.BROADCAST_IGNORE
      putExtra(AutoLedgerStore.EXTRA_CAPTURE_ID, record.id)
    }
    val ignorePendingIntent = PendingIntent.getBroadcast(
      context,
      record.notificationId * 10 + 3,
      ignoreIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val builder = NotificationCompat.Builder(context, channelId)
      .setSmallIcon(R.drawable.ic_ledger_notify)
      .setContentTitle(title)
      .setContentText(body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(body))
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setCategory(NotificationCompat.CATEGORY_REMINDER)
      .setAutoCancel(false)
      .setContentIntent(reviewPendingIntent)
      .addAction(0, "记为「${record.suggestedCategoryName}」", confirmPendingIntent)
      .addAction(0, "选分类", reviewPendingIntent)
      .addAction(0, "忽略", ignorePendingIntent)

    if (!vibrateEnabled) {
      builder.setVibrate(longArrayOf(0L))
    }

    try {
      NotificationManagerCompat.from(context).notify(record.notificationId, builder.build())
    } catch (_: SecurityException) {
      // Permission revoked concurrently
    }
  }

  fun showConfirmedFeedback(context: Context, record: CapturedRecord) {
    ensureChannels(context)
    if (!AutoLedgerStore.canPostNotifications(context)) return

    val yuan = AutoLedgerStore.formatCentsYuan(record.amountCents)
    val typeLabel = if (record.type == "income") "收入" else "支出"

    val notification = NotificationCompat.Builder(context, CHANNEL_FEEDBACK)
      .setSmallIcon(R.drawable.ic_ledger_notify)
      .setContentTitle("已自动记账（$typeLabel）")
      .setContentText("${record.suggestedCategoryName} ¥$yuan · ${record.merchant}")
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setSilent(true)
      .setAutoCancel(true)
      .setTimeoutAfter(3500L)
      .build()

    try {
      NotificationManagerCompat.from(context).notify(record.notificationId + 100_000, notification)
    } catch (_: SecurityException) {
      // Ignore
    }
  }

  fun cancelNotification(context: Context, notificationId: Int) {
    NotificationManagerCompat.from(context).cancel(notificationId)
  }

  fun createLaunchIntent(context: Context, action: String, captureId: String?): Intent {
    val base = context.packageManager.getLaunchIntentForPackage(context.packageName)
      ?: Intent()
    base.addFlags(
      Intent.FLAG_ACTIVITY_NEW_TASK or
        Intent.FLAG_ACTIVITY_SINGLE_TOP or
        Intent.FLAG_ACTIVITY_CLEAR_TOP
    )
    base.putExtra(AutoLedgerStore.EXTRA_ACTION, action)
    if (captureId != null) {
      base.putExtra(AutoLedgerStore.EXTRA_CAPTURE_ID, captureId)
    }
    return base
  }
}
