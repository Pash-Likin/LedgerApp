package expo.modules.autoledger

import android.Manifest
import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

data class CapturedRecord(
  val id: String,
  val type: String,
  val amountCents: Long,
  val merchant: String,
  val suggestedCategoryId: String,
  val suggestedCategoryName: String,
  val sourceApp: String,
  val channel: String,
  val occurredAt: String,
  val rawSummary: String,
  val status: String,
  val notificationId: Int,
  val createdAtMs: Long
) {
  fun toJsonObject(): JSONObject {
    return JSONObject().apply {
      put("id", id)
      put("type", type)
      put("amountCents", amountCents)
      put("merchant", merchant)
      put("suggestedCategoryId", suggestedCategoryId)
      put("suggestedCategoryName", suggestedCategoryName)
      put("sourceApp", sourceApp)
      put("channel", channel)
      put("occurredAt", occurredAt)
      put("rawSummary", rawSummary)
      put("status", status)
      put("notificationId", notificationId)
      put("createdAtMs", createdAtMs)
    }
  }

  companion object {
    fun fromJsonObject(obj: JSONObject): CapturedRecord {
      return CapturedRecord(
        id = obj.optString("id"),
        type = obj.optString("type", "expense"),
        amountCents = obj.optLong("amountCents", 0L),
        merchant = obj.optString("merchant", ""),
        suggestedCategoryId = obj.optString("suggestedCategoryId", "exp_other"),
        suggestedCategoryName = obj.optString("suggestedCategoryName", "其他支出"),
        sourceApp = obj.optString("sourceApp", ""),
        channel = obj.optString("channel", "notification"),
        occurredAt = obj.optString("occurredAt", ""),
        rawSummary = obj.optString("rawSummary", ""),
        status = obj.optString("status", "pending"),
        notificationId = obj.optInt("notificationId", 1001),
        createdAtMs = obj.optLong("createdAtMs", 0L)
      )
    }
  }
}

data class WidgetSnapshot(
  val monthLabel: String,
  val totalExpenseCents: Long,
  val totalIncomeCents: Long,
  val netCents: Long,
  val latestSummary: String,
  val pendingCount: Int
)

object AutoLedgerBridge {
  interface Listener {
    fun onCapturesUpdated()
    fun onLaunchActionReceived(action: String, captureId: String?)
  }

  private val mainHandler = Handler(Looper.getMainLooper())

  @Volatile
  private var listener: Listener? = null

  @Volatile
  private var pendingLaunchAction: Pair<String, String?>? = null

  fun setListener(newListener: Listener?) {
    listener = newListener
  }

  fun notifyCapturesUpdated() {
    mainHandler.post {
      listener?.onCapturesUpdated()
    }
  }

  fun postLaunchAction(action: String, captureId: String?) {
    pendingLaunchAction = action to captureId
    mainHandler.post {
      listener?.onLaunchActionReceived(action, captureId)
    }
  }

  fun consumeLaunchAction(): Pair<String, String?>? {
    val current = pendingLaunchAction
    pendingLaunchAction = null
    return current
  }
}

object AutoLedgerStore {
  const val EXTRA_ACTION = "auto_ledger_action"
  const val EXTRA_CAPTURE_ID = "auto_ledger_capture_id"
  const val ACTION_REVIEW_CAPTURE = "review_capture"
  const val ACTION_QUICK_ADD = "quick_add"
  const val BROADCAST_CONFIRM = "com.ledgerapp.autoledger.ACTION_CONFIRM_CAPTURE"
  const val BROADCAST_IGNORE = "com.ledgerapp.autoledger.ACTION_IGNORE_CAPTURE"

  private const val PREFS_NAME = "qingjizhang_auto_ledger_prefs"
  private const val KEY_CAPTURES = "captures_json"
  private const val KEY_NOTIFICATION_ENABLED = "notification_capture_enabled"
  private const val KEY_ACCESSIBILITY_ENABLED = "accessibility_capture_enabled"
  private const val KEY_WIDGET_MONTH = "widget_month_label"
  private const val KEY_WIDGET_EXPENSE = "widget_expense_cents"
  private const val KEY_WIDGET_INCOME = "widget_income_cents"
  private const val KEY_WIDGET_NET = "widget_net_cents"
  private const val KEY_WIDGET_LATEST = "widget_latest_summary"

  private val lock = Any()

  private fun prefs(context: Context) =
    context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  fun isNotificationListenerFeatureEnabled(context: Context): Boolean =
    prefs(context).getBoolean(KEY_NOTIFICATION_ENABLED, true)

  fun isAccessibilityFeatureEnabled(context: Context): Boolean =
    prefs(context).getBoolean(KEY_ACCESSIBILITY_ENABLED, true)

  fun setFeatureSettings(
    context: Context,
    notificationEnabled: Boolean,
    accessibilityEnabled: Boolean
  ) {
    prefs(context).edit()
      .putBoolean(KEY_NOTIFICATION_ENABLED, notificationEnabled)
      .putBoolean(KEY_ACCESSIBILITY_ENABLED, accessibilityEnabled)
      .apply()
  }

  fun isNotificationAccessGranted(context: Context): Boolean {
    return try {
      NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.packageName)
    } catch (_: Exception) {
      false
    }
  }

  fun isAccessibilityAccessGranted(context: Context): Boolean {
    return try {
      val enabled = Settings.Secure.getInt(
        context.contentResolver,
        Settings.Secure.ACCESSIBILITY_ENABLED,
        0
      )
      if (enabled != 1) return false
      val services = Settings.Secure.getString(
        context.contentResolver,
        Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
      ) ?: return false

      val component = ComponentName(context, AutoLedgerAccessibilityService::class.java)
      val fullName = component.flattenToString()
      val shortName = component.flattenToShortString()
      services.split(":").any {
        it.equals(fullName, ignoreCase = true) || it.equals(shortName, ignoreCase = true)
      }
    } catch (_: Exception) {
      false
    }
  }

  fun canPostNotifications(context: Context): Boolean {
    val systemEnabled = NotificationManagerCompat.from(context).areNotificationsEnabled()
    if (!systemEnabled) return false
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      ContextCompat.checkSelfPermission(
        context,
        Manifest.permission.POST_NOTIFICATIONS
      ) == PackageManager.PERMISSION_GRANTED
    } else {
      true
    }
  }

  fun isDuplicateCapture(
    context: Context,
    amountCents: Long,
    type: String,
    sourceApp: String
  ): Boolean {
    synchronized(lock) {
      val now = System.currentTimeMillis()
      val list = loadCapturesLocked(context)
      return list.any {
        it.amountCents == amountCents &&
          it.type == type &&
          it.sourceApp == sourceApp &&
          (now - it.createdAtMs) <= 20_000L
      }
    }
  }

  fun addCapture(
    context: Context,
    parsed: ParsedPayment,
    channel: String
  ): CapturedRecord {
    synchronized(lock) {
      val nowMs = System.currentTimeMillis()
      val occurredAt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).format(Date(nowMs))
      val notificationId = ((nowMs % 500_000L) + 2000L).toInt()
      val record = CapturedRecord(
        id = "cap_${nowMs}_${(100..999).random()}",
        type = parsed.type,
        amountCents = parsed.amountCents,
        merchant = parsed.merchant,
        suggestedCategoryId = parsed.suggestedCategoryId,
        suggestedCategoryName = parsed.suggestedCategoryName,
        sourceApp = parsed.sourceApp,
        channel = channel,
        occurredAt = occurredAt,
        rawSummary = parsed.rawSummary,
        status = "pending",
        notificationId = notificationId,
        createdAtMs = nowMs
      )

      val list = loadCapturesLocked(context).toMutableList()
      list.add(0, record)
      val trimmed = if (list.size > 50) list.take(50) else list
      saveCapturesLocked(context, trimmed)
      return record
    }
  }

  fun markCaptureConfirmed(context: Context, id: String): CapturedRecord? {
    synchronized(lock) {
      var updated: CapturedRecord? = null
      val next = loadCapturesLocked(context).map { rec ->
        if (rec.id == id) {
          val copy = rec.copy(status = "confirmed")
          updated = copy
          copy
        } else {
          rec
        }
      }
      if (updated != null) {
        saveCapturesLocked(context, next)
        val rec = updated!!
        // Optimistically update widget snapshot while app DB catches up on next foreground sync
        val p = prefs(context)
        val curExpense = p.getLong(KEY_WIDGET_EXPENSE, 0L)
        val curIncome = p.getLong(KEY_WIDGET_INCOME, 0L)
        val curNet = p.getLong(KEY_WIDGET_NET, 0L)
        val nextExpense = if (rec.type == "expense") curExpense + rec.amountCents else curExpense
        val nextIncome = if (rec.type == "income") curIncome + rec.amountCents else curIncome
        val nextNet = if (rec.type == "expense") curNet - rec.amountCents else curNet + rec.amountCents
        val sign = if (rec.type == "expense") "-" else "+"
        val yuan = formatCentsYuan(rec.amountCents)
        p.edit()
          .putLong(KEY_WIDGET_EXPENSE, nextExpense)
          .putLong(KEY_WIDGET_INCOME, nextIncome)
          .putLong(KEY_WIDGET_NET, nextNet)
          .putString(KEY_WIDGET_LATEST, "最近：${rec.suggestedCategoryName} ${sign}¥${yuan}")
          .apply()
      }
      return updated
    }
  }

  fun removeCapture(context: Context, id: String): CapturedRecord? {
    synchronized(lock) {
      val list = loadCapturesLocked(context)
      val target = list.firstOrNull { it.id == id }
      saveCapturesLocked(context, list.filterNot { it.id == id })
      return target
    }
  }

  fun removeCapturesByIds(context: Context, ids: List<String>) {
    if (ids.isEmpty()) return
    synchronized(lock) {
      val idSet = ids.toSet()
      val filtered = loadCapturesLocked(context).filterNot { idSet.contains(it.id) }
      saveCapturesLocked(context, filtered)
    }
  }

  fun getCapturesJson(context: Context): String {
    synchronized(lock) {
      val array = JSONArray()
      for (rec in loadCapturesLocked(context)) {
        array.put(rec.toJsonObject())
      }
      return array.toString()
    }
  }

  fun getPendingCount(context: Context): Int {
    synchronized(lock) {
      return loadCapturesLocked(context).count { it.status == "pending" }
    }
  }

  fun saveWidgetSnapshot(
    context: Context,
    monthLabel: String,
    totalExpenseCents: Long,
    totalIncomeCents: Long,
    netCents: Long,
    latestSummary: String
  ) {
    prefs(context).edit()
      .putString(KEY_WIDGET_MONTH, monthLabel)
      .putLong(KEY_WIDGET_EXPENSE, totalExpenseCents)
      .putLong(KEY_WIDGET_INCOME, totalIncomeCents)
      .putLong(KEY_WIDGET_NET, netCents)
      .putString(KEY_WIDGET_LATEST, latestSummary)
      .apply()
  }

  fun getWidgetSnapshot(context: Context): WidgetSnapshot {
    val p = prefs(context)
    val defaultMonth = SimpleDateFormat("yyyy年M月", Locale.CHINA).format(Date())
    return WidgetSnapshot(
      monthLabel = p.getString(KEY_WIDGET_MONTH, null) ?: defaultMonth,
      totalExpenseCents = p.getLong(KEY_WIDGET_EXPENSE, 0L),
      totalIncomeCents = p.getLong(KEY_WIDGET_INCOME, 0L),
      netCents = p.getLong(KEY_WIDGET_NET, 0L),
      latestSummary = p.getString(KEY_WIDGET_LATEST, null) ?: "点击右上角快速记一笔",
      pendingCount = getPendingCount(context)
    )
  }

  fun formatCentsYuan(cents: Long): String {
    val abs = kotlin.math.abs(cents)
    val whole = abs / 100
    val frac = abs % 100
    val wholeStr = String.format(Locale.US, "%,d", whole)
    val fracStr = String.format(Locale.US, "%02d", frac)
    return if (cents < 0) "-$wholeStr.$fracStr" else "$wholeStr.$fracStr"
  }

  private fun loadCapturesLocked(context: Context): List<CapturedRecord> {
    val raw = prefs(context).getString(KEY_CAPTURES, null) ?: return emptyList()
    return try {
      val array = JSONArray(raw)
      val out = mutableListOf<CapturedRecord>()
      for (i in 0 until array.length()) {
        val obj = array.optJSONObject(i) ?: continue
        out.add(CapturedRecord.fromJsonObject(obj))
      }
      out
    } catch (_: Exception) {
      emptyList()
    }
  }

  private fun saveCapturesLocked(context: Context, list: List<CapturedRecord>) {
    val array = JSONArray()
    for (item in list) {
      array.put(item.toJsonObject())
    }
    prefs(context).edit().putString(KEY_CAPTURES, array.toString()).apply()
  }
}
