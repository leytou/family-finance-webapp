# 图表易读性优化(上下两块)实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: 用 superpowers:subagent-driven-development(推荐)或 superpowers:executing-plans 逐 task 实现。步骤用 checkbox(`- [ ]`)跟踪。每个 task 遵循 TDD:先写失败测试 → 跑确认失败 → 最小实现 → 跑确认通过 → 提交。

**Goal:** 把财务趋势图从「单图双轴四系列」重构为「上下两块、共享时间轴」,消除双轴混淆与面积遮挡,关键数值直接标注,按月横轴做「月份+年份分层」。

**Architecture:** 单个 echarts 实例内布置**双 grid**(上块=存款/公积金余额趋势,下块=收入/支支柱)。series 用 `xAxisIndex/yAxisIndex` 绑定到对应 grid。`tooltip.axisPointer.link` 让上下块悬停联动。option 构建仍是纯函数 `buildChartOption`,新增第三参 `granularity` 控制标注/横轴分层。新增两个纯函数 `monthYearBoundaries`、`keyPointIndices` 供横轴分层与标注使用。

**Tech Stack:** Vue 3 + TypeScript、echarts 6.1.0(按需注册)、Vitest(`npm run test` = `vitest run`)。

**关联设计文档:** `docs/superpowers/specs/2026-06-22-chart-readability-design.md`

---

## File Structure

| 文件 | 职责 | 本计划改动 |
|---|---|---|
| `src/utils/financeChart.ts` | 图表数据与 option 构建(纯函数) | 重写 `buildChartOption` 为双 grid;新增 `monthYearBoundaries`、`keyPointIndices`;更新 `ChartSeries/ChartOption` 类型;`buildChartData` 不动 |
| `src/components/FinanceChart.vue` | 图表组件(单 echarts 实例) | `render()` 传 `granularity`;模板与生命周期不动 |
| `tests/utils/financeChart.spec.ts` | 纯函数测试 | 替换 `buildChartOption` 两个旧 describe 为双 grid 断言;新增标注/横轴/联动测试 |
| `tests/components/FinanceChart.spec.ts` | 组件测试 | 适配新 option 结构(series 顺序、`xAxis[1].data`) |

**不动的文件:** `src/composables/useCalculation.ts`、`src/types.ts`、表格组件、计算层。

---

## Task 1: 纯函数 `monthYearBoundaries`(年份分组)

按月 categories(如 `['26/01','26/02',...,'27/01']`)中,返回每个年份**首次出现**的索引(升序),供横轴年份标注与年份分隔竖线使用。

**Files:**
- Modify: `src/utils/financeChart.ts`
- Test: `tests/utils/financeChart.spec.ts`

- [ ] **Step 1: 写失败测试**

在 `tests/utils/financeChart.spec.ts` 顶部 import 加上 `monthYearBoundaries`,并在文件末尾追加 describe:

```ts
describe('monthYearBoundaries', () => {
  it('返回每个年份首次出现的索引(升序)', () => {
    const cats = ['26/01', '26/02', '26/12', '27/01', '27/03', '28/01']
    expect(monthYearBoundaries(cats)).toEqual([0, 3, 5])
  })
  it('单年 → 仅 [0]', () => {
    expect(monthYearBoundaries(['26/01', '26/12'])).toEqual([0])
  })
  it('空数组 → []', () => {
    expect(monthYearBoundaries([])).toEqual([])
  })
})
```

import 行改为(在第 3 行):

```ts
import { formatAxisLabel, buildChartData, buildChartOption, formatAxisAmount, monthYearBoundaries } from '../../src/utils/financeChart'
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/utils/financeChart.spec.ts`
Expected: FAIL,`monthYearBoundaries is not exported`(函数尚未定义)。

- [ ] **Step 3: 实现**

在 `src/utils/financeChart.ts` 中(`formatAxisLabel` 函数附近)新增:

```ts
/**
 * 按月 categories(YY/MM)→ 每个年份首次出现的索引(升序)。
 * 供按月横轴的「年份标注」与「年份分隔竖线」使用。空数组返回空。
 */
export function monthYearBoundaries(categories: string[]): number[] {
  if (categories.length === 0) return []
  const bounds: number[] = []
  let lastYear = ''
  categories.forEach((cat, i) => {
    const year = cat.slice(0, 2)
    if (year !== lastYear) {
      bounds.push(i)
      lastYear = year
    }
  })
  return bounds
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run tests/utils/financeChart.spec.ts`
Expected: PASS(含新增 3 条 `monthYearBoundaries` 用例)。

- [ ] **Step 5: 提交**

```bash
git add src/utils/financeChart.ts tests/utils/financeChart.spec.ts
git commit -m "feat(chart): 新增 monthYearBoundaries 按月年份分组纯函数"
```

---

## Task 2: 纯函数 `keyPointIndices`(关键点索引)

返回数值数组的「起点 / 最低点 / 终点」索引(去重升序),供上块存款折线按月只标关键点数值使用。

**Files:**
- Modify: `src/utils/financeChart.ts`
- Test: `tests/utils/financeChart.spec.ts`

- [ ] **Step 1: 写失败测试**

import 加 `keyPointIndices`,文件末尾追加:

```ts
describe('keyPointIndices', () => {
  it('返回起点/最低点/终点索引(升序去重)', () => {
    expect(keyPointIndices([50000, 40000, 47000, 61000])).toEqual([0, 1, 3])
  })
  it('单元素 → [0]', () => {
    expect(keyPointIndices([5])).toEqual([0])
  })
  it('空数组 → []', () => {
    expect(keyPointIndices([])).toEqual([])
  })
  it('全相同 → [0, 末位]', () => {
    expect(keyPointIndices([3, 3, 3])).toEqual([0, 2])
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/utils/financeChart.spec.ts`
Expected: FAIL,`keyPointIndices is not exported`。

- [ ] **Step 3: 实现**

在 `src/utils/financeChart.ts`(`monthYearBoundaries` 附近)新增:

```ts
/**
 * 数值序列 → [起点, 最低点, 终点] 索引(升序去重)。
 * 最低点取第一个最小值的位置;空数组返回空。
 */
export function keyPointIndices(values: number[]): number[] {
  if (values.length === 0) return []
  let minIdx = 0
  values.forEach((v, i) => { if (v < values[minIdx]) minIdx = i })
  return Array.from(new Set([0, minIdx, values.length - 1])).sort((a, b) => a - b)
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run tests/utils/financeChart.spec.ts`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/utils/financeChart.ts tests/utils/financeChart.spec.ts
git commit -m "feat(chart): 新增 keyPointIndices 关键点索引纯函数"
```

---

## Task 3: 重构 `buildChartOption` 为双 grid 核心结构

把单图双轴改为「上下双 grid + 各自单轴」。series 用 `xAxisIndex/yAxisIndex` 归位:存款/公积金→上块(gridIndex 0),收入/支出→下块(gridIndex 1)。本 task 建立**骨架**:双 grid、单轴、series 归位、tooltip formatter 不变;**暂不含**数值标注(Task 4)、横轴分层(Task 5)、悬停联动(Task 6)。同时把组件 `render()` 传入 `granularity`。

**Files:**
- Modify: `src/utils/financeChart.ts`(类型 + `buildChartOption` + 抽出 `tooltipFormatter`)
- Modify: `src/components/FinanceChart.vue:37-40`(`render` 调用)
- Test: `tests/utils/financeChart.spec.ts`(替换两个旧 describe)
- Test: `tests/components/FinanceChart.spec.ts`(适配新结构)

- [ ] **Step 1: 替换 `buildChartOption` 相关测试为双 grid 断言**

在 `tests/utils/financeChart.spec.ts` 中,**删除**现有 `describe('buildChartOption · 退化模式（fundEnabled=false）', ...)` 整块(第 87–184 行)和 `describe('fund 双线', ...)` 整块(第 186–227 行),用下面的两个新 describe 替换:

```ts
describe('buildChartOption · 双 grid 结构', () => {
  const baseData = () => ({
    categories: ['26/01'], income: [10000], expense: [6000], cumSavings: [50000], fundBalance: [0],
  })

  it('两个 grid(上下块);存款归上块轴、收支归下块轴', () => {
    const opt = buildChartOption(baseData(), false, 'month')
    expect(opt.grid).toHaveLength(2)
    const cum = opt.series.find(s => s.name === '存款')!
    const income = opt.series.find(s => s.name === '收入')!
    const expense = opt.series.find(s => s.name === '支出')!
    expect(cum.xAxisIndex).toBe(0); expect(cum.yAxisIndex).toBe(0)
    expect(income.xAxisIndex).toBe(1); expect(income.yAxisIndex).toBe(1)
    expect(expense.xAxisIndex).toBe(1); expect(expense.yAxisIndex).toBe(1)
  })

  it('yAxis 仅两个单轴:上块「余额」、下块「金额」', () => {
    const opt = buildChartOption(baseData(), false, 'month')
    expect(opt.yAxis).toHaveLength(2)
    expect(opt.yAxis[0].name).toBe('余额')
    expect(opt.yAxis[1].name).toBe('金额')
    expect(opt.yAxis[0].gridIndex).toBe(0)
    expect(opt.yAxis[1].gridIndex).toBe(1)
  })

  it('存款为渐变面积主线;收支柱顶部圆角', () => {
    const opt = buildChartOption(baseData(), false, 'month')
    const cum = opt.series.find(s => s.name === '存款')!
    expect(cum.areaStyle).toBeDefined()
    expect(cum.lineStyle?.width).toBe(2.5)
    expect(opt.series.find(s => s.name === '收入')!.itemStyle?.borderRadius).toEqual([2, 2, 0, 0])
  })

  it('配色不变:收入朱砂/支出竹青/存款靛蓝', () => {
    const opt = buildChartOption(baseData(), false, 'month')
    expect(opt.series.find(s => s.name === '收入')!.itemStyle?.color).toBe('#c0504d')
    expect(opt.series.find(s => s.name === '支出')!.itemStyle?.color).toBe('#6b8e7b')
    expect(opt.series.find(s => s.name === '存款')!.itemStyle?.color).toBe('#4f46e5')
  })

  it('tooltip formatter 仍含收入/支出/结余/存款且金额万元化;退化模式不含公积金', () => {
    const data = { categories: ['26/08'], income: [15800], expense: [9200], cumSavings: [1234567], fundBalance: [0] }
    const opt = buildChartOption(data, false, 'month')
    const html = opt.tooltip.formatter([
      { seriesName: '收入', value: 15800 }, { seriesName: '支出', value: 9200 }, { seriesName: '存款', value: 1234567 },
    ])
    expect(html).toContain('收入'); expect(html).toContain('结余'); expect(html).toContain('123.5万')
    expect(html).not.toContain('公积金余额')
  })

  it('赤字场景:净结余用竹青色 + 千分位负数', () => {
    const data = { categories: ['26/08'], income: [5000], expense: [9000], cumSavings: [1234567], fundBalance: [0] }
    const opt = buildChartOption(data, false, 'month')
    const html = opt.tooltip.formatter([
      { seriesName: '收入', value: 5000 }, { seriesName: '支出', value: 9000 }, { seriesName: '存款', value: 1234567 },
    ])
    expect(html).toContain('#5e8270')
    expect(html).toContain('-4,000')
  })
})

describe('buildChartOption · fund 双线', () => {
  it('fundEnabled=true 含存款与公积金余额两线,均归上块轴;配色正确', () => {
    const opt = buildChartOption(buildChartData([], 'month'), true, 'month')
    const names = opt.series.map(s => s.name)
    expect(names).toEqual(['存款', '公积金余额', '收入', '支出'])
    expect(opt.legend.data).toEqual(['收入', '支出', '存款', '公积金余额'])
    const fund = opt.series.find(s => s.name === '公积金余额')!
    expect(fund.xAxisIndex).toBe(0); expect(fund.yAxisIndex).toBe(0)
    expect(fund.itemStyle?.color).toBe('#d97706')
  })

  it('fundEnabled=false 不含公积金余额', () => {
    const opt = buildChartOption(buildChartData([], 'month'), false, 'month')
    expect(opt.series.map(s => s.name)).not.toContain('公积金余额')
  })

  it('fundEnabled=true tooltip 含公积金余额行', () => {
    const opt = buildChartOption(buildChartData([], 'month'), true, 'month')
    const html = opt.tooltip.formatter([
      { seriesName: '收入', value: 10000 }, { seriesName: '支出', value: 6000 },
      { seriesName: '存款', value: 80000 }, { seriesName: '公积金余额', value: 30000 },
    ])
    expect(html).toContain('公积金余额'); expect(html).toContain('3万')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/utils/financeChart.spec.ts`
Expected: FAIL,新的双 grid 断言不通过(实现仍是旧单 grid,`buildChartOption` 目前只收两参)。

- [ ] **Step 3: 重写类型与 `buildChartOption`**

在 `src/utils/financeChart.ts` 中,把现有 `ChartSeries`、`ChartOption` 两个 interface 替换为下面三段(新增 `ChartAxis`,并给 `ChartSeries` 加 `xAxisIndex` 与 `label`;`ChartOption` 的 `grid/xAxis/yAxis` 全部改为数组,`tooltip` 加 `axisPointer`):

```ts
export interface ChartSeries {
  name: string
  type: 'bar' | 'line'
  data: number[]
  xAxisIndex?: number
  yAxisIndex?: number
  itemStyle?: { color: string; borderRadius?: number[] }
  lineStyle?: { color: string; width?: number }
  areaStyle?: { color: unknown }
  smooth?: boolean
  showSymbol?: boolean
  barCategoryGap?: string
  label?: {
    show: boolean
    position?: string
    color?: string
    fontSize?: number
    formatter: (p: { dataIndex: number; value: number }) => string
  }
}

export interface ChartAxis {
  type: string
  gridIndex?: number
  data?: string[]
  name?: string
  alignTicks?: boolean
  offset?: number
  axisLine?: { show?: boolean; lineStyle?: { color: string } }
  axisTick?: { show?: boolean }
  axisLabel?: {
    show?: boolean
    interval?: string | number | ((index: number) => boolean)
    formatter?: unknown
  }
  splitLine?: { show?: boolean; interval?: unknown; lineStyle?: { color: string; type?: string } }
}

export interface ChartOption {
  tooltip: {
    trigger: string
    backgroundColor?: string
    borderColor?: string
    borderWidth?: number
    textStyle?: { color: string }
    axisPointer?: { link: Array<{ xAxisIndex: string }> }
    formatter: (params: Array<{ seriesName: string; value: number }>) => string
  }
  legend: { data: string[] }
  grid: Array<{ left: string; right: string; top: string; height: string }>
  xAxis: ChartAxis[]
  yAxis: ChartAxis[]
  series: ChartSeries[]
}
```

然后把现有 `buildChartOption` 整个函数体替换为下面的双 grid 版本,并把原内联 tooltip formatter 提取为 `tooltipFormatter`(DRY,后续 task 不改它):

```ts
/** tooltip 明细:收入/支出/结余/存款(+公积金余额),金额万元化;结余盈余朱砂/赤字竹青。 */
function tooltipFormatter(fundEnabled: boolean) {
  return (params: Array<{ seriesName: string; value: number }>) => {
    const get = (name: string) => params.find(p => p.seriesName === name)?.value ?? 0
    const income = get('收入')
    const expense = get('支出')
    const total = get('存款')
    const fund = get('公积金余额')
    const net = income - expense
    const netColor = net >= 0 ? COLOR_INCOME : COLOR_NET_NEG
    const row = (label: string, val: number, color = '#0f172a') =>
      `<div style="display:flex;justify-content:space-between;gap:16px;font-size:12px;line-height:18px">`
      + `<span style="color:#64748b">${label}</span>`
      + `<span style="color:${color};font-weight:600">${formatAxisAmount(val)}</span></div>`
    let html = row('收入', income) + row('支出', expense)
      + row('结余', net, netColor)
      + `<div style="height:1px;background:#e2e8f0;margin:4px 0"></div>`
      + row('存款', total)
    if (fundEnabled) html += row('公积金余额', fund)
    return html
  }
}

/**
 * 由 ChartData 构造 ECharts 双 grid option：
 * 上块(gridIndex 0)= 存款 + 公积金余额 折线(单「余额」轴);
 * 下块(gridIndex 1)= 收入 + 支出 柱(单「金额」轴)。
 * granularity 控制标注/横轴分层(标注=Task4,分层=Task5)。字段名遵循 ECharts option 规范,组件内以 `as any` 桥接。
 */
export function buildChartOption(data: ChartData, fundEnabled: boolean, granularity: Granularity = 'month'): ChartOption {
  const legendData = fundEnabled
    ? ['收入', '支出', '存款', '公积金余额']
    : ['收入', '支出', '存款']

  const series: ChartSeries[] = [
    {
      name: '存款', type: 'line', xAxisIndex: 0, yAxisIndex: 0, data: data.cumSavings,
      smooth: true, showSymbol: false,
      lineStyle: { color: COLOR_CUM, width: 2.5 }, itemStyle: { color: COLOR_CUM },
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
  ]

  if (fundEnabled) {
    series.push({
      name: '公积金余额', type: 'line', xAxisIndex: 0, yAxisIndex: 0, data: data.fundBalance,
      smooth: true, showSymbol: false,
      lineStyle: { color: COLOR_FUND }, itemStyle: { color: COLOR_FUND },
    })
  }

  series.push(
    {
      name: '收入', type: 'bar', xAxisIndex: 1, yAxisIndex: 1, data: data.income,
      itemStyle: { color: COLOR_INCOME, borderRadius: [2, 2, 0, 0] }, barCategoryGap: '40%',
    },
    {
      name: '支出', type: 'bar', xAxisIndex: 1, yAxisIndex: 1, data: data.expense,
      itemStyle: { color: COLOR_EXPENSE, borderRadius: [2, 2, 0, 0] }, barCategoryGap: '40%',
    },
  )

  return {
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#ffffff', borderColor: '#e4e8f1', borderWidth: 1,
      textStyle: { color: '#0f172a' },
      formatter: tooltipFormatter(fundEnabled),
    },
    legend: { data: legendData },
    grid: [
      { left: '3%', right: '4%', top: '6%', height: '54%' },
      { left: '3%', right: '4%', top: '66%', height: '26%' },
    ],
    xAxis: [
      { type: 'category', gridIndex: 0, data: data.categories,
        axisLine: { lineStyle: { color: COLOR_AXIS } }, axisLabel: { show: false }, axisTick: { show: false } },
      { type: 'category', gridIndex: 1, data: data.categories,
        axisLine: { lineStyle: { color: COLOR_AXIS } }, axisLabel: { interval: 'auto' } },
    ],
    yAxis: [
      { type: 'value', gridIndex: 0, name: '余额', alignTicks: true,
        axisLabel: { formatter: (v: number) => formatAxisAmount(v) }, splitLine: { lineStyle: { color: COLOR_GRID } } },
      { type: 'value', gridIndex: 1, name: '金额', alignTicks: true,
        axisLabel: { formatter: (v: number) => formatAxisAmount(v) }, splitLine: { lineStyle: { color: COLOR_GRID } } },
    ],
    series,
  }
}
```

> 注意:`formatAxisLabel`、`formatAxisAmount`、`buildChartData`、配色常量(`COLOR_*`)、`ChartData`、`Granularity` interface 均**保持不变**,勿动。

- [ ] **Step 4: 组件 `render()` 传入 `granularity`**

在 `src/components/FinanceChart.vue` 第 37–40 行的 `render` 函数,把 `buildChartOption` 调用补上第三参:

```ts
function render() {
  // option 字段遵循 ECharts 规范，用 as any 桥接第三方严格类型
  chart?.setOption(buildChartOption(chartData.value, fundEnabled.value, granularity.value) as unknown as echarts.EChartsCoreOption)
}
```

- [ ] **Step 5: 更新组件测试适配新结构**

在 `tests/components/FinanceChart.spec.ts`:

5a. 第一个用例「挂载后初始化图表并传入三系列 option」(第 56–65 行),series 顺序变为上块在前,把期望改为:

```ts
    const option = mockInstance.setOption.mock.calls[0][0] as { series: { name: string }[] }
    expect(option.series.map(s => s.name)).toEqual(['存款', '收入', '支出'])
```

5b. 用例「点击「按年」切换粒度并以年份为 x 轴刷新 option」(第 82–95 行),`xAxis` 现为数组,断言改为取下块轴:

```ts
    const option = mockInstance.setOption.mock.calls[0][0] as { xAxis: Array<{ data: string[] }> }
    expect(option.xAxis[1].data).toEqual(['2026'])
```

- [ ] **Step 6: 跑全部测试确认通过**

Run: `npm run test`
Expected: PASS(含 financeChart.spec 与 FinanceChart.spec 全部用例)。

- [ ] **Step 7: 提交**

```bash
git add src/utils/financeChart.ts src/components/FinanceChart.vue tests/utils/financeChart.spec.ts tests/components/FinanceChart.spec.ts
git commit -m "refactor(chart): buildChartOption 重构为上下双 grid 单轴结构"
```

---

## Task 4: 关键数值标注(上块折线关键点 + 下块按年柱顶)

上块存款折线:按月只标「起点/最低点/终点」(用 `keyPointIndices`),按年全点。下块收支柱:按年柱顶标数值,按月不标(避免 67 个柱打架)。

**Files:**
- Modify: `src/utils/financeChart.ts`(`buildChartOption` 内 series 加 `label`)
- Test: `tests/utils/financeChart.spec.ts`

- [ ] **Step 1: 写失败测试**

在 `tests/utils/financeChart.spec.ts` 末尾追加:

```ts
describe('buildChartOption · 数值标注', () => {
  const monthData = {
    categories: ['26/01', '26/02', '26/03', '26/04'],
    income: [10000, 10000, 10000, 10000],
    expense: [6000, 9000, 6000, 6000],
    cumSavings: [50000, 40000, 47000, 61000],
    fundBalance: [0, 0, 0, 0],
  }

  it('按月:存款线仅在关键点(0/1/3)标注数值,其余为空字符串', () => {
    const opt = buildChartOption(monthData, false, 'month')
    const cum = opt.series.find(s => s.name === '存款')!
    const fmt = cum.label!.formatter
    expect(fmt({ dataIndex: 0, value: 50000 })).toBe('5万')
    expect(fmt({ dataIndex: 1, value: 40000 })).toBe('4万')
    expect(fmt({ dataIndex: 2, value: 47000 })).toBe('')
    expect(fmt({ dataIndex: 3, value: 61000 })).toBe('6.1万')
  })

  it('按月:收支柱不标注(label 不显示)', () => {
    const opt = buildChartOption(monthData, false, 'month')
    const income = opt.series.find(s => s.name === '收入')!
    expect(income.label?.show ?? false).toBe(false)
  })

  it('按年:存款线每个点都标注', () => {
    const yearData = {
      categories: ['2026', '2027'], income: [120000, 130000], expense: [80000, 70000],
      cumSavings: [400000, 610000], fundBalance: [0, 0],
    }
    const opt = buildChartOption(yearData, false, 'year')
    const cum = opt.series.find(s => s.name === '存款')!
    expect(cum.label!.formatter({ dataIndex: 0, value: 400000 })).toBe('40万')
    expect(cum.label!.formatter({ dataIndex: 1, value: 610000 })).toBe('61万')
  })

  it('按年:收支柱顶标注数值(label 显示)', () => {
    const yearData = {
      categories: ['2026'], income: [120000], expense: [80000], cumSavings: [400000], fundBalance: [0],
    }
    const opt = buildChartOption(yearData, false, 'year')
    const income = opt.series.find(s => s.name === '收入')!
    expect(income.label?.show).toBe(true)
    expect(income.label!.formatter({ dataIndex: 0, value: 120000 })).toBe('12万')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/utils/financeChart.spec.ts`
Expected: FAIL,标注相关断言不通过(series 还没 `label`)。

- [ ] **Step 3: 实现**

在 `src/utils/financeChart.ts` 的 `buildChartOption` 内,`const series: ChartSeries[] = [` 之前插入关键点与标注辅助,并给存款线与收支柱加 `label`:

```ts
  const isMonth = granularity === 'month'
  // 存款线标注点:按月仅起点/最低/终点,按年全点
  const cumKey = isMonth
    ? keyPointIndices(data.cumSavings)
    : data.cumSavings.map((_, i) => i)
  const cumLabelFormatter = (p: { dataIndex: number; value: number }) =>
    cumKey.includes(p.dataIndex) ? formatAxisAmount(p.value) : ''
  // 下块收支柱:按年柱顶标数值,按月不标
  const barLabel = isMonth
    ? undefined
    : { show: true, position: 'top', fontSize: 10, formatter: (p: { dataIndex: number; value: number }) => formatAxisAmount(p.value) }
```

然后修改存款 series,追加 `label` 字段(紧接其 `areaStyle` 之后):

```ts
      label: { show: true, position: 'top', color: COLOR_CUM, fontSize: 10, formatter: cumLabelFormatter },
```

收入、支出两个柱 series 各追加 `label: barLabel`(与 `barCategoryGap` 同级)。

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run tests/utils/financeChart.spec.ts`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/utils/financeChart.ts tests/utils/financeChart.spec.ts
git commit -m "feat(chart): 存款线关键点与按年柱顶数值标注"
```

---

## Task 5: 按月横轴「月份 + 年份分层」与年份分隔竖线

按月:下块横轴标签显示**月份**(去前导零,如 `3`、`12`),再下沉一层在每年首月标**年份**(如 `2026`);上下两个 grid 的 x 轴在年份边界画淡色竖线分隔。按年:横轴保持单层年份,不变。

**Files:**
- Modify: `src/utils/financeChart.ts`(`buildChartOption` 内 `xAxis` 分支)
- Test: `tests/utils/financeChart.spec.ts`

- [ ] **Step 1: 写失败测试**

在 `tests/utils/financeChart.spec.ts` 末尾追加(`formatter` 为 `unknown`,需 `as` 调用):

```ts
describe('buildChartOption · 按月横轴分层', () => {
  const monthData = {
    categories: ['26/11', '26/12', '27/01', '27/02'],
    income: [10000, 10000, 10000, 10000],
    expense: [6000, 6000, 6000, 6000],
    cumSavings: [50000, 55000, 60000, 65000],
    fundBalance: [0, 0, 0, 0],
  }

  it('按月:下块月份轴 formatter 把 26/03 → 3(去前导零)', () => {
    const opt = buildChartOption(monthData, false, 'month')
    const monthFmt = opt.xAxis[1].axisLabel!.formatter as (val: string, idx: number) => string
    expect(monthFmt('26/03', 0)).toBe('3')
    expect(monthFmt('26/12', 0)).toBe('12')
  })

  it('按月:存在第三个 xAxis(年份辅助轴),仅每年首月显示年份,其余空', () => {
    const opt = buildChartOption(monthData, false, 'month')
    expect(opt.xAxis[2]).toBeDefined()
    expect(opt.xAxis[2].gridIndex).toBe(1)
    const yearFmt = opt.xAxis[2].axisLabel!.formatter as (val: string, idx: number) => string
    expect(yearFmt('26/11', 0)).toBe('2026')
    expect(yearFmt('26/12', 1)).toBe('')
    expect(yearFmt('27/01', 2)).toBe('2027')
    expect(yearFmt('27/02', 3)).toBe('')
  })

  it('按月:上下 x 轴在年份边界(0、2)有分隔竖线,非边界不画', () => {
    const opt = buildChartOption(monthData, false, 'month')
    const top = opt.xAxis[0].splitLine!.interval as (idx: number) => boolean
    const bottom = opt.xAxis[1].splitLine!.interval as (idx: number) => boolean
    expect(top(0)).toBe(true); expect(top(1)).toBe(false); expect(top(2)).toBe(true)
    expect(bottom(0)).toBe(true); expect(bottom(2)).toBe(true); expect(bottom(3)).toBe(false)
  })

  it('按年:不产生年份辅助轴(仅 2 个 xAxis)', () => {
    const yearData = {
      categories: ['2026', '2027'], income: [1, 1], expense: [1, 1], cumSavings: [1, 1], fundBalance: [0, 0],
    }
    const opt = buildChartOption(yearData, false, 'year')
    expect(opt.xAxis).toHaveLength(2)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/utils/financeChart.spec.ts`
Expected: FAIL,横轴分层断言不通过。

- [ ] **Step 3: 实现**

在 `src/utils/financeChart.ts` 的 `buildChartOption` 内,把当前 `xAxis: [...]` 整段替换为(按月加月份 formatter、年份辅助轴、splitLine;按年保持原样):

```ts
    xAxis: isMonth
      ? [
          // 上块类目轴:不显示标签,但在年份边界画分隔竖线(与下块对齐 → 视觉连贯)
          { type: 'category', gridIndex: 0, data: data.categories,
            axisLine: { lineStyle: { color: COLOR_AXIS } }, axisLabel: { show: false }, axisTick: { show: false },
            splitLine: { show: true, interval: (i: number) => yearBounds.includes(i), lineStyle: { color: COLOR_AXIS, type: 'dashed' } } },
          // 下块类目轴:显示月份(去前导零)
          { type: 'category', gridIndex: 1, data: data.categories,
            axisLine: { lineStyle: { color: COLOR_AXIS } }, axisLabel: { interval: 'auto', formatter: (val: string) => String(Number(val.slice(3, 5))) },
            splitLine: { show: true, interval: (i: number) => yearBounds.includes(i), lineStyle: { color: COLOR_AXIS, type: 'dashed' } } },
          // 年份辅助轴(下沉一层):仅每年首月显示年份
          { type: 'category', gridIndex: 1, data: data.categories, offset: 28,
            axisLine: { show: false }, axisTick: { show: false },
            axisLabel: { interval: 0, formatter: (val: string, i: number) => yearBounds.includes(i) ? `20${val.slice(0, 2)}` : '' } },
        ]
      : [
          { type: 'category', gridIndex: 0, data: data.categories,
            axisLine: { lineStyle: { color: COLOR_AXIS } }, axisLabel: { show: false }, axisTick: { show: false } },
          { type: 'category', gridIndex: 1, data: data.categories,
            axisLine: { lineStyle: { color: COLOR_AXIS } }, axisLabel: { interval: 'auto' } },
        ],
```

并在 `buildChartOption` 顶部(`const isMonth = ...` 之后)加上 `yearBounds`:

```ts
  const yearBounds = isMonth ? monthYearBoundaries(data.categories) : []
```

> 说明:`COLOR_AXIS` 已存在(轴灰)。年份 `'20' + YY` 对 2000 年代数据成立(项目数据均为 2000 年后)。

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run tests/utils/financeChart.spec.ts`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/utils/financeChart.ts tests/utils/financeChart.spec.ts
git commit -m "feat(chart): 按月横轴月份+年份分层与年份分隔竖线"
```

---

## Task 6: 悬停上下联动(axisPointer link)

鼠标悬停某月/某年时,上下两块同时高亮同一时间点。在 `tooltip.axisPointer.link` 把所有 xAxis 联动。

**Files:**
- Modify: `src/utils/financeChart.ts`(`buildChartOption` 的 `tooltip`)
- Test: `tests/utils/financeChart.spec.ts`

- [ ] **Step 1: 写失败测试**

在 `tests/utils/financeChart.spec.ts` 末尾追加:

```ts
describe('buildChartOption · 悬停联动', () => {
  it('tooltip.axisPointer.link 联动所有 xAxis(上下块同步)', () => {
    const data = { categories: ['26/01'], income: [1], expense: [1], cumSavings: [1], fundBalance: [0] }
    const opt = buildChartOption(data, false, 'month')
    expect(opt.tooltip.axisPointer?.link).toEqual([{ xAxisIndex: 'all' }])
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/utils/financeChart.spec.ts`
Expected: FAIL,`axisPointer` 为 undefined。

- [ ] **Step 3: 实现**

在 `src/utils/financeChart.ts` 的 `buildChartOption` 返回对象里,`tooltip` 内 `formatter:` 行之前插入 `axisPointer`:

```ts
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#ffffff', borderColor: '#e4e8f1', borderWidth: 1,
      textStyle: { color: '#0f172a' },
      axisPointer: { link: [{ xAxisIndex: 'all' }] },
      formatter: tooltipFormatter(fundEnabled),
    },
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run tests/utils/financeChart.spec.ts`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/utils/financeChart.ts tests/utils/financeChart.spec.ts
git commit -m "feat(chart): 悬停上下两块联动高亮同一时间点"
```

---

## Task 7: 浏览器手动验证 + 全量回归

**Files:** 无代码改动(仅运行验证)。

- [ ] **Step 1: 全量测试**

Run: `npm run test`
Expected: 全部 PASS。

- [ ] **Step 2: 类型检查 + 构建**

Run: `npm run build`
Expected: 构建成功(vue-tsc 无类型错误)。

- [ ] **Step 3: 浏览器验证(开发服务器)**

确保 `npm run dev` 已运行(默认 http://localhost:5173/)。打开页面 → 顶部切换到「图表」视图,逐项核对:

1. 图表分**上下两块**,上块占大头、下块较矮,共用时间轴、上下对齐。
2. 上块:**存款**折线(蓝、带渐变面积、加粗)+ **公积金余额**折线(琥珀;关闭公积金参数后该线消失);只有一根左侧「余额」轴。
3. 下块:**收入**(朱砂)**支出**(竹青)两柱;只有一根左侧「金额」轴。
4. 按月:存款线上能看到起点/最低点/终点的数值标签;横轴上层是月份、下层在每年开始标年份、年份交界有淡色虚线;鼠标悬停某月时上下两块同时出竖线。
5. 切「按年」:上下两块同步切换为年度;每年存款点都有数值;柱顶有数值;横轴只有年份一层。
6. 鼠标悬停:提示卡显示 收入/支出/结余/存款(+公积金余额),金额万元化,结余盈余朱砂、赤字竹青。
7. 切换「参数」里的公积金开关、改起止月份、改收益率 → 图表随之正确刷新。

> 若某项不符,回到对应 Task 修正后再验证。验证通过后无需额外提交(代码已在前序 task 提交)。

---

## Self-Review(写计划后自检)

**1. Spec 覆盖:**
- 拆上下两块 → Task 3 ✓
- 上块存款+公积金、单「余额」轴、关键点标数值 → Task 3(结构)+ Task 4(标注)✓
- 下块收入/支支柱、单「金额」轴、按年标数值 → Task 3 + Task 4 ✓
- 按月横轴月份+年份分层 + 分隔竖线 → Task 5 ✓
- 悬停上下联动 → Task 6 ✓
- 标题区「存款 ¥xx」保留 → 不改组件标题区,既有逻辑保持(取最末月 cumSavings),✓
- 「按月/按年」切换作用于两块 → 组件传 granularity(Task 3 Step 4)+ Task 7 验证 ✓
- 不动计算层/表格 → File Structure 明确 ✓

**2. 占位符扫描:** 无 TBD/TODO;每步含完整代码或确切命令。

**3. 类型一致性:**
- `ChartSeries.xAxisIndex/yAxisIndex/label`、`ChartAxis`、`ChartOption.grid/xAxis/yAxis/tooltip.axisPointer` 在 Task 3 定义后,Task 4/5/6 使用的字段(label、splitLine.interval、axisPointer.link)均已在前序类型中声明 ✓
- `buildChartOption(data, fundEnabled, granularity)` 签名在 Task 3 确定,组件调用(Task 3 Step 4)与后续 task 一致 ✓
- `monthYearBoundaries`、`keyPointIndices` 在 Task 1/2 定义,Task 5/4 使用 ✓

**4. 歧义检查:** 标注策略(按月关键 3 点、按年全点、柱按年标按月不标)已明确并落到测试 ✓
