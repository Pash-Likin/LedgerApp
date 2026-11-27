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

data class ParseOutcome(
  val parsed: ParsedPayment?,
  val rejectReason: String?
)

object PaymentTextParser {
  val SMS_PACKAGES: Set<String> = setOf(
    "com.android.mms",
    "com.google.android.apps.messaging",
    "com.samsung.android.messaging",
    "com.hihonor.mms",
    "com.huawei.mms",
    "com.vivo.message",
    "com.oppo.mms",
    "com.miui.mms",
    "com.oneplus.mms"
  )

  val MONITORED_PACKAGES: Map<String, String> = mapOf(
    "com.tencent.mm" to "微信",
    "com.eg.android.AlipayGphone" to "支付宝",
    "com.sankuai.meituan" to "美团",
    "com.sankuai.meituan.takeoutnew" to "美团外卖",
    "com.dianping.v1" to "大众点评",
    "me.ele" to "饿了么",
    "com.taobao.taobao" to "淘宝",
    "com.tmall.wireless" to "天猫",
    "com.jingdong.app.mall" to "京东",
    "com.xunmeng.pinduoduo" to "拼多多",
    "com.ss.android.ugc.aweme" to "抖音",
    "com.unionpay" to "云闪付",
    "com.sdu.didi.psnger" to "滴滴出行",
    "com.didiglobal.passenger" to "滴滴出行",
    "com.icbc" to "工商银行",
    "com.chinamworld.main" to "建设银行",
    "cmb.pb" to "招商银行",
    "com.android.bankabc" to "农业银行",
    "com.chinamworld.bocmbci" to "中国银行",
    "com.bankcomm.Bankcomm" to "交通银行",
    "com.pingan.paces.ccms" to "平安银行",
    "com.android.mms" to "银行短信",
    "com.google.android.apps.messaging" to "银行短信",
    "com.samsung.android.messaging" to "银行短信",
    "com.hihonor.mms" to "银行短信",
    "com.huawei.mms" to "银行短信",
    "com.vivo.message" to "银行短信",
    "com.oppo.mms" to "银行短信",
    "com.miui.mms" to "银行短信",
    "com.oneplus.mms" to "银行短信"
  )

  private val HARD_NOISE_KEYWORDS = listOf(
    "验证码",
    "校验码",
    "动态码",
    "登录密码",
    "好友申请",
    "语音通话",
    "视频通话",
    "余额不足",
    "付款失败",
    "支付失败",
    "交易失败",
    "取消订单",
    "待付款",
    "去支付",
    "立即支付",
    "确认支付",
    "去付款",
    "立即付款"
  )

  private val SOFT_PROMO_KEYWORDS = listOf(
    "满减",
    "代金券",
    "优惠券",
    "领券",
    "红包待领取",
    "骑手已接单",
    "骑手正在赶往",
    "预计送达"
  )

  private val STRONG_COMPLETION_SIGNALS = listOf(
    "支付成功",
    "付款成功",
    "支付完成",
    "付款完成",
    "交易成功",
    "买单成功",
    "已完成支付",
    "已支付",
    "订单已支付",
    "成功支付",
    "微信支付凭证",
    "实付",
    "实付款",
    "已扣款",
    "已收款",
    "收款成功",
    "收款到账",
    "退款成功",
    "已退回",
    "快捷支付",
    "消费人民币",
    "支出人民币",
    "入账人民币"
  )

  private val COMPLETION_HEADERS = listOf(
    "支付成功",
    "付款成功",
    "支付完成",
    "付款完成",
    "交易成功",
    "收款成功",
    "买单成功",
    "已完成支付",
    "已支付",
    "订单已支付",
    "收款到账",
    "转账成功",
    "付款给",
    "微信支付凭证",
    "账单详情",
    "交易详情",
    "已存入零钱",
    "已收款"
  )

  private val EXPENSE_PATTERNS = listOf(
    Regex("付款成功"),
    Regex("支付成功"),
    Regex("支付完成"),
    Regex("付款完成"),
    Regex("已支付"),
    Regex("成功支付"),
    Regex("订单已支付"),
    Regex("微信支付"),
    Regex("支付凭证"),
    Regex("消费"),
    Regex("扣款"),
    Regex("扣费"),
    Regex("代扣"),
    Regex("支出"),
    Regex("转出"),
    Regex("已向"),
    Regex("向.{1,20}付款"),
    Regex("付款给"),
    Regex("付款[：:\\s]*[¥￥]?\\d"),
    Regex("支付[：:\\s]*[¥￥]?\\d"),
    Regex("实付"),
    Regex("买单成功"),
    Regex("已完成支付"),
    Regex("交易成功"),
    Regex("扫码付款"),
    Regex("免密支付"),
    Regex("自动扣费"),
    Regex("快捷支付"),
    Regex("支付人民币"),
    Regex("花呗"),
    Regex("余额宝.*(?:支出|消费|付款)"),
    Regex("信用卡.*(?:消费|支出|扣款)"),
    Regex("尾号\\d{4}.*(?:消费|支出|扣款|支付|转出)")
  )

  private val INCOME_SIGNALS = listOf(
    "收款成功",
    "收到转账",
    "已收款",
    "收款到账",
    "微信支付收款",
    "支付宝收款",
    "收款",
    "退款成功",
    "已退回",
    "退回至",
    "退款",
    "红包已存入",
    "已存入零钱",
    "入账",
    "转入",
    "到账",
    "工资到账",
    "分红",
    "返现"
  )

  private val SMS_BANK_HINTS = listOf(
    "银行",
    "信用卡",
    "借记卡",
    "尾号",
    "账户",
    "支付宝",
    "财付通",
    "微信支付",
    "银联",
    "云闪付",
    "花呗"
  )

  private val PRIORITY_AMOUNT_REGEX = Regex(
    "(?:实付|实付款|实际支付|支付金额|付款金额|扣款金额|本次支付|消费人民币|快捷支付人民币|支出人民币|收款人民币|入账人民币|退回人民币)[：:\\s]*(?:RMB|CNY|[¥￥])?\\s*(\\d{1,7}(?:,\\d{3})*(?:\\.\\d{1,2})?)"
  )

  private val GENERAL_KEYWORD_AMOUNT_REGEX = Regex(
    "(?:已支付|支付|付款|消费|扣款|扣费|支出|转出|收款|入账|转入|到账|退回|退款|金额|合计|共付|总计)[：:\\s]*(?:人民币|RMB|CNY|[¥￥])?\\s*(\\d{1,7}(?:,\\d{3})*(?:\\.\\d{1,2})?)"
  )

  private val CURRENCY_AMOUNT_REGEX = Regex(
    "(?:[¥￥]|RMB|CNY)\\s*(\\d{1,7}(?:,\\d{3})*(?:\\.\\d{1,2})?)|(\\d{1,7}(?:,\\d{3})*(?:\\.\\d{1,2})?)\\s*元"
  )

  private val NON_PAYMENT_PREFIX_REGEX = Regex(
    "(?:优惠|立减|已省|满减|抵扣|减免|满\\d+减|余额|可用余额|当前余额|剩余|额度)[：:\\s]*[¥￥]?\\s*$"
  )

  fun isMonitoredPackage(packageName: String?): Boolean {
    return packageName != null && MONITORED_PACKAGES.containsKey(packageName)
  }

  fun isSmsPackage(packageName: String?): Boolean {
    return packageName != null && SMS_PACKAGES.contains(packageName)
  }

  fun getSourceAppName(packageName: String?): String {
    return MONITORED_PACKAGES[packageName] ?: "未知应用"
  }

  fun hasCompletionOrCurrencyHint(text: String): Boolean {
    return COMPLETION_HEADERS.any { text.contains(it) } ||
      text.contains("¥") ||
      text.contains("￥") ||
      text.contains("元")
  }

  fun parse(
    sourceApp: String,
    title: String,
    content: String,
    requireCompletionHeader: Boolean,
    isSms: Boolean = false
  ): ParsedPayment? {
    return parseWithReason(
      sourceApp = sourceApp,
      title = title,
      content = content,
      requireCompletionHeader = requireCompletionHeader,
      isSms = isSms
    ).parsed
  }

  fun parseWithReason(
    sourceApp: String,
    title: String,
    content: String,
    requireCompletionHeader: Boolean,
    isSms: Boolean = false
  ): ParseOutcome {
    val combined = listOf(title.trim(), content.trim())
      .filter { it.isNotEmpty() }
      .joinToString(" ")
      .replace(Regex("\\s+"), " ")
      .trim()

    if (combined.length < 4) {
      return ParseOutcome(null, "内容过短")
    }

    val matchedHardNoise = HARD_NOISE_KEYWORDS.firstOrNull { combined.contains(it) }
    if (matchedHardNoise != null) {
      return ParseOutcome(null, "过滤干扰词：$matchedHardNoise")
    }

    if (isSms && SMS_BANK_HINTS.none { combined.contains(it) }) {
      return ParseOutcome(null, "非银行/支付短信")
    }

    val hasStrongCompletion = STRONG_COMPLETION_SIGNALS.any { combined.contains(it) }
    val matchedSoftPromo = SOFT_PROMO_KEYWORDS.firstOrNull { combined.contains(it) }
    if (matchedSoftPromo != null && !hasStrongCompletion) {
      return ParseOutcome(null, "过滤营销/配送文案：$matchedSoftPromo")
    }

    if (requireCompletionHeader && COMPLETION_HEADERS.none { combined.contains(it) }) {
      return ParseOutcome(null, "未出现支付完成页标志")
    }

    val isIncome = INCOME_SIGNALS.any { combined.contains(it) }
    val isExpense = EXPENSE_PATTERNS.any { it.containsMatchIn(combined) }

    if (!isIncome && !isExpense) {
      return ParseOutcome(null, "未检测到收支关键词")
    }

    // Refund / incoming payment takes precedence over generic "交易成功" / "支付" words
    val type = if (isIncome) "income" else "expense"
    val amountCents = extractAmountCents(combined)
      ?: return ParseOutcome(null, "未匹配到有效金额")

    val merchant = extractMerchant(sourceApp, title, combined)
    val (categoryId, categoryName) = suggestCategory(type, sourceApp, "$merchant $combined")

    val rawSummary = if (combined.length > 100) combined.take(100) + "…" else combined
    val parsed = ParsedPayment(
      type = type,
      amountCents = amountCents,
      merchant = merchant,
      suggestedCategoryId = categoryId,
      suggestedCategoryName = categoryName,
      sourceApp = sourceApp,
      rawSummary = rawSummary
    )
    return ParseOutcome(parsed, null)
  }

  private fun isPrecededByNonPaymentPrefix(text: String, matchStart: Int): Boolean {
    val windowStart = (matchStart - 10).coerceAtLeast(0)
    val prefix = text.substring(windowStart, matchStart)
    return NON_PAYMENT_PREFIX_REGEX.containsMatchIn(prefix)
  }

  private fun extractAmountCents(text: String): Long? {
    // 1. Priority paid-amount keywords (e.g. 实付, 快捷支付人民币)
    for (m in PRIORITY_AMOUNT_REGEX.findAll(text)) {
      val cents = parseAmountStringToCents(m.groupValues.getOrNull(1))
      if (cents != null) return cents
    }

    // 2. General payment keywords, skipping discount/balance amounts
    for (m in GENERAL_KEYWORD_AMOUNT_REGEX.findAll(text)) {
      if (isPrecededByNonPaymentPrefix(text, m.range.first)) continue
      val cents = parseAmountStringToCents(m.groupValues.getOrNull(1))
      if (cents != null) return cents
    }

    // 3. Currency symbol / 元 matches, preferring non-discount / non-balance amounts
    var fallbackCents: Long? = null
    for (m in CURRENCY_AMOUNT_REGEX.findAll(text)) {
      val candidate = m.groupValues[1].ifEmpty { m.groupValues[2] }
      val cents = parseAmountStringToCents(candidate) ?: continue
      if (!isPrecededByNonPaymentPrefix(text, m.range.first)) {
        return cents
      }
      if (fallbackCents == null) {
        fallbackCents = cents
      }
    }

    return fallbackCents
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
      Regex("(?:收款方|商户|商家|付款方|商品|交易对方)[：:]\\s*([\\u4e00-\\u9fa5A-Za-z0-9·()（）_-]{2,20})"),
      Regex("【([\\u4e00-\\u9fa5A-Za-z0-9]{2,12})】")
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
    val generic = listOf(
      "微信",
      "微信支付",
      "微信支付凭证",
      "支付宝",
      "支付宝通知",
      "交易提醒",
      "支付成功",
      "付款成功",
      "收款通知",
      "账单通知",
      "美团外卖",
      "美团",
      "银行短信"
    )
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
      sourceApp == "美团外卖" || sourceApp == "饿了么" || containsAny(
        text,
        listOf("美团外卖", "饿了么", "瑞幸", "星巴克", "霸王茶姬", "喜茶", "奈雪", "蜜雪", "肯德基", "麦当劳", "餐厅", "餐饮", "饭", "面", "粉", "火锅", "烧烤", "奶茶", "咖啡", "早餐", "午餐", "晚餐", "小吃", "外卖", "烘焙", "面包", "蛋糕")
      ) -> "exp_food" to "餐饮"

      sourceApp == "滴滴出行" || containsAny(
        text,
        listOf("滴滴", "高德", "打车", "出租车", "地铁", "公交", "乘车码", "高铁", "铁路", "12306", "机票", "航司", "加油", "充电", "停车", "高速", "ETC", "单车", "哈啰", "青桔")
      ) -> "exp_transport" to "交通"

      containsAny(
        text,
        listOf("淘宝", "天猫", "京东", "拼多多", "唯品会", "得物", "服饰", "鞋", "数码", "百货", "旗舰店", "商城")
      ) -> "exp_shopping" to "购物"

      containsAny(
        text,
        listOf("超市", "便利店", "盒马", "沃尔玛", "永辉", "山姆", "罗森", "711", "全家", "屈臣氏", "日用", "生活用品", "快递", "菜鸟", "顺丰")
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
