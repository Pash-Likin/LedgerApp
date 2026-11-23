package expo.modules.autoledger

import java.math.BigDecimal

data class ParsedPayment(
  val type: String,
  val amountCents: Long,
  val merchant: String,
  val suggestedCategoryId: String,
  val suggestedCategoryName: String,
  val sourceApp: String,
  val rawSummary: String
)

object PaymentTextParser {
  val MONITORED_PACKAGES: Map<String, String> = mapOf(
    "com.tencent.mm" to "微信",
    "com.eg.android.AlipayGphone" to "支付宝",
    "com.sankuai.meituan" to "美团",
    "com.sankuai.meituan.takeoutnew" to "美团外卖",
    "com.unionpay" to "云闪付",
    "com.jingdong.app.mall" to "京东",
    "com.xunmeng.pinduoduo" to "拼多多",
    "com.ss.android.ugc.aweme" to "抖音"
  )

  private val NOISE_KEYWORDS = listOf(
    "验证码",
    "登录",
    "满减",
    "代金券",
    "优惠券",
    "领券",
    "红包待领取",
    "骑手已接单",
    "骑手正在赶往",
    "预计送达",
    "好友申请",
    "语音通话",
    "视频通话",
    "余额不足",
    "付款失败",
    "支付失败",
    "取消订单"
  )

  private val COMPLETION_HEADERS = listOf(
    "支付成功",
    "付款成功",
    "交易成功",
    "收款成功",
    "买单成功",
    "已完成支付",
    "收款到账",
    "付款给",
    "账单详情"
  )

  private val EXPENSE_SIGNALS = listOf(
    "付款成功",
    "支付成功",
    "消费",
    "扣款",
    "已向",
    "向.*付款",
    "付款给",
    "实付",
    "买单成功",
    "已完成支付",
    "交易成功",
    "扫码付款",
    "免密支付",
    "自动扣费",
    "支付人民币"
  )

  private val INCOME_SIGNALS = listOf(
    "收款成功",
    "收到转账",
    "已收款",
    "收款到账",
    "微信支付收款",
    "支付宝收款",
    "退款成功",
    "已退回",
    "退回至",
    "红包已存入",
    "入账",
    "工资到账",
    "分红"
  )

  private val KEYWORD_AMOUNT_REGEX = Regex(
    "(?:实付|实付款|支付|付款|消费|扣款|收款|入账|退回|退款|金额|合计|共付|总计)[：:\\s]*[¥￥]?\\s*(\\d{1,7}(?:,\\d{3})*(?:\\.\\d{1,2})?)"
  )

  private val CURRENCY_AMOUNT_REGEX = Regex(
    "(?:[¥￥]|RMB\\s*|CNY\\s*)(\\d{1,7}(?:,\\d{3})*(?:\\.\\d{1,2})?)|(\\d{1,7}(?:,\\d{3})*(?:\\.\\d{1,2})?)\\s*元"
  )

  fun isMonitoredPackage(packageName: String?): Boolean {
    return packageName != null && MONITORED_PACKAGES.containsKey(packageName)
  }

  fun getSourceAppName(packageName: String?): String {
    return MONITORED_PACKAGES[packageName] ?: "未知应用"
  }

  fun parse(
    sourceApp: String,
    title: String,
    content: String,
    requireCompletionHeader: Boolean
  ): ParsedPayment? {
    val combined = listOf(title.trim(), content.trim())
      .filter { it.isNotEmpty() }
      .joinToString(" ")
      .replace(Regex("\\s+"), " ")
      .trim()

    if (combined.length < 4) return null

    if (NOISE_KEYWORDS.any { combined.contains(it) }) {
      return null
    }

    if (requireCompletionHeader && COMPLETION_HEADERS.none { combined.contains(it) }) {
      return null
    }

    val isIncome = INCOME_SIGNALS.any { combined.contains(it) }
    val isExpense = EXPENSE_SIGNALS.any { Regex(it).containsMatchIn(combined) }

    if (!isIncome && !isExpense) {
      return null
    }

    // Refund / incoming payment takes precedence over generic "交易成功" / "支付" words
    val type = if (isIncome) "income" else "expense"
    val amountCents = extractAmountCents(combined) ?: return null
    val merchant = extractMerchant(sourceApp, title, combined)
    val (categoryId, categoryName) = suggestCategory(type, sourceApp, "$merchant $combined")

    val rawSummary = if (combined.length > 100) combined.take(100) + "…" else combined
    return ParsedPayment(
      type = type,
      amountCents = amountCents,
      merchant = merchant,
      suggestedCategoryId = categoryId,
      suggestedCategoryName = categoryName,
      sourceApp = sourceApp,
      rawSummary = rawSummary
    )
  }

  private fun extractAmountCents(text: String): Long? {
    val keywordMatch = KEYWORD_AMOUNT_REGEX.find(text)
    if (keywordMatch != null) {
      val candidate = keywordMatch.groupValues.getOrNull(1)
      val cents = parseAmountStringToCents(candidate)
      if (cents != null) return cents
    }

    val currencyMatch = CURRENCY_AMOUNT_REGEX.find(text)
    if (currencyMatch != null) {
      val candidate = currencyMatch.groupValues[1].ifEmpty { currencyMatch.groupValues[2] }
      val cents = parseAmountStringToCents(candidate)
      if (cents != null) return cents
    }

    return null
  }

  private fun parseAmountStringToCents(raw: String?): Long? {
    if (raw.isNullOrBlank()) return null
    val cleaned = raw.replace(",", "").trim()
    return try {
      val bd = BigDecimal(cleaned).multiply(BigDecimal(100))
      val cents = bd.toLong()
      if (cents in 1L..99_999_999L) cents else null
    } catch (_: Exception) {
      null
    }
  }

  private fun extractMerchant(sourceApp: String, title: String, combined: String): String {
    val patterns = listOf(
      Regex("(?:向|给)([\\u4e00-\\u9fa5A-Za-z0-9·()（）_-]{2,20}?)(?:付款|转账|支付|消费)"),
      Regex("在([\\u4e00-\\u9fa5A-Za-z0-9·()（）_-]{2,20}?)(?:消费|付款|下单)"),
      Regex("(?:收款方|商户|商家|付款方|商品)[：:]\\s*([\\u4e00-\\u9fa5A-Za-z0-9·()（）_-]{2,20})")
    )
    for (pattern in patterns) {
      val match = pattern.find(combined)
      val candidate = match?.groupValues?.getOrNull(1)?.trim()
      if (!candidate.isNullOrEmpty() && !isGenericPhrase(candidate)) {
        return candidate
      }
    }

    val cleanTitle = title.trim()
    if (cleanTitle.length in 2..20 && !isGenericPhrase(cleanTitle)) {
      return cleanTitle
    }
    return sourceApp
  }

  private fun isGenericPhrase(text: String): Boolean {
    val generic = listOf("微信支付", "支付宝", "支付成功", "付款成功", "收款通知", "账单通知", "美团外卖", "美团")
    return generic.any { text == it }
  }

  private fun suggestCategory(
    type: String,
    sourceApp: String,
    text: String
  ): Pair<String, String> {
    if (type == "income") {
      return when {
        text.contains("工资") || text.contains("薪资") -> "inc_salary" to "工资"
        text.contains("奖金") || text.contains("绩效") -> "inc_bonus" to "奖金"
        text.contains("兼职") || text.contains("劳务") -> "inc_parttime" to "兼职"
        text.contains("理财") || text.contains("基金") || text.contains("分红") || text.contains("利息") -> "inc_invest" to "理财"
        text.contains("红包") -> "inc_redpacket" to "红包"
        else -> "inc_other" to "其他收入"
      }
    }

    return when {
      sourceApp == "美团外卖" || containsAny(
        text,
        listOf("美团外卖", "饿了么", "瑞幸", "星巴克", "喜茶", "奈雪", "肯德基", "麦当劳", "餐厅", "餐饮", "饭", "面", "火锅", "烧烤", "奶茶", "咖啡", "早餐", "午餐", "晚餐", "小吃", "外卖")
      ) -> "exp_food" to "餐饮"

      containsAny(
        text,
        listOf("滴滴", "高德", "打车", "出租车", "地铁", "公交", "高铁", "铁路", "12306", "机票", "航司", "加油", "停车", "高速", "ETC", "单车", "哈啰", "青桔")
      ) -> "exp_transport" to "交通"

      containsAny(
        text,
        listOf("淘宝", "天猫", "京东", "拼多多", "唯品会", "服饰", "鞋", "数码", "百货", "旗舰店", "商城")
      ) -> "exp_shopping" to "购物"

      containsAny(
        text,
        listOf("超市", "便利店", "盒马", "沃尔玛", "永辉", "罗森", "711", "全家", "日用", "生活用品", "快递", "菜鸟", "顺丰")
      ) -> "exp_daily" to "日用"

      containsAny(
        text,
        listOf("房租", "物业", "水费", "电费", "燃气", "宽带", "话费", "中国移动", "中国联通", "中国电信")
      ) -> "exp_housing" to "居住"

      containsAny(
        text,
        listOf("电影", "猫眼", "淘票票", "网易云", "QQ音乐", "爱奇艺", "腾讯视频", "哔哩哔哩", "游戏", "Steam", "KTV")
      ) -> "exp_entertainment" to "娱乐"

      containsAny(
        text,
        listOf("医院", "药房", "药店", "诊所", "挂号", "体检", "牙科", "医疗")
      ) -> "exp_medical" to "医疗"

      containsAny(
        text,
        listOf("书店", "课程", "考试", "学费", "培训", "文具", "教育")
      ) -> "exp_education" to "学习"

      containsAny(
        text,
        listOf("转账", "亲友", "礼金", "发红包", "聚会")
      ) -> "exp_social" to "社交"

      else -> "exp_other" to "其他支出"
    }
  }

  private fun containsAny(text: String, keywords: List<String>): Boolean {
    return keywords.any { text.contains(it, ignoreCase = true) }
  }
}
