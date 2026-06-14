# 财务趋势图专业化改版 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把财务趋势图从「能用但丑」升级为「专业克制、一眼可读」的组合图，并把柔和红绿（朱砂/竹青）同步为全应用收支语义色。

**Architecture:** 改造集中在三处——`uno.config.ts`（语义色阶重映射）、`src/utils/financeChart.ts`（图表数据与 option 全面专业化，纯函数 + ECharts option）、`src/components/FinanceChart.vue`（标题区当前累计值高亮）。计算逻辑、数据流、其他视图结构不动。图表逻辑全部走纯函数 `buildChartData` / `buildChartOption`，可单测；TDD 推进。

**Tech Stack:** Vue 3 (Composition API + TS)、UnoCSS、ECharts（按需引入）、Vitest。

**约定：**
- 所有 commit message 用中文，末尾追加一行 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`（下文各 step 为简洁只写主题行，执行时补尾行）。
- 单测运行命令：`npx vitest run tests/utils/financeChart.spec.ts`（替换为目标文件）；全量：`npm run test`。
- 每个改 `buildChartOption` 的任务用「找到 → 替换」的精确代码段（Edit），最后在 Task 9 给出完整最终态。

---

## Task 1: 配色同步——uno.config 柔和色阶

**Files:**
- Modify: `uno.config.ts`

- [ ] **Step 1: 新增朱砂/竹青色阶，重映射 positive/negative**

把 `uno.config.ts` 的色阶常量区与 `theme.colors` 改为：

```ts
import { defineConfig, presetUno } from 'unocss'

// 语义色阶：值取自 Tailwind 默认调色板（与 presetUno 内置一致），便于核对
const indigo = {
  50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc',
  400: '#818cf8', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca',
  800: '#3730a3', 900: '#312e81',
}
const red = {  // 操作失败/删除（danger）用，保留标准红
  50: '#fef2f2', 100: '#fee2e2', 200: '#fecaca', 300: '#fca5a5',
  400: '#f87171', 500: '#ef4444', 600: '#dc2626', 700: '#b91c1c',
  800: '#991b1b', 900: '#7f1d1d',
}
const green = {  // 操作成功（success）用，保留标准绿
  50: '#f0fdf4', 100: '#dcfce7', 200: '#bbf7d0', 300: '#86efac',
  400: '#4ade80', 500: '#22c55e', 600: '#16a34a', 700: '#15803d',
  800: '#166534', 900: '#14532d',
}
// 朱砂：中式正向（收入 / 增长 / 更优），柱与文字统一用 600
const zhusha = {
  50: '#fbf3f2', 100: '#f5e3e1', 200: '#e9c9c6', 300: '#d8a7a3',
  400: '#c97976', 500: '#c2605c', 600: '#c0504d',
  700: '#9f4340', 800: '#7d3433', 900: '#5b2726',
}
// 竹青：中式负向（支出 / 下降 / 更劣），柱用 500（柔和）、文字用 600（可读）
const zhuqing = {
  50: '#f3f6f4', 100: '#e3ebe6', 200: '#c9d8cf', 300: '#a5bcb0',
  400: '#82a58e', 500: '#6b8e7b', 600: '#5e8270',
  700: '#4a6b5a', 800: '#3a5447', 900: '#2c3f36',
}
const slate = {
  50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1',
  400: '#94a3b8', 500: '#64748b', 600: '#475569', 700: '#334155',
  800: '#1e293b', 900: '#0f172a',
}

export default defineConfig({
  presets: [presetUno()],
  theme: {
    colors: {
      brand: indigo,      // 主色·交互
      positive: zhusha,   // 中式正向：收入 / 差额增长（柔和朱砂）
      negative: zhuqing,  // 中式负向：支出 / 差额下降（柔和竹青）
      success: green,     // 操作成功（固定标准绿）
      danger: red,        // 操作失败/删除（固定标准红）
      neutral: slate,     // 中性
    },
  },
})
```

- [ ] **Step 2: 验证 build 通过**

Run: `npm run build`
Expected: 构建成功，无 TS / UnoCSS 报错。

- [ ] **Step 3: Commit**

```bash
git add uno.config.ts
git commit -m "feat: 收支语义色改为柔和朱砂/竹青色阶（positive/negative 重映射）"
```

---

## Task 2: 智能金额格式化纯函数 formatAxisAmount

**Files:**
- Modify: `src/utils/financeChart.ts`（新增导出函数）
- Test: `tests/utils/financeChart.spec.ts`

- [ ] **Step 1: 写失败测试**

在 `tests/utils/financeChart.spec.ts` 顶部 import 增加 `formatAxisAmount`：

```ts
import { formatAxisLabel, buildChartData, buildChartOption, formatAxisAmount } from '../../src/utils/financeChart'
```

在 `describe('formatAxisLabel', ...)` 之后新增：

```ts
describe('formatAxisAmount', () => {
  it('<1万 千分位整数', () => {
    expect(formatAxisAmount(500)).toBe('500')
    expect(formatAxisAmount(0)).toBe('0')
    expect(formatAxisAmount(9200)).toBe('9,200')
  })
  it('≥1万 显示 X.X万（去尾零）', () => {
    expect(formatAxisAmount(15800)).toBe('1.6万')
    expect(formatAxisAmount(1234567)).toBe('123.5万')
    expect(formatAxisAmount(150000)).toBe('15万')
  })
  it('≥1亿 显示 X.X亿', () => {
    expect(formatAxisAmount(120000000)).toBe('1.2亿')
  })
  it('负值带 - 前缀', () => {
    expect(formatAxisAmount(-1500000)).toBe('-150万')
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run tests/utils/financeChart.spec.ts`
Expected: FAIL — `formatAxisAmount is not a function`（未导出）。

- [ ] **Step 3: 实现 formatAxisAmount**

在 `src/utils/financeChart.ts` 的 `formatAxisLabel` 函数之后新增：

```ts
/** 轴刻度 / 摘要智能缩写：<1万 千分位整数，≥1万 X.X万，≥1亿 X.X亿（去尾零）。 */
export function formatAxisAmount(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 1e8) return (v / 1e8).toFixed(1).replace(/\.0$/, '') + '亿'
  if (abs >= 1e4) return (v / 1e4).toFixed(1).replace(/\.0$/, '') + '万'
  return Math.round(v).toLocaleString('en-US')
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run tests/utils/financeChart.spec.ts`
Expected: PASS（formatAxisAmount 全绿；其余既有用例不受影响）。

- [ ] **Step 5: Commit**

```bash
git add src/utils/financeChart.ts tests/utils/financeChart.spec.ts
git commit -m "feat: 新增 formatAxisAmount 智能金额缩写（万/亿）"
```

---

## Task 3: buildChartData 支出取正

**Files:**
- Modify: `src/utils/financeChart.ts:49-66`（buildChartData）
- Test: `tests/utils/financeChart.spec.ts:28-56`

- [ ] **Step 1: 改测试断言为正值（先让测试失败）**

在 `tests/utils/financeChart.spec.ts` 中：

`describe('buildChartData')` 第一个 `it` 标题与断言改为（`-6000` → `6000`）：

```ts
  it('按月：categories 用 YY/MM，支出为正值', () => {
    const results = [
      makeResult({ month: 202601, monthlyIncome: 10000, monthlyExpense: 6000, cumSavings: 50000 }),
      makeResult({ month: 202602, monthlyIncome: 10000, monthlyExpense: 6000, cumSavings: 55000 }),
    ]

    expect(buildChartData(results, 'month')).toEqual({
      categories: ['26/01', '26/02'],
      income: [10000, 10000],
      expense: [6000, 6000],
      cumSavings: [50000, 55000],
    })
  })
```

第二个 `it`（按年）同样把 `expense: [-5000, -5000]` 改为 `expense: [5000, 5000]`，标题改为「按年：按自然年聚合，支出为正值，categories 用年份」。

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run tests/utils/financeChart.spec.ts`
Expected: FAIL — `expected [6000,6000] received [-6000,-6000]`（实现仍取负）。

- [ ] **Step 3: 改实现，支出不再取负**

在 `src/utils/financeChart.ts`，`buildChartData` 两个分支的 `expense` 去掉 `-`：

年聚合分支：`expense: years.map(p => -p.expense)` → `expense: years.map(p => p.expense)`
按月分支：`expense: results.map(r => -r.monthlyExpense)` → `expense: results.map(r => r.monthlyExpense)`

同时把 `ChartData` 接口注释更新：

```ts
export interface ChartData {
  categories: string[]
  income: number[]
  expense: number[]      // 正值（不再取负）
  cumSavings: number[]
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run tests/utils/financeChart.spec.ts`
Expected: buildChartData 两用例 PASS。（注：buildChartOption 用例此刻仍传 `expense: [-6000]`，会在 Task 4 一并修。）

- [ ] **Step 5: Commit**

```bash
git add src/utils/financeChart.ts tests/utils/financeChart.spec.ts
git commit -m "feat: 图表支出改为正值（不再镜像负轴）"
```

---

## Task 4: buildChartOption 配色常量 + 支出正值断言

**Files:**
- Modify: `src/utils/financeChart.ts:34-36`（配色常量）
- Test: `tests/utils/financeChart.spec.ts:58-77`

- [ ] **Step 1: 改测试断言（配色 + 支出正值，先失败）**

`describe('buildChartOption')` 的 `it` 改为（输入 `expense` 改正值、配色断言改新色值）：

```ts
  it('三系列：收入/支出走左轴，累计储蓄走右轴；数据与配色正确', () => {
    const data = { categories: ['26/01'], income: [10000], expense: [6000], cumSavings: [50000] }

    const option = buildChartOption(data)

    expect(option.series.map(s => s.name)).toEqual(['收入', '支出', '累计储蓄'])
    expect(option.series.map(s => s.type)).toEqual(['bar', 'bar', 'line'])
    expect(option.series[0].yAxisIndex).toBe(0)
    expect(option.series[1].yAxisIndex).toBe(0)
    expect(option.series[2].yAxisIndex).toBe(1)
    expect(option.series[0].data).toEqual([10000])
    expect(option.series[1].data).toEqual([6000])
    expect(option.series[2].data).toEqual([50000])
    expect(option.series[0].itemStyle?.color).toBe('#c0504d')
    expect(option.series[1].itemStyle?.color).toBe('#6b8e7b')
    expect(option.xAxis.data).toEqual(['26/01'])
    expect(option.legend.data).toEqual(['收入', '支出', '累计储蓄'])
  })
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run tests/utils/financeChart.spec.ts`
Expected: FAIL — 配色 `expected '#c0504d' received '#dc2626'`。

- [ ] **Step 3: 更新配色常量**

`src/utils/financeChart.ts` 顶部常量改为：

```ts
// 配色（中式柔和：收入朱砂 / 支出竹青 / 累计靛蓝），与表格语义同源
const COLOR_INCOME = '#c0504d'   // zhusha-600
const COLOR_EXPENSE = '#6b8e7b'  // zhuqing-500（柱用柔和阶）
const COLOR_CUM = '#4f46e5'
// 中性轴/网格（slate），网格更淡
const COLOR_AXIS = '#cbd5e1'
const COLOR_GRID = '#eef2f7'
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run tests/utils/financeChart.spec.ts`
Expected: PASS（配色两断言转绿；其余既有断言不受影响）。

- [ ] **Step 5: Commit**

```bash
git add src/utils/financeChart.ts tests/utils/financeChart.spec.ts
git commit -m "feat: 图表配色改为柔和朱砂/竹青，同步表格语义色"
```

---

## Task 5: 累计储蓄升级为渐变面积主线

**Files:**
- Modify: `src/utils/financeChart.ts`（series[2]、ChartSeries 类型）
- Test: `tests/utils/financeChart.spec.ts`

- [ ] **Step 1: 写失败测试**

在 `describe('buildChartOption')` 现有 `it` 之后新增：

```ts
  it('累计储蓄为渐变面积主线：含 areaStyle 与 2.5px 粗线', () => {
    const data = { categories: ['26/01'], income: [10000], expense: [6000], cumSavings: [50000] }
    const cum = buildChartOption(data).series[2]

    expect(cum.areaStyle).toBeDefined()
    expect(cum.areaStyle?.color).toBeDefined()
    expect(cum.lineStyle?.width).toBe(2.5)
  })
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run tests/utils/financeChart.spec.ts`
Expected: FAIL — `cum.areaStyle` 为 undefined。

- [ ] **Step 3: 扩展 ChartSeries 类型 + 给累计 series 加 areaStyle**

`src/utils/financeChart.ts` 的 `ChartSeries` 接口加 `areaStyle` 与 `lineStyle.width`：

```ts
export interface ChartSeries {
  name: string
  type: 'bar' | 'line'
  data: number[]
  yAxisIndex?: number
  itemStyle?: { color: string; borderRadius?: number[] }
  lineStyle?: { color: string; width?: number }
  areaStyle?: { color: unknown }   // ECharts 渐变对象，类型宽松
  smooth?: boolean
  showSymbol?: boolean
  barCategoryGap?: string
}
```

`buildChartOption` 的累计 series 改为（找到原累计 series 整段替换）：

```ts
      {
        name: '累计储蓄', type: 'line', yAxisIndex: 1, data: data.cumSavings,
        smooth: true, showSymbol: false,
        lineStyle: { color: COLOR_CUM, width: 2.5 },
        itemStyle: { color: COLOR_CUM },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(79,70,229,0.28)' },
              { offset: 1, color: 'rgba(79,70,229,0.02)' },
            ],
          },
        },
      },
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run tests/utils/financeChart.spec.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/utils/financeChart.ts tests/utils/financeChart.spec.ts
git commit -m "feat: 累计储蓄升级为渐变面积+粗线主线"
```

---

## Task 6: 收支柱圆角 + 组间距

**Files:**
- Modify: `src/utils/financeChart.ts`（series[0]/[1]）
- Test: `tests/utils/financeChart.spec.ts`

- [ ] **Step 1: 写失败测试**

`describe('buildChartOption')` 新增：

```ts
  it('收支柱为正值并列双柱，顶部圆角', () => {
    const data = { categories: ['26/01'], income: [10000], expense: [6000], cumSavings: [50000] }
    const option = buildChartOption(data)
    const income = option.series[0]
    const expense = option.series[1]

    expect(income.itemStyle?.borderRadius).toEqual([2, 2, 0, 0])
    expect(expense.itemStyle?.borderRadius).toEqual([2, 2, 0, 0])
    expect(income.barCategoryGap).toBe('40%')
  })
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run tests/utils/financeChart.spec.ts`
Expected: FAIL — `borderRadius` 为 undefined。

- [ ] **Step 3: 给收支柱加圆角与组间距**

`buildChartOption` 的收入、支出两个 series 改为（找到这两段替换）：

```ts
      {
        name: '收入', type: 'bar', yAxisIndex: 0, data: data.income,
        itemStyle: { color: COLOR_INCOME, borderRadius: [2, 2, 0, 0] },
        barCategoryGap: '40%',
      },
      {
        name: '支出', type: 'bar', yAxisIndex: 0, data: data.expense,
        itemStyle: { color: COLOR_EXPENSE, borderRadius: [2, 2, 0, 0] },
        barCategoryGap: '40%',
      },
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run tests/utils/financeChart.spec.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/utils/financeChart.ts tests/utils/financeChart.spec.ts
git commit -m "feat: 收支柱顶部圆角+组间距，正值并列双柱"
```

---

## Task 7: 单一网格——右轴关闭 splitLine

**Files:**
- Modify: `src/utils/financeChart.ts`（yAxis、ChartOption 类型）
- Test: `tests/utils/financeChart.spec.ts`

- [ ] **Step 1: 写失败测试**

`describe('buildChartOption')` 新增：

```ts
  it('仅左轴画网格，右轴不画（避免双重网格）', () => {
    const data = { categories: ['26/01'], income: [10000], expense: [6000], cumSavings: [50000] }
    const [left, right] = buildChartOption(data).yAxis

    expect(left.splitLine?.show ?? true).toBe(true)
    expect(right.splitLine?.show).toBe(false)
  })
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run tests/utils/financeChart.spec.ts`
Expected: FAIL — 右轴 `splitLine.show` 非 false。

- [ ] **Step 3: 扩展类型 + 关闭右轴网格**

`ChartOption.yAxis` 类型放宽（支持 `show`）：

```ts
  yAxis: { type: string; alignTicks: boolean; splitLine?: { show?: boolean; lineStyle: { color: string } } }[]
```

`buildChartOption` 的 `yAxis` 数组改为（找到原 yAxis 整段替换）：

```ts
    yAxis: [
      { type: 'value', alignTicks: true, splitLine: { lineStyle: { color: COLOR_GRID } } },
      { type: 'value', alignTicks: true, splitLine: { show: false } },
    ],
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run tests/utils/financeChart.spec.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/utils/financeChart.ts tests/utils/financeChart.spec.ts
git commit -m "fix: 关闭右轴 splitLine，消除双重网格"
```

---

## Task 8: 坐标轴万元格式化 + X 轴稀疏

**Files:**
- Modify: `src/utils/financeChart.ts`（yAxis axisLabel、xAxis、ChartOption 类型）
- Test: `tests/utils/financeChart.spec.ts`

- [ ] **Step 1: 写失败测试**

`describe('buildChartOption')` 新增：

```ts
  it('左右轴有万元 formatter，X 轴标签稀疏', () => {
    const data = { categories: ['26/01'], income: [10000], expense: [6000], cumSavings: [50000] }
    const option = buildChartOption(data)

    expect(typeof option.yAxis[0].axisLabel?.formatter).toBe('function')
    expect(typeof option.yAxis[1].axisLabel?.formatter).toBe('function')
    // formatter 行为：15800 → 1.6万
    expect((option.yAxis[0].axisLabel!.formatter as (v: number) => string)(15800)).toBe('1.6万')
    expect(option.xAxis.axisLabel?.interval).toBe('auto')
  })
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run tests/utils/financeChart.spec.ts`
Expected: FAIL — `axisLabel` 为 undefined。

- [ ] **Step 3: 扩展类型 + 加 formatter 与 interval**

`ChartOption` 的 `yAxis` 与 `xAxis` 类型扩展：

```ts
  xAxis: {
    type: string; data: string[]
    axisLine?: { lineStyle: { color: string } }
    axisLabel?: { interval: string | number }
  }
  yAxis: {
    type: string; alignTicks: boolean
    splitLine?: { show?: boolean; lineStyle: { color: string } }
    axisLabel?: { formatter: (v: number) => string }
  }[]
```

`buildChartOption` 的 `yAxis` 与 `xAxis` 改为：

```ts
    xAxis: {
      type: 'category', data: data.categories,
      axisLine: { lineStyle: { color: COLOR_AXIS } },
      axisLabel: { interval: 'auto' },
    },
    yAxis: [
      {
        type: 'value', alignTicks: true,
        axisLabel: { formatter: (v: number) => formatAxisAmount(v) },
        splitLine: { lineStyle: { color: COLOR_GRID } },
      },
      {
        type: 'value', alignTicks: true,
        axisLabel: { formatter: (v: number) => formatAxisAmount(v) },
        splitLine: { show: false },
      },
    ],
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run tests/utils/financeChart.spec.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/utils/financeChart.ts tests/utils/financeChart.spec.ts
git commit -m "feat: 坐标轴万元智能格式化，X 轴标签稀疏"
```

---

## Task 9: 浅色 tooltip 含净结余

**Files:**
- Modify: `src/utils/financeChart.ts`（tooltip、ChartOption 类型）
- Test: `tests/utils/financeChart.spec.ts`

- [ ] **Step 1: 写失败测试**

`describe('buildChartOption')` 新增：

```ts
  it('tooltip 为浅色卡片，formatter 含收入/支出/净结余/累计且金额万元化', () => {
    const data = {
      categories: ['26/08'],
      income: [15800], expense: [9200], cumSavings: [1234567],
    }
    const option = buildChartOption(data)

    expect(option.tooltip.backgroundColor).toBe('#ffffff')
    expect(option.tooltip.borderColor).toBe('#e2e8f0')
    expect(option.tooltip.textStyle?.color).toBe('#0f172a')

    const html = (option.tooltip.formatter as (p: Array<{ seriesName: string; value: number }>) => string)([
      { seriesName: '收入', value: 15800 },
      { seriesName: '支出', value: 9200 },
      { seriesName: '累计储蓄', value: 1234567 },
    ])
    expect(html).toContain('收入')
    expect(html).toContain('支出')
    expect(html).toContain('净结余')
    expect(html).toContain('累计')
    expect(html).toContain('1.6万')        // 收入 15800
    expect(html).toContain('9,200')        // 支出 9200（<1万 千分位）
    expect(html).toContain('123.5万')      // 累计 1234567
  })
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run tests/utils/financeChart.spec.ts`
Expected: FAIL — `option.tooltip.backgroundColor` 为 undefined（当前 tooltip 只有 trigger）。

- [ ] **Step 3: 扩展类型 + 实现浅色 tooltip formatter**

`ChartOption` 的 `tooltip` 类型扩展：

```ts
  tooltip: {
    trigger: string
    backgroundColor?: string
    borderColor?: string
    borderWidth?: number
    textStyle?: { color: string }
    formatter: (params: Array<{ seriesName: string; value: number }>) => string
  }
```

`buildChartOption` 的 `tooltip` 改为（formatter 内按 seriesName 取值，并用 formatAxisAmount 万元化；净结余 = 收入 − 支出）：

```ts
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#ffffff',
      borderColor: '#e2e8f0',
      borderWidth: 1,
      textStyle: { color: '#0f172a' },
      formatter: params => {
        const get = (name: string) => params.find(p => p.seriesName === name)?.value ?? 0
        const income = get('收入')
        const expense = get('支出')
        const cum = get('累计储蓄')
        const net = income - expense
        const netColor = net >= 0 ? '#c0504d' : '#5e8270'   // 盈余朱砂 / 赤字竹青
        const row = (label: string, val: number, color = '#0f172a') =>
          `<div style="display:flex;justify-content:space-between;gap:16px;font-size:12px;line-height:18px">`
          + `<span style="color:#64748b">${label}</span>`
          + `<span style="color:${color};font-weight:600">${formatAxisAmount(val)}</span></div>`
        return row('收入', income) + row('支出', expense)
          + row('净结余', net, netColor)
          + `<div style="height:1px;background:#e2e8f0;margin:4px 0"></div>`
          + row('累计储蓄', cum)
      },
    },
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run tests/utils/financeChart.spec.ts`
Expected: PASS。

- [ ] **Step 5: buildChartOption 完整最终态校对**

确认 `src/utils/financeChart.ts` 的 `buildChartOption` 与下方一致（如不一致，按此修正后再跑测试）：

```ts
export function buildChartOption(data: ChartData): ChartOption {
  return {
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#ffffff',
      borderColor: '#e2e8f0',
      borderWidth: 1,
      textStyle: { color: '#0f172a' },
      formatter: params => {
        const get = (name: string) => params.find(p => p.seriesName === name)?.value ?? 0
        const income = get('收入')
        const expense = get('支出')
        const cum = get('累计储蓄')
        const net = income - expense
        const netColor = net >= 0 ? '#c0504d' : '#5e8270'
        const row = (label: string, val: number, color = '#0f172a') =>
          `<div style="display:flex;justify-content:space-between;gap:16px;font-size:12px;line-height:18px">`
          + `<span style="color:#64748b">${label}</span>`
          + `<span style="color:${color};font-weight:600">${formatAxisAmount(val)}</span></div>`
        return row('收入', income) + row('支出', expense)
          + row('净结余', net, netColor)
          + `<div style="height:1px;background:#e2e8f0;margin:4px 0"></div>`
          + row('累计储蓄', cum)
      },
    },
    legend: { data: ['收入', '支出', '累计储蓄'] },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category', data: data.categories,
      axisLine: { lineStyle: { color: COLOR_AXIS } },
      axisLabel: { interval: 'auto' },
    },
    yAxis: [
      {
        type: 'value', alignTicks: true,
        axisLabel: { formatter: (v: number) => formatAxisAmount(v) },
        splitLine: { lineStyle: { color: COLOR_GRID } },
      },
      {
        type: 'value', alignTicks: true,
        axisLabel: { formatter: (v: number) => formatAxisAmount(v) },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: '收入', type: 'bar', yAxisIndex: 0, data: data.income,
        itemStyle: { color: COLOR_INCOME, borderRadius: [2, 2, 0, 0] },
        barCategoryGap: '40%',
      },
      {
        name: '支出', type: 'bar', yAxisIndex: 0, data: data.expense,
        itemStyle: { color: COLOR_EXPENSE, borderRadius: [2, 2, 0, 0] },
        barCategoryGap: '40%',
      },
      {
        name: '累计储蓄', type: 'line', yAxisIndex: 1, data: data.cumSavings,
        smooth: true, showSymbol: false,
        lineStyle: { color: COLOR_CUM, width: 2.5 },
        itemStyle: { color: COLOR_CUM },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(79,70,229,0.28)' },
              { offset: 1, color: 'rgba(79,70,229,0.02)' },
            ],
          },
        },
      },
    ],
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add src/utils/financeChart.ts tests/utils/financeChart.spec.ts
git commit -m "feat: tooltip 改浅色卡片，含净结余与万元格式"
```

---

## Task 10: FinanceChart 标题区当前累计值高亮

**Files:**
- Modify: `src/components/FinanceChart.vue`

- [ ] **Step 1: 加 computed 并在标题区展示**

`FinanceChart.vue` 的 `<script setup>` 中，import 与 computed 增加（在现有 import 之后）：

```ts
import { formatAxisAmount } from '../utils/financeChart'
```

在 `const chartData = computed(...)` 之后新增：

```ts
// 当前累计储蓄（取最末月），万元化展示，作为标题区高亮
const currentSavingsLabel = computed(() => {
  const last = props.results[props.results.length - 1]
  return last ? `¥ ${formatAxisAmount(last.cumSavings)}` : '—'
})
```

`<template>` 标题区（找到 `<h2 class="text-sm font-bold whitespace-nowrap">财务趋势图</h2>` 那一行）替换为：

```html
      <div class="flex items-baseline gap-2">
        <h2 class="text-sm font-bold whitespace-nowrap">财务趋势图</h2>
        <span class="text-xs text-neutral-400">累计储蓄</span>
        <span class="text-base font-bold text-brand-600">{{ currentSavingsLabel }}</span>
      </div>
```

- [ ] **Step 2: 验证 build + 全量测试**

Run: `npm run build && npm run test`
Expected: 构建成功；financeChart 相关测试全绿。

- [ ] **Step 3: Commit**

```bash
git add src/components/FinanceChart.vue
git commit -m "feat: 图表标题区高亮当前累计储蓄"
```

---

## Task 11: 全量验证与视觉走查

**Files:** 无代码改动（验证 + 收尾）

- [ ] **Step 1: 全量构建与测试**

Run: `npm run build && npm run test`
Expected: 构建成功；所有测试通过。

- [ ] **Step 2: 视觉走查（dev server）**

Run: `npm run dev`，在浏览器切到「图表」视图，逐项核对验收标准：
- 主线：累计储蓄为渐变面积 + 粗线，醒目；标题区显示「累计储蓄 ¥XXX万」。
- 收支：收入朱砂、支出竹青，正值并列双柱（圆角），无负轴镜像。
- 坐标轴：左右轴刻度为「X.X万 / X.X亿」，无裸长数字；仅左轴有淡横向网格。
- tooltip：悬停弹浅色卡片，含收入/支出/净结余/累计，金额万元化。
- X 轴：60 期标签稀疏不拥挤。
- 切回表格/对比：红绿 diff 为朱砂/竹青柔和色、与图表同色系；文字（竹青 600）可读；操作反馈（导入成功绿/失败红）不变。

- [ ] **Step 3: 可读性兜底（仅当竹青文字偏浅时）**

若走查发现表格 diff 的竹青文字对比度不足，把 `MonthlyTable.vue` / `ComparisonView.vue` 中 diff 文字 class 由 `text-negative-600` 提升为 `text-negative-700`（zhuqing-700 = `#4a6b5a`）。如改了，跑 `npm run test` 确认 ComparisonView 的 `text-positive-600` 断言（正向不受影响）仍通过，并 commit：

```bash
git commit -m "style: diff 文字竹青提至 700 阶保证可读"
```

- [ ] **Step 4: 最终提交（若有走查微调）**

无微调则跳过。完成。

---

## 自审清单（执行前已核对）

- **Spec coverage**：① 万格式 → Task 2/8；④ 面积主线 → Task 5/10；支出正值 → Task 3/6；配色同步 → Task 1/4；浅色 tooltip → Task 9；单网格 → Task 7；X 轴稀疏 → Task 8；标题高亮 → Task 10；验收 8 条 → Task 11 走查。全覆盖。
- **Placeholder**：无 TBD/TODO；每个代码 step 含完整代码段。
- **Type consistency**：`formatAxisAmount`、`buildChartData`、`buildChartOption`、`ChartSeries`/`ChartOption` 字段在各 Task 间一致；`COLOR_GRID` 由 `#e2e8f0` 改 `#eef2f7` 在 Task 4 一次定义、后续引用一致。
