import type { TransactionType } from '../types/ledger';

export interface ParsedPaymentResult {
  type: TransactionType;
  amountCents: number;
  merchant: string;
  suggestedCategoryId: string;
  suggestedCategoryName: string;
  sourceApp: string;
  rawSummary: string;
}

export interface PaymentParseOutcome {
  parsed: ParsedPaymentResult | null;
  rejectReason: string | null;
}

const HARD_NOISE_KEYWORDS = [
  '验证码',
  '校验码',
  '动态码',
  '登录密码',
  '好友申请',
  '语音通话',
  '视频通话',
  '余额不足',
  '付款失败',
  '支付失败',
  '交易失败',
  '取消订单',
  '待付款',
  '去支付',
  '立即支付',
  '确认支付',
  '去付款',
  '立即付款',
] as const;

const SOFT_PROMO_KEYWORDS = [
  '满减',
  '代金券',
  '优惠券',
  '领券',
  '红包待领取',
  '骑手已接单',
  '骑手正在赶往',
  '预计送达',
] as const;

const STRONG_COMPLETION_SIGNALS = [
  '支付成功',
  '付款成功',
  '支付完成',
  '付款完成',
  '交易成功',
  '买单成功',
  '已完成支付',
  '已支付',
  '订单已支付',
  '成功支付',
  '微信支付凭证',
  '实付',
  '实付款',
  '已扣款',
  '已收款',
  '收款成功',
  '收款到账',
  '退款成功',
  '已退回',
  '快捷支付',
  '消费人民币',
  '支出人民币',
  '入账人民币',
] as const;

const COMPLETION_HEADERS = [
  '支付成功',
  '付款成功',
  '支付完成',
  '付款完成',
  '交易成功',
  '收款成功',
  '买单成功',
  '已完成支付',
  '已支付',
  '订单已支付',
  '收款到账',
  '转账成功',
  '付款给',
  '微信支付凭证',
  '账单详情',
  '交易详情',
  '已存入零钱',
  '已收款',
] as const;

const EXPENSE_PATTERNS = [
  /付款成功/,
  /支付成功/,
  /支付完成/,
  /付款完成/,
  /已支付/,
  /成功支付/,
  /订单已支付/,
  /微信支付/,
  /支付凭证/,
  /消费/,
  /扣款/,
  /扣费/,
  /代扣/,
  /支出/,
  /转出/,
  /已向/,
  /向.{1,20}付款/,
  /付款给/,
  /付款[：:\s]*[¥￥]?\d/,
  /支付[：:\s]*[¥￥]?\d/,
  /实付/,
  /买单成功/,
  /已完成支付/,
  /交易成功/,
  /扫码付款/,
  /免密支付/,
  /自动扣费/,
  /快捷支付/,
  /支付人民币/,
  /花呗/,
  /余额宝.*(?:支出|消费|付款)/,
  /信用卡.*(?:消费|支出|扣款)/,
  /尾号\d{4}.*(?:消费|支出|扣款|支付|转出)/,
] as const;

const INCOME_KEYWORDS = [
  '收款成功',
  '收到转账',
  '已收款',
  '收款到账',
  '微信支付收款',
  '支付宝收款',
  '收款',
  '退款成功',
  '已退回',
  '退回至',
  '退款',
  '红包已存入',
  '已存入零钱',
  '入账',
  '转入',
  '到账',
  '工资到账',
  '分红',
  '返现',
] as const;

const SMS_BANK_HINTS = [
  '银行',
  '信用卡',
  '借记卡',
  '尾号',
  '账户',
  '支付宝',
  '财付通',
  '微信支付',
  '银联',
  '云闪付',
  '花呗',
] as const;

const PRIORITY_AMOUNT_REGEX =
  /(?:实付|实付款|实际支付|支付金额|付款金额|扣款金额|本次支付|消费人民币|快捷支付人民币|支出人民币|收款人民币|入账人民币|退回人民币)[：:\s]*(?:RMB|CNY|[¥￥])?\s*(\d{1,7}(?:,\d{3})*(?:\.\d{1,2})?)/g;

const GENERAL_KEYWORD_AMOUNT_REGEX =
  /(?:已支付|支付|付款|消费|扣款|扣费|支出|转出|收款|入账|转入|到账|退回|退款|金额|合计|共付|总计)[：:\s]*(?:人民币|RMB|CNY|[¥￥])?\s*(\d{1,7}(?:,\d{3})*(?:\.\d{1,2})?)/g;

const CURRENCY_AMOUNT_REGEX =
  /(?:[¥￥]|RMB|CNY)\s*(\d{1,7}(?:,\d{3})*(?:\.\d{1,2})?)|(\d{1,7}(?:,\d{3})*(?:\.\d{1,2})?)\s*元/g;

const NON_PAYMENT_PREFIX_REGEX =
  /(?:优惠|立减|已省|满减|抵扣|减免|满\d+减|余额|可用余额|当前余额|剩余|额度)[：:\s]*[¥￥]?\s*$/;

const GENERIC_PHRASES = new Set([
  '微信',
  '微信支付',
  '微信支付凭证',
  '支付宝',
  '支付宝通知',
  '交易提醒',
  '支付成功',
  '付款成功',
  '收款通知',
  '账单通知',
  '美团外卖',
  '美团',
  '银行短信',
]);

function parseAmountToCents(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/,/g, '').trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(cleaned)) return null;
  const [wholeStr, fracStr = ''] = cleaned.split('.');
  const whole = Number(wholeStr);
  const frac = Number(fracStr.padEnd(2, '0'));
  const cents = whole * 100 + frac;
  if (!Number.isFinite(cents) || cents < 1 || cents > 99_999_999) {
    return null;
  }
  return cents;
}

function isPrecededByNonPaymentPrefix(text: string, matchIndex: number): boolean {
  const start = Math.max(0, matchIndex - 10);
  const prefix = text.slice(start, matchIndex);
  return NON_PAYMENT_PREFIX_REGEX.test(prefix);
}

function extractAmountCents(text: string): number | null {
  for (const m of text.matchAll(PRIORITY_AMOUNT_REGEX)) {
    const cents = parseAmountToCents(m[1]);
    if (cents !== null) return cents;
  }

  for (const m of text.matchAll(GENERAL_KEYWORD_AMOUNT_REGEX)) {
    if (m.index !== undefined && isPrecededByNonPaymentPrefix(text, m.index)) {
      continue;
    }
    const cents = parseAmountToCents(m[1]);
    if (cents !== null) return cents;
  }

  let fallbackCents: number | null = null;
  for (const m of text.matchAll(CURRENCY_AMOUNT_REGEX)) {
    const raw = m[1] || m[2];
    const cents = parseAmountToCents(raw);
    if (cents === null) continue;
    if (m.index === undefined || !isPrecededByNonPaymentPrefix(text, m.index)) {
      return cents;
    }
    if (fallbackCents === null) {
      fallbackCents = cents;
    }
  }

  return fallbackCents;
}

function extractMerchant(sourceApp: string, title: string, combined: string): string {
  const patterns = [
    /(?:向|给)([\u4e00-\u9fa5A-Za-z0-9·()（）_-]{2,20}?)(?:付款|转账|支付|消费)/,
    /在([\u4e00-\u9fa5A-Za-z0-9·()（）_-]{2,20}?)(?:消费|付款|下单)/,
    /(?:收款方|商户|商家|付款方|商品|交易对方)[：:]\s*([\u4e00-\u9fa5A-Za-z0-9·()（）_-]{2,20})/,
    /【([\u4e00-\u9fa5A-Za-z0-9]{2,12})】/,
  ];
  for (const re of patterns) {
    const m = combined.match(re);
    const candidate = m?.[1]?.trim();
    if (candidate && !GENERIC_PHRASES.has(candidate)) {
      return candidate;
    }
  }
  const cleanTitle = title.trim();
  if (cleanTitle.length >= 2 && cleanTitle.length <= 20 && !GENERIC_PHRASES.has(cleanTitle)) {
    return cleanTitle;
  }
  return sourceApp;
}

function containsAny(text: string, keywords: readonly string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

export function suggestCategoryForPayment(
  type: TransactionType,
  sourceApp: string,
  text: string
): { categoryId: string; categoryName: string } {
  if (type === 'income') {
    if (text.includes('工资') || text.includes('薪资')) {
      return { categoryId: 'inc_salary', categoryName: '工资' };
    }
    if (text.includes('奖金') || text.includes('绩效')) {
      return { categoryId: 'inc_bonus', categoryName: '奖金' };
    }
    if (text.includes('兼职') || text.includes('劳务')) {
      return { categoryId: 'inc_parttime', categoryName: '兼职' };
    }
    if (
      text.includes('理财') ||
      text.includes('基金') ||
      text.includes('分红') ||
      text.includes('利息')
    ) {
      return { categoryId: 'inc_invest', categoryName: '理财' };
    }
    if (text.includes('红包')) {
      return { categoryId: 'inc_redpacket', categoryName: '红包' };
    }
    return { categoryId: 'inc_other', categoryName: '其他收入' };
  }

  if (
    sourceApp === '美团外卖' ||
    sourceApp === '饿了么' ||
    containsAny(text, [
      '美团外卖',
      '饿了么',
      '瑞幸',
      '星巴克',
      '霸王茶姬',
      '喜茶',
      '奈雪',
      '蜜雪',
      '肯德基',
      '麦当劳',
      '餐厅',
      '餐饮',
      '饭',
      '面',
      '粉',
      '火锅',
      '烧烤',
      '奶茶',
      '咖啡',
      '早餐',
      '午餐',
      '晚餐',
      '小吃',
      '外卖',
      '烘焙',
      '面包',
      '蛋糕',
    ])
  ) {
    return { categoryId: 'exp_food', categoryName: '餐饮' };
  }

  if (
    sourceApp === '滴滴出行' ||
    containsAny(text, [
      '滴滴',
      '高德',
      '打车',
      '出租车',
      '地铁',
      '公交',
      '乘车码',
      '高铁',
      '铁路',
      '12306',
      '机票',
      '航司',
      '加油',
      '充电',
      '停车',
      '高速',
      'ETC',
      '单车',
      '哈啰',
      '青桔',
    ])
  ) {
    return { categoryId: 'exp_transport', categoryName: '交通' };
  }

  if (
    containsAny(text, [
      '淘宝',
      '天猫',
      '京东',
      '拼多多',
      '唯品会',
      '得物',
      '服饰',
      '鞋',
      '数码',
      '百货',
      '旗舰店',
      '商城',
    ])
  ) {
    return { categoryId: 'exp_shopping', categoryName: '购物' };
  }

  if (
    containsAny(text, [
      '超市',
      '便利店',
      '盒马',
      '沃尔玛',
      '永辉',
      '山姆',
      '罗森',
      '711',
      '全家',
      '屈臣氏',
      '日用',
      '生活用品',
      '快递',
      '菜鸟',
      '顺丰',
    ])
  ) {
    return { categoryId: 'exp_daily', categoryName: '日用' };
  }

  if (
    containsAny(text, [
      '房租',
      '物业',
      '水费',
      '电费',
      '燃气',
      '宽带',
      '话费',
      '中国移动',
      '中国联通',
      '中国电信',
    ])
  ) {
    return { categoryId: 'exp_housing', categoryName: '居住' };
  }

  if (
    containsAny(text, [
      '电影',
      '猫眼',
      '淘票票',
      '网易云',
      'QQ音乐',
      '爱奇艺',
      '腾讯视频',
      '哔哩哔哩',
      '游戏',
      'Steam',
      'KTV',
    ])
  ) {
    return { categoryId: 'exp_entertainment', categoryName: '娱乐' };
  }

  if (
    containsAny(text, ['医院', '药房', '药店', '诊所', '挂号', '体检', '牙科', '医疗'])
  ) {
    return { categoryId: 'exp_medical', categoryName: '医疗' };
  }

  if (
    containsAny(text, ['书店', '课程', '考试', '学费', '培训', '文具', '教育'])
  ) {
    return { categoryId: 'exp_education', categoryName: '学习' };
  }

  if (containsAny(text, ['转账', '亲友', '礼金', '发红包', '聚会'])) {
    return { categoryId: 'exp_social', categoryName: '社交' };
  }

  return { categoryId: 'exp_other', categoryName: '其他支出' };
}

export function parsePaymentWithReason(options: {
  sourceApp: string;
  title?: string;
  content: string;
  requireCompletionHeader?: boolean;
  isSms?: boolean;
}): PaymentParseOutcome {
  const title = options.title?.trim() ?? '';
  const content = options.content.trim();
  const combined = [title, content]
    .filter((s) => s.length > 0)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (combined.length < 4) {
    return { parsed: null, rejectReason: '内容过短' };
  }

  const hardNoise = HARD_NOISE_KEYWORDS.find((kw) => combined.includes(kw));
  if (hardNoise) {
    return { parsed: null, rejectReason: `过滤干扰词：${hardNoise}` };
  }

  if (options.isSms && !SMS_BANK_HINTS.some((kw) => combined.includes(kw))) {
    return { parsed: null, rejectReason: '非银行/支付短信' };
  }

  const hasStrongCompletion = STRONG_COMPLETION_SIGNALS.some((kw) =>
    combined.includes(kw)
  );
  const softPromo = SOFT_PROMO_KEYWORDS.find((kw) => combined.includes(kw));
  if (softPromo && !hasStrongCompletion) {
    return { parsed: null, rejectReason: `过滤营销/配送文案：${softPromo}` };
  }

  if (
    options.requireCompletionHeader &&
    !COMPLETION_HEADERS.some((kw) => combined.includes(kw))
  ) {
    return { parsed: null, rejectReason: '未出现支付完成页标志' };
  }

  const isIncome = INCOME_KEYWORDS.some((kw) => combined.includes(kw));
  const isExpense = EXPENSE_PATTERNS.some((re) => re.test(combined));
  if (!isIncome && !isExpense) {
    return { parsed: null, rejectReason: '未检测到收支关键词' };
  }

  const type: TransactionType = isIncome ? 'income' : 'expense';
  const amountCents = extractAmountCents(combined);
  if (amountCents === null) {
    return { parsed: null, rejectReason: '未匹配到有效金额' };
  }

  const merchant = extractMerchant(options.sourceApp, title, combined);
  const { categoryId, categoryName } = suggestCategoryForPayment(
    type,
    options.sourceApp,
    `${merchant} ${combined}`
  );

  const rawSummary =
    combined.length > 100 ? `${combined.slice(0, 100)}…` : combined;

  return {
    parsed: {
      type,
      amountCents,
      merchant,
      suggestedCategoryId: categoryId,
      suggestedCategoryName: categoryName,
      sourceApp: options.sourceApp,
      rawSummary,
    },
    rejectReason: null,
  };
}

export function parsePaymentNotificationText(options: {
  sourceApp: string;
  title?: string;
  content: string;
  requireCompletionHeader?: boolean;
  isSms?: boolean;
}): ParsedPaymentResult | null {
  return parsePaymentWithReason(options).parsed;
}
