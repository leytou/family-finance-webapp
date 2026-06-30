# 移除界面「总资产」展示 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把「总资产（存款+公积金）」从所有界面展示中撤掉；图表主曲线由「总资产」回归为「存款」；计算层 `totalAssets` 字段保留不动。

**Architecture:** 纯展示层删除 + 图表 option 语义调整。三个改动点互相独立，按「图表 → 月度表 → 年度表」顺序逐个提交，每个 task 内部自洽（TS 编译通过、测试通过）。计算逻辑、`MonthResult.totalAssets`、`aggregateByYear`、`monthlyAudit` 不变量全程不动。

**Tech Stack:** Vue 3 (Composition API + TypeScript) + UnoCSS + Vitest；图表 ECharts；纯函数 `buildChartData` / `buildChartOption`。

**设计依据:** `docs/superpowers/specs/2026-06-16-remove-total-assets-design.md`

---

## Task 1: 图表主线「总资产」→「存款」

**Files:**
- Modify: `src/utils/financeChart.ts`（`ChartData` 删 `totalAssets`、`buildChartData` 两处不再产出 `totalAssets`、`buildChartOption` 主线与 legend 与 tooltip 改「存款」+ `cumSavings`）
- Modify: `src/components/FinanceChart.vue`（标题高亮取 `cumSavings`、文字「总资产」→「存款」）
- Test: `tests/utils/financeChart.spec.ts`
- Test: `tests/components/FinanceChart.spec.ts`

- [ ] **Step 1: 改 `financeChart.spec.ts` 为「存款」预期（红灯）**

`buildChartData` 两个用例的 `toEqual` 删去 `totalAssets` 行：

`tests/utils/financeChart.spec.ts:62-69`（按月）
```ts
    expect(buildChartData(results, 'month')).toEqual({
      categories: ['26/01', '26/02'],
      income: [10000, 10000],
      expense: [6000, 6000],
      cumSavings: [50000, 55000],
      fundBalance: [0, 0],
    })
```
`tests/utils/financeChart.spec.ts:78-85`（按年）删 `totalAssets: [110000, 120000]`。

退化模式 `baseData()`（`financeChart.spec.ts:91-98`）删 `totalAssets: [50000]`。

三系列用例（`financeChart.spec.ts:100-115`）改名与断言：
```ts
  it('三系列：收入/支出走左轴，存款走右轴；数据与配色正确', () => {
    const option = buildChartOption(baseData(), false)

    expect(option.series.map(s => s.name)).toEqual(['收入', '支出', '存款'])
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
    expect(option.legend.data).toEqual(['收入', '支出', '存款'])
  })

  it('存款为渐变面积主线：含 areaStyle 与 2.5px 粗线', () => {
    const main = buildChartOption(baseData(), false).series[2]

    expect(main.areaStyle).toBeDefined()
    expect(main.areaStyle?.color).toBeDefined()
    expect(main.lineStyle?.width).toBe(2.5)
  })
```

tooltip 用例（`financeChart.spec.ts:153-186`）——`seriesName` 与断言由「总资产」改「存款」，内联 `data` 删 `totalAssets`：
```ts
  it('tooltip 为浅色卡片，formatter 含收入/支出/净结余/存款且金额万元化', () => {
    const data = {
      categories: ['26/08'],
      income: [15800], expense: [9200], cumSavings: [1234567], fundBalance: [0],
    }
    const option = buildChartOption(data, false)

    expect(option.tooltip.backgroundColor).toBe('#ffffff')
    expect(option.tooltip.borderColor).toBe('#e2e8f0')
    expect(option.tooltip.textStyle?.color).toBe('#0f172a')

    const html = (option.tooltip.formatter as (p: Array<{ seriesName: string; value: number }>) => string)([
      { seriesName: '收入', value: 15800 },
      { seriesName: '支出', value: 9200 },
      { seriesName: '存款', value: 1234567 },
    ])
    expect(html).toContain('收入')
    expect(html).toContain('支出')
    expect(html).toContain('净结余')
    expect(html).toContain('存款')
    expect(html).toContain('1.6万')        // 收入 15800
    expect(html).toContain('9,200')        // 支出 9200（<1万 千分位）
    expect(html).toContain('123.5万')      // 存款 1234567
    expect(html).not.toContain('公积金余额')   // 退化模式 tooltip 不含公积金

    // 赤字场景：净结余 5000-9000 = -4000，竹青色 + 千分位负数
    const deficitHtml = (option.tooltip.formatter as (p: Array<{ seriesName: string; value: number }>) => string)([
      { seriesName: '收入', value: 5000 },
      { seriesName: '支出', value: 9000 },
      { seriesName: '存款', value: 1234567 },
    ])
    expect(deficitHtml).toContain('#5e8270')   // 赤字竹青色（COLOR_NET_NEG）
    expect(deficitHtml).toContain('-4,000')    // 净结余 -4000 千分位负数
  })
```

`buildChartData 含 totalAssets / fundBalance` 用例（`financeChart.spec.ts:190-197`）改成不再有 `totalAssets`：
```ts
  it('buildChartData 含 fundBalance 数组、不再产出 totalAssets', () => {
    const results: MonthResult[] = [
      makeResult({ month: 202601, cumSavings: 100, fundBalance: 50, totalAssets: 150 }),
    ]
    const data = buildChartData(results, 'month')
    expect(data.fundBalance).toEqual([50])
    expect((data as Record<string, unknown>).totalAssets).toBeUndefined()
  })
```

双线用例（`financeChart.spec.ts:199-207`）：系列名「总资产」→「存款」：
```ts
  it('buildChartOption fundEnabled=true 含存款与公积金余额两条线', () => {
    const data = buildChartData([], 'month')
    const opt = buildChartOption(data, true)
    const names = opt.series.map(s => s.name)
    expect(names).toEqual(['收入', '支出', '存款', '公积金余额'])
    expect(opt.legend.data).toEqual(['收入', '支出', '存款', '公积金余额'])
    expect(opt.series[3].yAxisIndex).toBe(1)
    expect(opt.series[3].itemStyle?.color).toBe('#d97706')   // 公积金琥珀
  })

  it('buildChartOption fundEnabled=false 仅存款线（退化）', () => {
    const data = buildChartData([], 'month')
    const opt = buildChartOption(data, false)
    const names = opt.series.map(s => s.name)
    expect(names).toContain('存款')
    expect(names).not.toContain('公积金余额')
    expect(opt.legend.data).not.toContain('公积金余额')
  })
```

公积金 tooltip 用例（`financeChart.spec.ts:218-229`）`seriesName: '总资产'` → `'存款'`：
```ts
    const html = (option.tooltip.formatter as (p: Array<{ seriesName: string; value: number }>) => string)([
      { seriesName: '收入', value: 10000 },
      { seriesName: '支出', value: 6000 },
      { seriesName: '存款', value: 80000 },
      { seriesName: '公积金余额', value: 30000 },
    ])
```

- [ ] **Step 2: 改 `FinanceChart.spec.ts` 为「存款」预期（红灯）**

`FinanceChart.spec.ts:56-65` 三系列名：
```ts
    expect(option.series.map(s => s.name)).toEqual(['收入', '支出', '存款'])
```

`FinanceChart.spec.ts:67-80` 标题高亮改取 `cumSavings`、文字「存款」。末月 `cumSavings` 为 55000 → `¥ 5.5万`：
```ts
  it('标题区高亮当前存款（与主线同名，万元格式）', async () => {
    const results = [
      makeResult({ month: 202601, cumSavings: 50000, totalAssets: 80000 }),
      makeResult({ month: 202602, cumSavings: 55000, totalAssets: 1234567 }),
    ]
    const wrapper = mount(FinanceChart, { props: { results } })
    await nextTick()

    // 取最末月 cumSavings（55000 → 5.5万），标签为「存款」与主线同名
    const title = wrapper.find('.text-base.font-bold.text-brand-600')
    expect(title.text()).toBe('¥ 5.5万')
    expect(wrapper.text()).toContain('存款')
    expect(wrapper.text()).not.toContain('总资产')
  })
```

- [ ] **Step 3: 跑测试确认失败**

Run: `npx vitest run tests/utils/financeChart.spec.ts tests/components/FinanceChart.spec.ts`
Expected: FAIL —— 实现仍是「总资产」，新断言不满足。

- [ ] **Step 4: 改 `financeChart.ts` 实现（绿灯）**

`src/utils/financeChart.ts:6-13` `ChartData` 删 `totalAssets`：
```ts
export interface ChartData {
  categories: string[]
  income: number[]
  expense: number[]      // 正值（不再取负）
  cumSavings: number[]   // 存款主线（撤去总资产后由它承担趋势线）
  fundBalance: number[]  // 公积金余额
}
```

`buildChartData` 年（`:81-88`）与月（`:91-98`）两处返回对象删 `totalAssets: ...` 行。年分支删 `totalAssets: years.map(p => p.totalAssets),`，月分支删 `totalAssets: results.map(r => r.totalAssets),`。

`buildChartOption`（`:107-146`）legend 与主线、tooltip：
```ts
  const legendData = fundEnabled
    ? ['收入', '支出', '存款', '公积金余额']
    : ['收入', '支出', '存款']
```
主线系列：
```ts
    {
      name: '存款', type: 'line', yAxisIndex: 1, data: data.cumSavings,
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
tooltip formatter（`:155-173`）`get('总资产')` → `get('存款')`、标签改「存款」：
```ts
        const total = get('存款')
        const fund = get('公积金余额')
        const net = income - expense
        const netColor = net >= 0 ? COLOR_INCOME : COLOR_NET_NEG
        const row = (label: string, val: number, color = '#0f172a') =>
          `<div style="display:flex;justify-content:space-between;gap:16px;font-size:12px;line-height:18px">`
          + `<span style="color:#64748b">${label}</span>`
          + `<span style="color:${color};font-weight:600">${formatAxisAmount(val)}</span></div>`
        let html = row('收入', income) + row('支出', expense)
          + row('净结余', net, netColor)
          + `<div style="height:1px;background:#e2e8f0;margin:4px 0"></div>`
          + row('存款', total)
        if (fundEnabled) html += row('公积金余额', fund)
        return html
```

- [ ] **Step 5: 改 `FinanceChart.vue` 实现**

`src/components/FinanceChart.vue:31-35` 标题高亮取 `cumSavings`：
```ts
// 当前存款（取最末月），万元化展示，作为标题区高亮（与主线「存款」同名同源）
const currentTotalAssetsLabel = computed(() => {
  const last = props.results[props.results.length - 1]
  return last ? `¥ ${formatAxisAmount(last.cumSavings)}` : '—'
})
```
> 注：变量名 `currentTotalAssetsLabel` 暂保留不改名，仅改取值与模板文字，降低本任务 diff 噪音；改名可在收尾时一并处理。

模板（`FinanceChart.vue:66`）文字：
```html
        <span class="text-xs text-neutral-400">存款</span>
```

- [ ] **Step 6: 跑测试确认通过**

Run: `npx vitest run tests/utils/financeChart.spec.ts tests/components/FinanceChart.spec.ts`
Expected: PASS。

- [ ] **Step 7: 提交**

```bash
git add src/utils/financeChart.ts src/components/FinanceChart.vue tests/utils/financeChart.spec.ts tests/components/FinanceChart.spec.ts
git commit -m "refactor(图表): 主线由「总资产」回归「存款」，移除图表总资产数据"
```

---

## Task 2: 删月度表「总资产」列 + 清理月度公式死代码

**Files:**
- Modify: `src/components/MonthlyTable.vue`（删表头 `<th>总资产>`、删每行总资产 `<td>`、删 `formulaLabels.totalAssets`）
- Modify: `src/utils/formula.ts`（`MonthFormulaField` 去 `'totalAssets'`、`MONTH_LABELS` 删 `totalAssets`、删 `case 'totalAssets'`）
- Test: `tests/components/MonthlyTable.spec.ts`
- Test: `tests/utils/formula.spec.ts`

> 依赖说明：`MonthlyTable.vue` 的 `formulaLabels` 是 `Record<MonthFormulaField, string>`，删其 `totalAssets` 键必须与 `formula.ts` 删 `MonthFormulaField` 的 `'totalAssets'` 同步，否则 TS 报错。故两文件同一 task 改。

- [ ] **Step 1: 改 `MonthlyTable.spec.ts` 断言为「不出现总资产」（红灯）**

`tests/components/MonthlyTable.spec.ts:1127` 把 `toContain` 改 `not.toContain`：
```ts
    expect(headers).toContain('公积金')
    expect(headers).not.toContain('总资产')
```

- [ ] **Step 2: 删 `formula.spec.ts` 的「总资产公式」用例**

删除 `tests/utils/formula.spec.ts:266-274` 整个 `it('总资产公式', ...)` 块。

- [ ] **Step 3: 跑测试确认失败**

Run: `npx vitest run tests/components/MonthlyTable.spec.ts -t "公积金专区"`
Expected: FAIL —— `启用 fund 后渲染专区 5 列表头与值` 因仍渲染总资产列而 `not.toContain('总资产')` 不成立。

- [ ] **Step 4: 删 `MonthlyTable.vue` 的总资产列（绿灯）**

删表头（`MonthlyTable.vue:789`）整行：
```html
            <th class="px-1 py-0 text-right tabular-nums font-semibold whitespace-nowrap">总资产</th>
```

删每行总资产单元格（`MonthlyTable.vue:1071-1079`）整段 `<!-- 总资产（只读，加粗，hover 公式） -->` 对应 `<td>...</td>`。

删 `formulaLabels` 的 `totalAssets` 键（`MonthlyTable.vue:218`）整行：
```ts
  totalAssets: '总资产',
```

- [ ] **Step 5: 删 `formula.ts` 月度总资产死代码**

`src/utils/formula.ts:5-7` `MonthFormulaField` 去 `'totalAssets'`：
```ts
export type MonthFormulaField =
  | 'investReturn' | 'monthlyIncome' | 'monthlyExpense' | 'monthlyBalance' | 'cumSavings'
  | 'fundOffset' | 'fundOffsetShortfall' | 'fundBalance' | 'fundInterest'
```

`MONTH_LABELS`（`:30-41`）删 `totalAssets: '总资产',`。

`buildMonthFormula`（`:150-153`）删 `case 'totalAssets'` 整段：
```ts
    case 'totalAssets': {
      line = `总资产 = 存款(${formatCurrency(result.cumSavings)}) + 公积金(${formatCurrency(result.fundBalance)}) = ${formatCurrency(result.totalAssets)}`
      break
    }
```

- [ ] **Step 6: 跑测试确认通过**

Run: `npx vitest run tests/components/MonthlyTable.spec.ts tests/utils/formula.spec.ts`
Expected: PASS。

- [ ] **Step 7: 提交**

```bash
git add src/components/MonthlyTable.vue src/utils/formula.ts tests/components/MonthlyTable.spec.ts tests/utils/formula.spec.ts
git commit -m "refactor(月度表): 移除「总资产」列及其 hover 公式死代码"
```

---

## Task 3: 删年度表「总资产」行 + 清理年度公式死代码

**Files:**
- Modify: `src/components/AnnualTable.vue`（删「总资产」`<tr>`、删 ctx `yearEndTotalAssets`）
- Modify: `src/utils/formula.ts`（`YearFormulaField` 去 `'totalAssets'`、`YEAR_LABELS` 删、`YearFormulaContext` 删 `yearEndTotalAssets`、删年度 `case 'totalAssets'`）
- Test: `tests/components/AnnualTable.spec.ts`
- Test: `tests/utils/formula.spec.ts`

- [ ] **Step 1: 改 `AnnualTable.spec.ts` 断言与 describe 名（红灯）**

`tests/components/AnnualTable.spec.ts:486` describe 改名：
```ts
describe('AnnualTable · 公积金', () => {
```
`:503-515` 用例「启用 fund 后渲染公积金与总资产行」断言改为不出现总资产、用例名改：
```ts
  it('启用 fund 后渲染公积金行、不出现总资产行', async () => {
    const useStore = (await import('../../src/composables/useStore')).useStore
    const store = useStore()
    store.enableFund()
    store.updateFundEntry('contribution', store.data.value.systemParams.startMonth, 1000)
    const results = calculate(store.data.value)

    const AnnualTable = (await import('../../src/components/AnnualTable.vue')).default
    const wrapper = mount(AnnualTable, { props: { results } })
    const rowLabels = wrapper.findAll('tbody td:first-child').map(td => td.text())
    expect(rowLabels).toContain('公积金')
    expect(rowLabels).not.toContain('总资产')
  })
```
> `:492-501`「未启用 fund 时不渲染公积金/总资产行」用例的 `not.toContain('总资产')` 仍成立，保留；用例名可一并改为「不渲染公积金行」。
> `:517` 起的 `aggregateByYear 含 totalAssets/fundBalance 年末值` 用例**保留不动**（`aggregateByYear` 仍产出 `totalAssets`，属计算层，不在本次范围）。

- [ ] **Step 2: 删 `formula.spec.ts` 的「年末总资产公式」用例**

删除 `tests/utils/formula.spec.ts:299-309` 整个 `it('年末总资产公式', ...)` 块。

- [ ] **Step 3: 跑测试确认失败**

Run: `npx vitest run tests/components/AnnualTable.spec.ts -t "公积金"`
Expected: FAIL —— `not.toContain('总资产')` 因仍渲染总资产行而不成立。

- [ ] **Step 4: 删 `AnnualTable.vue` 的总资产行（绿灯）**

删除 `src/components/AnnualTable.vue:307-320` 整个「总资产」`<tr>`：
```html
          <tr class="border-b bg-neutral-50 font-bold">
            <td class="px-1 py-0 whitespace-nowrap">总资产</td>
            <td
              v-for="summary in yearSummaries"
              :key="`total-${summary.year}`"
              class="px-1 py-0 text-right tabular-nums whitespace-nowrap"
            >
              <span
                class="block w-full"
                @mouseenter="showYearFormula(summary, 'totalAssets', $event)"
                @mouseleave="popover = null"
              >{{ formatCurrency(summary.totalAssets ?? 0) }}</span>
            </td>
          </tr>
```

删 ctx 构造里的 `yearEndTotalAssets`（`AnnualTable.vue:54`）整行：
```ts
    yearEndTotalAssets: summary.totalAssets ?? 0,
```

- [ ] **Step 5: 删 `formula.ts` 年度总资产死代码**

`YearFormulaField`（`formula.ts:159`）去 `'totalAssets'`：
```ts
export type YearFormulaField = 'startSavings' | 'investReturn' | 'yearBalance' | 'endSavings' | 'events' | 'fundBalance'
```
`YearFormulaContext`（`:169-170`）删字段：
```ts
  /** 年末总资产（totalAssets 公式用） */
  yearEndTotalAssets?: number
```
`YEAR_LABELS`（`:184`）删 `totalAssets: '年末总资产',`。
`buildYearFormula`（`:224-226`）删 `case 'totalAssets'`：
```ts
    case 'totalAssets':
      line = `年末总资产 = ${formatCurrency(ctx.yearEndTotalAssets ?? 0)}`
      break
```

- [ ] **Step 6: 跑测试确认通过**

Run: `npx vitest run tests/components/AnnualTable.spec.ts tests/utils/formula.spec.ts`
Expected: PASS。

- [ ] **Step 7: 提交**

```bash
git add src/components/AnnualTable.vue src/utils/formula.ts tests/components/AnnualTable.spec.ts tests/utils/formula.spec.ts
git commit -m "refactor(年度表): 移除「总资产」行及其 hover 公式死代码"
```

---

## Task 4: 全量测试与手动验证

- [ ] **Step 1: 全量测试**

Run: `npm run test`
Expected: 全绿。重点确认未动的 `tests/composables/monthlyAudit.spec.ts`（总资产不变量）仍通过、`aggregateByYear` 相关用例仍通过。

- [ ] **Step 2: 类型与构建**

Run: `npm run build`
Expected: 成功，无 TS 报错（验证 `formulaLabels` 与 `MonthFormulaField` 同步、无残留 `totalAssets` 引用）。

- [ ] **Step 3: 手动验证**

Run: `npm run dev`，浏览器打开后确认：
- 月度表公积金专区不再有「总资产」列，专区为 5 列；
- 年度表不再有「总资产」行，公积金启用时只有「公积金」行；
- 图表主曲线名为「存款」、靛蓝渐变面积、右上角高亮数字为「存款」；
- 鼠标悬停图表提示含「存款」不含「总资产」；
- 公积金余额副线、表格公积金列/行均正常。

- [ ] **Step 4: 收尾（可选）**

若希望变量名也回归语义，把 `FinanceChart.vue` 的 `currentTotalAssetsLabel` 重命名为 `currentSavingsLabel`（纯重命名，无行为变化，跑一次 `npm run test` 确认）。

---

## Self-Review（计划自审）

**1. Spec 覆盖：**
- 月度表删列 → Task 2 ✓
- 年度表删行 → Task 3 ✓
- 图表主线改存款 + 标题 + tooltip → Task 1 ✓
- `ChartData`/`buildChartData` 删 `totalAssets` → Task 1 Step 4 ✓
- formula 月度/年度死代码清理 → Task 2 / Task 3 ✓
- 计算层 `totalAssets` 保留 → 各 Task 明确不动；`monthlyAudit` / `aggregateByYear` 测试保留 → Task 4 Step 1 守护 ✓
- 测试更新 → 各 Task 内 ✓

**2. 占位符扫描：** 无 TBD/TODO，每步含真实代码或命令。

**3. 类型一致性：**
- 主线系列名全程用「存款」、数据源 `data.cumSavings`，测试与实现一致。
- `MonthFormulaField` 去 `'totalAssets'` 与 `MONTH_LABELS` 删键、`formulaLabels` 删键三处同步（同一 Task 2），避免 `Record` 键不匹配。
- `YearFormulaField` / `YEAR_LABELS` / `YearFormulaContext.yearEndTotalAssets` / `case` 同 Task 3 同步，且 `AnnualTable.vue` ctx 构造同 Task 删对应行。
- `get('总资产')` → `get('存款')` 与主线 `name:'存款'` 对应，tooltip 取值链路闭合。
