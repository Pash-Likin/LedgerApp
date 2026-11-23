import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateKeypadExpression,
  evaluateKeypadToCents,
  formatSignedYuan,
  formatYuan,
  parseYuanToCents,
} from '../src/utils/money';

test('formatYuan formats positive, zero, negative, and comma options', () => {
  assert.equal(formatYuan(0), '0.00');
  assert.equal(formatYuan(5), '0.05');
  assert.equal(formatYuan(1250), '12.50');
  assert.equal(formatYuan(1234567), '12,345.67');
  assert.equal(formatYuan(-123456), '-1,234.56');
  assert.equal(formatYuan(123456, { withCommas: false }), '1234.56');
  assert.equal(formatYuan(-123456, { withCommas: false }), '-1234.56');
});

test('formatSignedYuan prefixes sign and currency symbol by transaction type', () => {
  assert.equal(formatSignedYuan(3500, 'expense'), '-¥35.00');
  assert.equal(formatSignedYuan(800000, 'income'), '+¥8,000.00');
});

test('parseYuanToCents validates and converts valid yuan strings', () => {
  assert.equal(parseYuanToCents('28'), 2800);
  assert.equal(parseYuanToCents('28.5'), 2850);
  assert.equal(parseYuanToCents('28.50'), 2850);
  assert.equal(parseYuanToCents('.5'), 50);
  assert.equal(parseYuanToCents(' 19.99 '), 1999);
});

test('parseYuanToCents rejects zero, negative, >2 decimals, and invalid strings', () => {
  assert.equal(parseYuanToCents(''), null);
  assert.equal(parseYuanToCents('0'), null);
  assert.equal(parseYuanToCents('0.00'), null);
  assert.equal(parseYuanToCents('-12'), null);
  assert.equal(parseYuanToCents('12.345'), null);
  assert.equal(parseYuanToCents('12abc'), null);
  assert.equal(parseYuanToCents('100000000'), null);
});

test('evaluateKeypadExpression computes + and - safely without float drift', () => {
  assert.equal(evaluateKeypadExpression('28.5+12-4.5'), 36);
  assert.equal(evaluateKeypadExpression('0.1+0.2'), 0.3);
  assert.equal(evaluateKeypadToCents('0.1+0.2'), 30);
  assert.equal(evaluateKeypadExpression('28.5+'), 28.5);
  assert.equal(evaluateKeypadExpression('10.'), 10);
});

test('evaluateKeypadExpression rejects invalid syntax or non-positive results', () => {
  assert.equal(evaluateKeypadExpression(''), null);
  assert.equal(evaluateKeypadExpression('+'), null);
  assert.equal(evaluateKeypadExpression('10-10'), null);
  assert.equal(evaluateKeypadExpression('10-25'), null);
  assert.equal(evaluateKeypadExpression('10++5'), null);
  assert.equal(evaluateKeypadExpression('12*3'), null);
  assert.equal(evaluateKeypadExpression('12.345+1'), null);
});
