import type { CreateTransactionInput } from '../types/ledger';
import { getDaysInMonth, pad2 } from '../utils/date';

interface DemoTemplate {
  dayOffset: number;
  time: string;
  type: 'expense' | 'income';
  amountCents: number;
  categoryId: string;
  note: string;
}

const DEMO_TEMPLATES: DemoTemplate[] = [
  {
    dayOffset: 1,
    time: '09:30:00',
    type: 'income',
    amountCents: 1280000,
    categoryId: 'inc_salary',
    note: '本月工资到账',
  },
  {
    dayOffset: 2,
    time: '08:40:00',
    type: 'expense',
    amountCents: 1850,
    categoryId: 'exp_food',
    note: '豆浆油条与手冲咖啡',
  },
  {
    dayOffset: 3,
    time: '18:25:00',
    type: 'expense',
    amountCents: 600,
    categoryId: 'exp_transport',
    note: '地铁通勤往返',
  },
  {
    dayOffset: 5,
    time: '10:00:00',
    type: 'expense',
    amountCents: 260000,
    categoryId: 'exp_housing',
    note: '房租与物业水电',
  },
  {
    dayOffset: 7,
    time: '19:45:00',
    type: 'expense',
    amountCents: 12800,
    categoryId: 'exp_daily',
    note: '超市采购洗护用品',
  },
  {
    dayOffset: 10,
    time: '14:15:00',
    type: 'income',
    amountCents: 45000,
    categoryId: 'inc_invest',
    note: '基金分红收益',
  },
  {
    dayOffset: 12,
    time: '20:10:00',
    type: 'expense',
    amountCents: 21500,
    categoryId: 'exp_social',
    note: '和朋友聚餐火锅',
  },
  {
    dayOffset: 15,
    time: '16:20:00',
    type: 'expense',
    amountCents: 32900,
    categoryId: 'exp_shopping',
    note: '换季运动鞋与袜子',
  },
  {
    dayOffset: 18,
    time: '21:00:00',
    type: 'expense',
    amountCents: 8900,
    categoryId: 'exp_entertainment',
    note: '周末电影票与爆米花',
  },
  {
    dayOffset: 20,
    time: '11:30:00',
    type: 'income',
    amountCents: 60000,
    categoryId: 'inc_parttime',
    note: '设计外包结款',
  },
  {
    dayOffset: 22,
    time: '12:35:00',
    type: 'expense',
    amountCents: 4200,
    categoryId: 'exp_food',
    note: '工作日午餐套餐',
  },
  {
    dayOffset: 25,
    time: '15:10:00',
    type: 'expense',
    amountCents: 7800,
    categoryId: 'exp_education',
    note: '技术书籍购买',
  },
];

export function buildDemoTransactionsForMonth(yearMonth: string): CreateTransactionInput[] {
  const maxDay = getDaysInMonth(yearMonth);
  return DEMO_TEMPLATES.map((tpl) => {
    const safeDay = Math.min(tpl.dayOffset, maxDay);
    return {
      type: tpl.type,
      amountCents: tpl.amountCents,
      categoryId: tpl.categoryId,
      note: tpl.note,
      occurredAt: `${yearMonth}-${pad2(safeDay)}T${tpl.time}`,
    };
  });
}
