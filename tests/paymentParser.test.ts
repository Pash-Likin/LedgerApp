import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parsePaymentNotificationText,
  parsePaymentWithReason,
} from '../src/utils/paymentParser';

test('parses WeChat coffee payment notification as food expense', () => {
  const result = parsePaymentNotificationText({
    sourceApp: '微信',
    title: '微信支付',
    content: '微信支付：你已向瑞幸咖啡付款18.80元',
  });
  assert.ok(result);
  assert.equal(result.type, 'expense');
  assert.equal(result.amountCents, 1880);
  assert.equal(result.merchant, '瑞幸咖啡');
  assert.equal(result.suggestedCategoryId, 'exp_food');
  assert.equal(result.suggestedCategoryName, '餐饮');
});

test('parses simple WeChat Pay notifications with 已支付 and 支付凭证', () => {
  const r1 = parsePaymentNotificationText({
    sourceApp: '微信',
    title: '微信支付',
    content: '已支付¥12.50',
  });
  assert.ok(r1);
  assert.equal(r1.type, 'expense');
  assert.equal(r1.amountCents, 1250);

  const r2 = parsePaymentNotificationText({
    sourceApp: '微信',
    title: '微信',
    content: '微信支付凭证：支付12.50元',
  });
  assert.ok(r2);
  assert.equal(r2.type, 'expense');
  assert.equal(r2.amountCents, 1250);
});

test('parses WeChat Accessibility screen with space between ￥ and amount', () => {
  const result = parsePaymentNotificationText({
    sourceApp: '微信',
    content: '支付成功 瑞幸咖啡 ￥ 18.80 完成',
    requireCompletionHeader: true,
  });
  assert.ok(result);
  assert.equal(result.type, 'expense');
  assert.equal(result.amountCents, 1880);
  assert.equal(result.suggestedCategoryId, 'exp_food');
});

test('parses Meituan payment success screen even when promo/ETA text is also visible', () => {
  const result = parsePaymentNotificationText({
    sourceApp: '美团外卖',
    content: '支付成功 美团外卖 满减已优惠¥5.00 实付 ¥ 36.50 预计送达 12:30',
    requireCompletionHeader: true,
  });
  assert.ok(result);
  assert.equal(result.type, 'expense');
  assert.equal(result.amountCents, 3650);
  assert.equal(result.suggestedCategoryId, 'exp_food');
});

test('parses Alipay expenditure, Huabei, and Didi ride notifications', () => {
  const didi = parsePaymentNotificationText({
    sourceApp: '支付宝',
    title: '支付宝',
    content: '向滴滴出行付款24.60元，交易成功',
  });
  assert.ok(didi);
  assert.equal(didi.amountCents, 2460);
  assert.equal(didi.merchant, '滴滴出行');
  assert.equal(didi.suggestedCategoryId, 'exp_transport');

  const spend = parsePaymentNotificationText({
    sourceApp: '支付宝',
    title: '交易提醒',
    content: '你有一笔25.00元的支出',
  });
  assert.ok(spend);
  assert.equal(spend.type, 'expense');
  assert.equal(spend.amountCents, 2500);

  const huabei = parsePaymentNotificationText({
    sourceApp: '支付宝',
    title: '支付宝通知',
    content: '花呗消费19.90元',
  });
  assert.ok(huabei);
  assert.equal(huabei.type, 'expense');
  assert.equal(huabei.amountCents, 1990);
});

test('parses bank deduction SMS while ignoring account balance', () => {
  const sms = parsePaymentNotificationText({
    sourceApp: '银行短信',
    title: '95555',
    content: '【招商银行】您尾号1234账户11月27日快捷支付人民币58.60元，可用余额1200.00元',
    isSms: true,
  });
  assert.ok(sms);
  assert.equal(sms.type, 'expense');
  assert.equal(sms.amountCents, 5860);
  assert.equal(sms.merchant, '招商银行');

  // Non-bank SMS must be ignored
  const chatSms = parsePaymentNotificationText({
    sourceApp: '银行短信',
    title: '13800138000',
    content: '今天中午消费50元记得AA',
    isSms: true,
  });
  assert.equal(chatSms, null);
});

test('parses WeChat incoming payment and Meituan refund as income', () => {
  const income = parsePaymentNotificationText({
    sourceApp: '微信',
    title: '微信收款助手',
    content: '微信支付收款88.00元',
  });
  assert.ok(income);
  assert.equal(income.type, 'income');
  assert.equal(income.amountCents, 8800);

  const refund = parsePaymentNotificationText({
    sourceApp: '美团',
    title: '美团',
    content: '退款成功，已退回¥15.00',
  });
  assert.ok(refund);
  assert.equal(refund.type, 'income');
  assert.equal(refund.amountCents, 1500);
});

test('rejects coupons, verification codes, rider ETA, and pre-payment checkout screens', () => {
  assert.equal(
    parsePaymentNotificationText({
      sourceApp: '美团',
      content: '您有一张满30减15优惠券即将过期，领券立享优惠',
    }),
    null
  );
  assert.equal(
    parsePaymentNotificationText({
      sourceApp: '微信',
      content: '验证码 884210，登录付款请勿泄露',
    }),
    null
  );
  assert.equal(
    parsePaymentNotificationText({
      sourceApp: '美团外卖',
      content: '骑手已接单，预计送达时间 19:45，订单金额¥36.50',
    }),
    null
  );
  const checkout = parsePaymentWithReason({
    sourceApp: '美团外卖',
    content: '待付款 应付 ¥48.00 立即支付',
    requireCompletionHeader: true,
  });
  assert.equal(checkout.parsed, null);
  assert.ok(checkout.rejectReason?.includes('过滤干扰词'));
});

test('enforces completion header check in Accessibility mode to avoid menu false positives', () => {
  const menuScreen = parsePaymentNotificationText({
    sourceApp: '美团外卖',
    content: '招牌牛肉面 ¥28.00 实付立减',
    requireCompletionHeader: true,
  });
  assert.equal(menuScreen, null);

  const paidScreen = parsePaymentNotificationText({
    sourceApp: '美团外卖',
    content: '支付成功 实付 ¥28.00 商户：兰州拉面馆',
    requireCompletionHeader: true,
  });
  assert.ok(paidScreen);
  assert.equal(paidScreen.type, 'expense');
  assert.equal(paidScreen.amountCents, 2800);
  assert.equal(paidScreen.merchant, '兰州拉面馆');
  assert.equal(paidScreen.suggestedCategoryId, 'exp_food');
});
