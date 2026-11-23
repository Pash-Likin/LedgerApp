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

const NOISE_KEYWORDS = [
  '验证码',
  '登录',
  '满减',
  '代金券',
  '优惠券',
  '领券',
  '红包待领取',
  '骑手已接单',
  '骑手正在赶往',
  '预计送达',
  '好友申请',
  '语音通话',
  '视频通话',
  '余额不足',
  '付款失败',
  '支付失败',
  '取消订单',
] as const;

const COMPLETION_HEADERS = [
  '支付成功',
  '付款成功',
  '交易成功',
  '收款成功',
  '买单成功',
  '已完成支付',
  '收款到账',
  '付款给',
  '账单详情',
] as const;

const EXPENSE_PATTERNS = [
  /付款成功/,
  /支付成功/,
  /消费/,
  /扣款/,
  /已向/,
  /向.*付款/,
  /付款给/,
  /实付/,
  /买单成功/,
  /已完成支付/,
  /交易成功/,
  /扫码付款/,
  /免密支付/,
  /自动扣费/,
  /支付人民币/,
] as const;

const INCOME_KEYWORDS = [
  '收款成功',
  '收到转账',
  '已收款',
  '收款到账',
  '微信支付收款',
  '支付宝收款',
  '退款成功',
  '已退回',
  '退回至',
  '红包已存入',
  '入账',
  '工资到账',
  '分红',
] as const;

const KEYWORD_AMOUNT_REGEX =
  /(?:实付|实付款|支付|付款|消费|扣款|收款|入账|退回|退款|金额|合计|共付|总计)[：:\s]*[¥￥]?\s*(\d{1,7}(?:,\d{3})*(?:\.\d{1,2})?)/;

const CURRENCY_AMOUNT_REGEX =
  /(?:[¥￥]|RMB\s*|CNY\s*)(\d{1,7}(?:,\d{3})*(?:\.\d{1,2})?)|(\d{1,7}(?:,\d{3})*(?:\.\d{1,2})?)\s*元/;

const GENERIC_PHRASES = new Set([
  '微信支付',
  '支付宝',
  '支付成功',
  '付款成功',
  '收款通知',
  '账单通知',
  '美团外卖',
  '美团',
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

function extractAmountCents(text: string): number | null {
  const kwMatch = text.match(KEYWORD_AMOUNT_REGEX);
  if (kwMatch?.[1]) {
    const cents = parseAmountToCents(kwMatch[1]);
    if (cents !== null) return cents;
  }
  const curMatch = text.match(CURRENCY_AMOUNT_REGEX);
  if (curMatch) {
    const raw = curMatch[1] || curMatch[2];
    const cents = parseAmountToCents(raw);
    if (cents !== null) return cents;
  }
  return null;
}

function extractMerchant(sourceApp: string, title: string, combined: string): string {
  const patterns = [
    /(?:向|给)([\u4e00-\u9fa5A-Za-z0-9·()（）_-]{2,20}?)(?:付款|转账|支付|消费)/,
    /在([\u4e00-\u9fa5A-Za-z0-9·()（）_-]{2,20}?)(?:消费|付款|下单)/,
    /(?:收款方|商户|商家|付款方|商品)[：:]\s*([\u4e00-\u9fa5A-Za-z0-9·()（）_-]{2,20})/,
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
    containsAny(text, [
      '美团外卖',
      '饿了么',
      '瑞幸',
      '星巴克',
      '喜茶',
      '奈雪',
      '肯德基',
      '麦当劳',
      '餐厅',
      '餐饮',
      '饭',
      '面',
      '火锅',
      '烧烤',
      '奶茶',
      '咖啡',
      '早餐',
      '午餐',
      '晚餐',
      '小吃',
      '外卖',
    ])
  ) {
    return { categoryId: 'exp_food', categoryName: '餐饮' };
  }

  if (
    containsAny(text, [
      '滴滴',
      '高德',
      '打车',
      '出租车',
      '地铁',
      '公交',
      '高铁',
      '铁路',
      '12306',
      '机票',
      '航司',
      '加油',
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
      '罗森',
      '711',
      '全家',
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

export function parsePaymentNotificationText(options: {
  sourceApp: string;
  title?: string;
  content: string;
  requireCompletionHeader?: boolean;
}): ParsedPaymentResult | null {
  const title = options.title?.trim() ?? '';
  const content = options.content.trim();
  const combined = [title, content]
    .filter((s) => s.length > 0)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (combined.length < 4) return null;
  if (NOISE_KEYWORDS.some((kw) => combined.includes(kw))) return null;
  if (
    options.requireCompletionHeader &&
    !COMPLETION_HEADERS.some((kw) => combined.includes(kw))
  ) {
    return null;
  }

  const isIncome = INCOME_KEYWORDS.some((kw) => combined.includes(kw));
  const isExpense = EXPENSE_PATTERNS.some((re) => re.test(combined));
  if (!isIncome && !isExpense) return null;

  const type: TransactionType = isIncome ? 'income' : 'expense';
  const amountCents = extractAmountCents(combined);
  if (amountCents === null) return null;

  const merchant = extractMerchant(options.sourceApp, title, combined);
  const { categoryId, categoryName } = suggestCategoryForPayment(
    type,
    options.sourceApp,
    `${merchant} ${combined}`
  );

  const rawSummary =
    combined.length > 100 ? `${combined.slice(0, 100)}…` : combined;

  return {
    type,
    amountCents,
    merchant,
    suggestedCategoryId: categoryId,
    suggestedCategoryName: categoryName,
    sourceApp: options.sourceApp,
    rawSummary,
  };
}
