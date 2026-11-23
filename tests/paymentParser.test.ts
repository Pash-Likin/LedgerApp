import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePaymentNotificationText } from '../src/utils/paymentParser';

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

test('parses Meituan Waimai payment notification accurately', () => {
  const result = parsePaymentNotificationText({
    sourceApp: '美团外卖',
    title: '美团外卖',
    content: '订单支付成功，实付¥36.50',
  });
  assert.ok(result);
  assert.equal(result.type, 'expense');
  assert.equal(result.amountCents, 3650);
  assert.equal(result.suggestedCategoryId, 'exp_food');
});

test('parses Alipay Didi ride payment as transport expense', () => {
  const result = parsePaymentNotificationText({
    sourceApp: '支付宝',
    title: '支付宝',
    content: '向滴滴出行付款24.60元，交易成功',
  });
  assert.ok(result);
  assert.equal(result.type, 'expense');
  assert.equal(result.amountCents, 2460);
  assert.equal(result.merchant, '滴滴出行');
  assert.equal(result.suggestedCategoryId, 'exp_transport');
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

test('rejects coupons, verification codes, and rider status notifications', () => {
  assert.equal(
    parsePaymentNotificationText({
      sourceApp: '美团',
      content: '您有一张满30减15优惠券即将过期，实付低至¥15.00',
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
});

test('enforces completion header check in Accessibility mode to avoid menu false positives', () => {
  // Browsing menu prices must be ignored when requireCompletionHeader is true
  const menuScreen = parsePaymentNotificationText({
    sourceApp: '美团外卖',
    content: '招牌牛肉面 ¥28.00 实付立减',
    requireCompletionHeader: true,
  });
  assert.equal(menuScreen, null);

  // Payment completion screen should be captured
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
