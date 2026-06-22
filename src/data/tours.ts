import type { DriveStep } from 'driver.js'

// 教程主题标识
export type TourTopic = 'quickstart' | 'fund' | 'compare' | 'anchor' | 'all'

export interface TourDef {
  key: Exclude<TourTopic, 'all'>
  label: string
  steps: DriveStep[]
}

// 用 data-tour 锚点生成选择器
const el = (id: string): string => `[data-tour='${id}']`

export const TOURS: Record<Exclude<TourTopic, 'all'>, TourDef> = {
  quickstart: {
    key: 'quickstart',
    label: '🚀 快速入门',
    steps: [
      { element: el('param-month'), popover: { title: '第 1 步 · 规划期限', description: '先在这里设置从哪个月开始、规划到哪个月结束。' } },
      { element: el('param-rate'), popover: { title: '第 2 步 · 收益率与本金', description: '设置年化收益率（投资回报）和现在手头的初始存款。' } },
      { element: el('monthly-table'), popover: { title: '第 3 步 · 填收支（核心）', description: '在月度流水里添加收入 / 支出项、逐月填金额——规划数据都从这里来。' } },
      { element: el('metrics'), popover: { title: '第 4 步 · 看结果', description: '填的数字会实时反映在这里：指标条看整体，下方年度汇总看每年。' } },
      { element: el('view-chart'), popover: { title: '第 5 步 · 看趋势', description: '点「图表」切换到趋势图，看储蓄如何随时间增长。' } },
    ],
  },
  fund: {
    key: 'fund',
    label: '🏠 公积金专区',
    // 公积金子参数仅在开关开启后渲染，故全部指向始终存在的开关元素，文案分段讲解
    steps: [
      { element: el('fund-toggle'), popover: { title: '开启公积金', description: '勾选这个开关启用公积金；未开启时下方参数不会显示。' } },
      { element: el('fund-toggle'), popover: { title: '缴存与结息', description: '开启后可在此设置年利率、结息月份、初始余额。' } },
      { element: el('fund-toggle'), popover: { title: '月冲与提取', description: '在月度流水表的公积金列点单元格，可编辑缴存 / 月冲 / 提取。' } },
    ],
  },
  compare: {
    key: 'compare',
    label: '📊 多方案对比',
    steps: [
      { element: el('scenario-tabs'), popover: { title: '建多套方案', description: '点方案标签的「+」新建方案（如「买房」「不买房」），也可复制现有方案。' } },
      { element: el('view-compare'), popover: { title: '并排对比', description: '切到「对比」视图，把多套方案的结果并排比较。' } },
    ],
  },
  anchor: {
    key: 'anchor',
    label: '🎯 储蓄目标核对',
    steps: [
      { element: el('balance-col'), popover: { title: '设储蓄目标', description: '在月度流水的「存款」列点某个月，可设置该月的预期储蓄额（锚点）。' } },
      { element: el('balance-col'), popover: { title: '看是否达标', description: '设了锚点的月份会高亮，并显示实际存款与目标的偏差。' } },
    ],
  },
}

// 菜单元数据：4 主题 + 重看全部
export const TOUR_TOPICS: { key: TourTopic; label: string }[] = [
  { key: 'quickstart', label: TOURS.quickstart.label },
  { key: 'fund', label: TOURS.fund.label },
  { key: 'compare', label: TOURS.compare.label },
  { key: 'anchor', label: TOURS.anchor.label },
  { key: 'all', label: '🔁 重看全部' },
]

// 「重看全部」= 串联四个主题步骤
export function buildAllSteps(): DriveStep[] {
  return [
    ...TOURS.quickstart.steps,
    ...TOURS.fund.steps,
    ...TOURS.compare.steps,
    ...TOURS.anchor.steps,
  ]
}
