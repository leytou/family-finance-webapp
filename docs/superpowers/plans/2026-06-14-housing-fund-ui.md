# 住房公积金 UI 集成 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把已就绪的公积金核心层（数据模型/双账户计算/store 操作）接入现有界面：参数行启用入口、月表公积金专区 5 列（编辑/月冲联动/余额流水/总资产）、FundFlowEditor、年度表公积金/总资产行、图表总资产+公积金双线、公式 hover。

**Architecture:** 纯 UI 接入——不改 `useCalculation`/`types.ts`/`useStore` 的 fund 逻辑（已完成）。MonthlyTable 新增专区列 + 独立 fund 编辑路径（镜像现有 editCell/editCum 双 ref 模式，不破坏 11 处列编辑断言）；FundFlowEditor 仿 EventEditor（fixed 弹层 + useClickOutside + 草稿行）；formula.ts/financeChart.ts/AnnualTable 扩展展示。公积金专区/参数/图表公积金线仅在 `fund` 启用时渲染，未启用完全退化。

**Tech Stack:** Vue 3（Composition API + `<script setup>` + TS）、UnoCSS、Vitest（`@vue/test-utils`）、ECharts。

**对应 spec：** `docs/superpowers/specs/2026-06-14-housing-fund-ui-design.md`
**基线：** `npx vitest run` = 335 全绿（22 文件）。

---

## 文件结构

| 文件 | 责任 | 本计划动作 |
|---|---|---|
| `src/App.vue` | 主组件（header 参数行） | 参数行追加公积金参数（enableFund 门控 + 3 输入 + disable 二次确认） |
| `src/utils/formula.ts` | 公式构造 | `MonthFormulaField`/`YearFormulaField` 扩展 fund 字段 + build 新 case |
| `src/components/MonthlyTable.vue` | 月表 | 专区 5 列 + fund 编辑路径 + 月冲联动视觉 + 余额三态 + `FUND_BALANCE_COLUMN_ID` 右键 + FundFlowEditor 接入 |
| `src/components/FundFlowEditor.vue` | 公积金月流水编辑弹层 | **新建** |
| `src/components/AnnualTable.vue` | 年度表 | 「公积金」「总资产」两行 + hover 公式 |
| `src/composables/useCalculation.ts` | 计算（含年聚合） | `YearlyPoint` + `aggregateByYear` 加 totalAssets/fundBalance 年末值 |
| `src/utils/financeChart.ts` | 图表数据/option | `ChartData` 加 totalAssets/fundBalance；`buildChartOption(data, fundEnabled)` 双线 + 退化 |
| `src/components/FinanceChart.vue` | 图表组件 | `import useStore` 读 fund 存在性，传 `fundEnabled` |
| `tests/App.spec.ts` | App 集成测试 | 新增公积金参数区测试 |
| `tests/utils/formula.spec.ts` | formula 单测 | 新增 fund 公式 case 测试 |
| `tests/components/MonthlyTable.spec.ts` | 月表测试 | 新增专区/编辑/联动/右键测试 |
| `tests/components/FundFlowEditor.spec.ts` | FundFlowEditor 测试 | **新建** |
| `tests/components/AnnualTable.spec.ts` | 年度表测试 | 新增公积金/总资产行测试 |
| `tests/utils/financeChart.spec.ts` | financeChart 单测 | 新增双线/退化测试 |

不改动：`types.ts`、`useStore.ts`、`useCalculation.ts` 的 `calculate`/`processFund`/`resolveFundOffset`（已完成）、`ToolsMenu.vue`（`更多` 已完成）、header 两行结构（已完成 `3fddef9`）。

---

## 任务依赖与顺序

依赖链决定顺序（formula 前置以供各单元格 hover，避免前向引用）：

1. App.vue 参数行 fund 参数（启用入口，后续任务验证前提）
2. formula.ts 扩展（纯函数 + 单测，供 task 3/4/6 hover）
3. MonthlyTable 专区 5 列骨架（渲染 + 总资产 hover）
4. MonthlyTable fund 单元格编辑 + 月冲联动视觉 + 房贷符号翻转 + 月冲 hover
5. FundFlowEditor 组件（独立 + 单测）
6. 公积金余额列三态（click→FundFlowEditor / 右键锚点 / 锚点高亮 / 余额 hover）
7. AnnualTable 公积金/总资产行 + aggregateByYear 扩展
8. FinanceChart 双线 + 退化

---

## Task 1: App.vue 参数行追加公积金参数

**Files:**
- Modify: `src/App.vue`
- Test: `tests/App.spec.ts`

在现有第二行「参数」区（`初始存款` 输入之后）追加公积金子分组：`enableFund` 复选框门控 + 年利率/结息月/初始余额 3 输入 + disable 二次确认。不动两行结构与现有控件。

- [ ] **Step 1: 写失败测试**

在 `tests/App.spec.ts` 的 `describe('App', ...)` 内末尾追加：

```ts
  it('参数行含公积金启用开关，未启用时隐藏 3 个公积金输入', async () => {
    const App = await loadApp()
    const wrapper = mount(App, { global: { stubs: globalStubs } })

    // 公积金启用开关存在
    const fundToggle = wrapper.get('[data-testid="fund-enable-toggle"]')
    expect(fundToggle.exists()).toBe(true)

    // 未启用（默认无 fund）：3 个公积金输入不渲染
    expect(wrapper.find('[data-testid="fund-rate-input"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="fund-interest-month-input"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="fund-initial-balance-input"]').exists()).toBe(false)
  })

  it('勾选公积金启用开关调用 enableFund 并显示 3 个输入', async () => {
    const App = await loadApp()
    const wrapper = mount(App, { global: { stubs: globalStubs } })
    const useStore = await loadUseStore()
    const store = useStore()

    expect(store.data.value.fund).toBeUndefined()

    await wrapper.get('[data-testid="fund-enable-toggle"]').setValue(true)

    expect(store.data.value.fund).toBeDefined()
    expect(wrapper.find('[data-testid="fund-rate-input"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="fund-interest-month-input"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="fund-initial-balance-input"]').exists()).toBe(true)
  })

  it('改公积金年利率输入写回 setFundRate', async () => {
    const App = await loadApp()
    const wrapper = mount(App, { global: { stubs: globalStubs } })
    const useStore = await loadUseStore()
    const store = useStore()

    await wrapper.get('[data-testid="fund-enable-toggle"]').setValue(true)
    await wrapper.get('[data-testid="fund-rate-input"]').setValue('2')

    expect(store.data.value.systemParams.fundRate).toBeCloseTo(0.02)
  })

  it('取消启用弹二次确认，确认后调用 disableFund', async () => {
    const App = await loadApp()
    const wrapper = mount(App, { global: { stubs: globalStubs } })
    const useStore = await loadUseStore()
    const store = useStore()

    await wrapper.get('[data-testid="fund-enable-toggle"]').setValue(true)
    expect(store.data.value.fund).toBeDefined()

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    await wrapper.get('[data-testid="fund-enable-toggle"]').setValue(false)

    expect(confirmSpy).toHaveBeenCalled()
    expect(store.data.value.fund).toBeUndefined()
  })

  it('取消启用但二次确认驳回则保留 fund', async () => {
    const App = await loadApp()
    const wrapper = mount(App, { global: { stubs: globalStubs } })
    const useStore = await loadUseStore()
    const store = useStore()

    await wrapper.get('[data-testid="fund-enable-toggle"]').setValue(true)
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    await wrapper.get('[data-testid="fund-enable-toggle"]').setValue(false)

    expect(store.data.value.fund).toBeDefined()
  })
```

> 注：`loadUseStore` 已在 App.spec.ts 顶部定义（line 11-13）。

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/App.spec.ts`
Expected: FAIL —— `[data-testid="fund-enable-toggle"]` 不存在。

- [ ] **Step 3: 修改 App.vue script——解构 fund 操作函数**

在 `src/App.vue` 的 `const { data, setStartMonth } = useStore()`（line 15）替换为：

```ts
const {
  data,
  setStartMonth,
  enableFund,
  disableFund,
  setFundRate,
  setFundInterestMonth,
  setFundInitialBalance,
} = useStore()
```

并在 `startMonth` computed（line 59-63）之后追加 fund 开关双向桥接：

```ts
// 公积金启用开关：勾选→enableFund，取消→disableFund（二次确认防误删）
const fundEnabled = computed(() => !!data.value.fund)
function onFundToggle(e: Event) {
  const checked = (e.target as HTMLInputElement).checked
  if (checked) {
    enableFund()
  } else {
    if (window.confirm('关闭公积金将清空所有缴存/月冲/提取/锚点配置，确定？')) {
      disableFund()
    } else {
      // 驳回：把复选框视觉状态恢复为勾选（v-model 由 fundEnabled 计算，nextTick 后回正）
      ;(e.target as HTMLInputElement).checked = true
    }
  }
}
```

- [ ] **Step 4: 修改 App.vue template——参数行追加公积金子分组**

在「初始存款」`<div class="flex items-center gap-2">...</div>`（line 124-132，初始存款那组）**之后**、其父 `<div class="flex items-center gap-4">`（line 108）闭合 `</div>`（line 133）**之前**，插入：

```html
          <!-- 公积金子分组：仅 fund 启用时显示 3 输入 -->
          <div class="flex items-center gap-2 border-l pl-4">
            <label class="text-xs whitespace-nowrap flex items-center gap-1">
              <input
                data-testid="fund-enable-toggle"
                type="checkbox"
                :checked="fundEnabled"
                @change="onFundToggle"
              />
              公积金
            </label>
            <template v-if="fundEnabled">
              <label class="text-xs whitespace-nowrap">年利率(%)</label>
              <input
                data-testid="fund-rate-input"
                :value="(data.systemParams.fundRate * 100).toFixed(1)"
                @input="(e: Event) => setFundRate(Number((e.target as HTMLInputElement).value) / 100)"
                type="number"
                step="0.1"
                class="border rounded px-2 py-1 text-sm w-16"
              />
              <label class="text-xs whitespace-nowrap">结息月</label>
              <input
                data-testid="fund-interest-month-input"
                :value="data.systemParams.fundInterestMonth"
                @input="(e: Event) => setFundInterestMonth(Math.round(Number((e.target as HTMLInputElement).value)))"
                type="number"
                min="1"
                max="12"
                class="border rounded px-2 py-1 text-sm w-12"
              />
              <label class="text-xs whitespace-nowrap">初始余额</label>
              <input
                data-testid="fund-initial-balance-input"
                :value="data.systemParams.fundInitialBalance ?? 0"
                @input="(e: Event) => setFundInitialBalance(Number((e.target as HTMLInputElement).value))"
                type="number"
                class="border rounded px-2 py-1 text-sm w-24"
                placeholder="元"
              />
            </template>
          </div>
```

- [ ] **Step 5: 运行测试确认通过（含回归）**

Run: `npx vitest run tests/App.spec.ts`
Expected: PASS —— 新增 5 个用例 + 现有两行 header / 视图三按钮 / 参数绑定用例仍通过。

- [ ] **Step 6: 提交**

```bash
git add src/App.vue tests/App.spec.ts
git commit -m "feat(公积金): App 参数行追加公积金启用开关与参数输入"
```

---

## Task 2: formula.ts 扩展（fund 公式）

**Files:**
- Modify: `src/utils/formula.ts`
- Test: `tests/utils/formula.spec.ts`

为专区列 hover 提供公式。纯函数，独立可测。前置以供 Task 3/4/6 接入。

- [ ] **Step 1: 写失败测试**

在 `tests/utils/formula.spec.ts`（已有 month/year 公式测试）末尾新增 describe 块：

```ts
import { buildMonthFormula, buildYearFormula } from '../../src/utils/formula'
// 若文件顶部已 import 这两个函数则不重复；按现有 import 形式补齐 fund 相关 type

describe('buildMonthFormula · 公积金字段', () => {
  function makeResult(overrides: Partial<MonthResult> = {}): MonthResult {
    return {
      month: 202602, columnValues: [], totalFlow: 0, investReturn: 0,
      monthlyIncome: 0, monthlyExpense: 0, monthlyBalance: 0, cumSavings: 5000,
      isAnchor: false,
      fundBalance: 3000, fundInterest: 0, fundContribution: 2000,
      fundOffset: 1000, fundWithdrawal: 1000, fundOutflow: 2000,
      isFundAnchor: false, totalAssets: 8000,
      ...overrides,
    }
  }

  it('月冲公式（自动联动房贷月供）', () => {
    const r = makeResult({ fundOffset: 5000 })
    const { lines } = buildMonthFormula(r, 'fundOffset', {
      annualRate: 0.03, prevCum: 0,
      prevFundBalance: 0, fundContribution: 0, fundWithdrawal: 0,
      fundOffset: 5000, fundInterest: 0, fundBalance: 0,
      fundRate: 0.015, mortgageAbs: 5000, offsetAutoLinked: true,
    })
    expect(lines[0]).toContain('房贷月供(5,000)')
    expect(lines[0]).toContain('自动联动')
  })

  it('月冲公式（手填覆盖）', () => {
    const r = makeResult({ fundOffset: 3000 })
    const { lines } = buildMonthFormula(r, 'fundOffset', {
      annualRate: 0.03, prevCum: 0,
      prevFundBalance: 0, fundContribution: 0, fundWithdrawal: 0,
      fundOffset: 3000, fundInterest: 0, fundBalance: 0,
      fundRate: 0.015, mortgageAbs: 5000, offsetAutoLinked: false,
    })
    expect(lines[0]).toContain('手填值(3,000)')
  })

  it('公积金余额公式', () => {
    const r = makeResult({ month: 202602 })
    const { lines } = buildMonthFormula(r, 'fundBalance', {
      annualRate: 0.03, prevCum: 0,
      prevFundBalance: 2000, fundContribution: 2000, fundWithdrawal: 1000,
      fundOffset: 1000, fundInterest: 0, fundBalance: 2000,
      fundRate: 0.015, mortgageAbs: 0, offsetAutoLinked: false,
    })
    expect(lines[0]).toContain('上月余额(2,000)')
    expect(lines[0]).toContain('缴存(2,000)')
    expect(lines[0]).toContain('提取(1,000)')
    expect(lines[0]).toContain('月冲(1,000)')
    expect(lines[0]).toContain('= 2,000')
  })

  it('总资产公式', () => {
    const r = makeResult({ cumSavings: 5000, fundBalance: 3000, totalAssets: 8000 })
    const { lines } = buildMonthFormula(r, 'totalAssets', {
      annualRate: 0.03, prevCum: 0,
    })
    expect(lines[0]).toContain('存款(5,000)')
    expect(lines[0]).toContain('公积金(3,000)')
    expect(lines[0]).toContain('= 8,000')
  })

  it('结息公式（结息月）', () => {
    const r = makeResult({ fundInterest: 2800 })
    const { lines } = buildMonthFormula(r, 'fundInterest', {
      annualRate: 0.03, prevCum: 0, fundRate: 0.015,
    })
    expect(lines[0]).toContain('应计利息(2,800)')
    expect(lines[0]).toContain('1.5%')
  })
})

describe('buildYearFormula · 公积金字段', () => {
  it('年末公积金公式', () => {
    const summary: YearSummary = {
      year: 2026, startSavings: 0, columnSummaries: [], totalFlow: 0,
      investReturn: 0, yearBalance: 0, endSavings: 5000,
    }
    const { lines } = buildYearFormula(summary, 'fundBalance', {
      isFirstYear: true, firstMonthIsAnchor: false, initialDeposit: 0,
      prevYearEndSavings: 0, events: [],
    } as any)
    expect(lines[0]).toContain('年末公积金')
  })

  it('年末总资产公式', () => {
    const summary: YearSummary = {
      year: 2026, startSavings: 0, columnSummaries: [], totalFlow: 0,
      investReturn: 0, yearBalance: 0, endSavings: 5000,
    }
    const { lines } = buildYearFormula(summary, 'totalAssets', {
      isFirstYear: true, firstMonthIsAnchor: false, initialDeposit: 0,
      prevYearEndSavings: 0, events: [],
    } as any)
    expect(lines[0]).toContain('年末总资产')
  })
})
```

> 注：测试文件顶部需已 `import type { MonthResult, YearSummary } from '../../src/types'`；若未引入则补。`MonthFormulaContext` 的 fund 字段为本任务新增，见 Step 3。

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/utils/formula.spec.ts`
Expected: FAIL —— `'fundOffset'` 等 case 不存在 / `MonthFormulaContext` 无 fund 字段（TS 报错或运行时 undefined）。

- [ ] **Step 3: 扩展 `MonthFormulaField` / `MonthFormulaContext` / `MONTH_LABELS`**

在 `src/utils/formula.ts` 顶部，把 `MonthFormulaField` 替换为：

```ts
export type MonthFormulaField =
  | 'investReturn' | 'monthlyIncome' | 'monthlyExpense' | 'monthlyBalance' | 'cumSavings'
  | 'fundOffset' | 'fundBalance' | 'fundInterest' | 'totalAssets'
```

把 `MonthFormulaContext` 替换为（新增可选 fund 字段）：

```ts
export interface MonthFormulaContext {
  /** 年利率，小数（0.03 表示 3%） */
  annualRate: number
  /** 上月累计储蓄；首月取初始存款 */
  prevCum: number
  // —— 公积金公式上下文（仅 fund 字段 hover 时使用）——
  prevFundBalance?: number
  fundContribution?: number
  fundWithdrawal?: number
  fundOffset?: number
  fundInterest?: number
  fundBalance?: number
  fundRate?: number
  /** 房贷月供绝对值（月冲自动联动展示用） */
  mortgageAbs?: number
  /** 月冲是否自动联动房贷月供（false=手填） */
  offsetAutoLinked?: boolean
}
```

把 `MONTH_LABELS` 替换为：

```ts
const MONTH_LABELS: Record<MonthFormulaField, string> = {
  investReturn: '理财',
  monthlyIncome: '收入',
  monthlyExpense: '支出',
  monthlyBalance: '结余',
  cumSavings: '存款',
  fundOffset: '月冲',
  fundBalance: '公积金',
  fundInterest: '结息',
  totalAssets: '总资产',
}
```

- [ ] **Step 4: 扩展 `buildMonthFormula` switch 新增 fund case**

在 `buildMonthFormula` 的 `switch (field)` 内、`case 'cumSavings'` 之后、`}` 闭合前插入：

```ts
    case 'fundOffset': {
      const v = formatCurrency(result.fundOffset)
      line = ctx.offsetAutoLinked
        ? `月冲 = 房贷月供(${formatCurrency(ctx.mortgageAbs ?? 0)}) [自动联动] = ${v}`
        : `月冲 = 手填值(${v}) = ${v}`
      break
    }
    case 'fundBalance': {
      const a = formatCurrency(ctx.prevFundBalance ?? 0)
      const b = formatCurrency(ctx.fundContribution ?? 0)
      const c = formatCurrency(ctx.fundWithdrawal ?? 0)
      const d = formatCurrency(ctx.fundOffset ?? 0)
      const e = formatCurrency(ctx.fundInterest ?? 0)
      const f = formatCurrency(result.fundBalance)
      line = `公积金 = 上月余额(${a}) + 缴存(${b}) - 提取(${c}) - 月冲(${d}) + 结息(${e}) = ${f}`
      break
    }
    case 'fundInterest': {
      const ratePct = +((ctx.fundRate ?? 0) * 100).toFixed(1)
      line = `结息 = 应计利息(${formatCurrency(result.fundInterest)}) [年利率 ${ratePct}%]`
      break
    }
    case 'totalAssets': {
      line = `总资产 = 存款(${formatCurrency(result.cumSavings)}) + 公积金(${formatCurrency(result.fundBalance)}) = ${formatCurrency(result.totalAssets)}`
      break
    }
```

- [ ] **Step 5: 扩展 `YearFormulaField` / `YEAR_LABELS` / `buildYearFormula`**

把 `YearFormulaField` 替换为：

```ts
export type YearFormulaField = 'startSavings' | 'investReturn' | 'yearBalance' | 'endSavings' | 'events' | 'fundBalance' | 'totalAssets'
```

把 `YEAR_LABELS` 替换为：

```ts
const YEAR_LABELS: Record<YearFormulaField, string> = {
  startSavings: '年初存款',
  investReturn: '理财收益',
  yearBalance: '年度结余',
  endSavings: '年末存款',
  events: '专项',
  fundBalance: '年末公积金',
  totalAssets: '年末总资产',
}
```

`YearFormulaContext` 新增两个可选字段（年度年末值，由 AnnualTable 传入）：

```ts
export interface YearFormulaContext {
  isFirstYear: boolean
  firstMonthIsAnchor: boolean
  initialDeposit: number
  prevYearEndSavings: number
  events: { name: string; amount: number }[]
  /** 年末公积金余额（fundBalance 公式用） */
  yearEndFundBalance?: number
  /** 年末总资产（totalAssets 公式用） */
  yearEndTotalAssets?: number
}
```

在 `buildYearFormula` 的 `switch (field)` 内、`case 'events'` 之后插入：

```ts
    case 'fundBalance':
      line = `年末公积金 = ${formatCurrency(ctx.yearEndFundBalance ?? 0)}`
      break
    case 'totalAssets':
      line = `年末总资产 = ${formatCurrency(ctx.yearEndTotalAssets ?? 0)}`
      break
```

- [ ] **Step 6: 运行测试确认通过**

Run: `npx vitest run tests/utils/formula.spec.ts`
Expected: PASS —— 新增 fund case 用例 + 现有 month/year 公式用例回归。

- [ ] **Step 7: 提交**

```bash
git add src/utils/formula.ts tests/utils/formula.spec.ts
git commit -m "feat(公积金): formula 扩展月冲/余额/结息/总资产公式"
```

---

## Task 3: MonthlyTable 专区 5 列骨架（渲染 + 总资产 hover）

**Files:**
- Modify: `src/components/MonthlyTable.vue`
- Test: `tests/components/MonthlyTable.spec.ts`

仅在 `fund` 启用时渲染专区 5 列（房贷月供/缴存/月冲/余额/总资产），前置粗竖线分隔。本任务只做**只读渲染**（房贷/缴存/月冲显示值、月冲自动联动淡灰视觉、余额/总资产只读 + 总资产 hover 公式）。编辑、月冲 hover、余额交互留待 Task 4/6。

- [ ] **Step 1: 写失败测试**

在 `tests/components/MonthlyTable.spec.ts` 末尾新增 describe（用真实 `calculate` 产出含 fund 字段的 results，避免手搓 MonthResult）：

```ts
describe('MonthlyTable · 公积金专区', () => {
  beforeEach(() => {
    vi.useRealTimers()
    localStorage.clear()
    vi.resetModules()
  })

  it('未启用 fund 时不渲染专区列表头', async () => {
    const useStore = await loadUseStore()
    useStore() // 初始化默认 store（无 fund）
    const MonthlyTable = (await import('../../src/components/MonthlyTable.vue')).default
    const wrapper = mount(MonthlyTable, { props: { results: [createResult()] } })
    const headers = wrapper.findAll('th').map(t => t.text())
    expect(headers).not.toContain('房贷月供')
    expect(headers).not.toContain('总资产')
  })

  it('启用 fund 后渲染专区 5 列表头与值', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.enableFund()
    store.updateFundEntry('mortgage', 202601, -5000)
    store.updateFundEntry('contribution', 202601, 2000)
    // 月冲未手填 → 自动联动房贷月供
    const results = calculate(store.data.value)

    const MonthlyTable = (await import('../../src/components/MonthlyTable.vue')).default
    const wrapper = mount(MonthlyTable, { props: { results } })

    const headers = wrapper.findAll('th').map(t => t.text())
    expect(headers).toContain('房贷月供')
    expect(headers).toContain('公积金缴存')
    expect(headers).toContain('公积金月冲')
    expect(headers).toContain('公积金')
    expect(headers).toContain('总资产')

    // 房贷月供显示绝对值 5,000
    expect(wrapper.text()).toContain('5,000')
  })

  it('月冲未手填时显示房贷月供绝对值且淡灰（自动联动）', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.enableFund()
    store.updateFundEntry('mortgage', 202601, -5000)
    const results = calculate(store.data.value)

    const MonthlyTable = (await import('../../src/components/MonthlyTable.vue')).default
    const wrapper = mount(MonthlyTable, { props: { results } })

    // 月冲单元格带 data-fund-offset-auto 标记
    const autoCell = wrapper.find('[data-fund-offset-auto="202601"]')
    expect(autoCell.exists()).toBe(true)
    expect(autoCell.classes()).toContain('text-neutral-400')
    expect(autoCell.text()).toContain('5,000')
  })
})
```

> 注：`calculate`、`createResult`、`loadUseStore` 已在该文件顶部可用（calculate 已 import；createResult 已定义；loadUseStore 已定义）。

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/components/MonthlyTable.spec.ts -t "公积金专区"`
Expected: FAIL —— 专区列表头不存在。

- [ ] **Step 3: MonthlyTable script——加 fund 计算属性与 helper**

在 `src/components/MonthlyTable.vue` `<script setup>` 内（`const columns = computed(...)` 附近）追加：

```ts
import { resolveColumnValue, hasColumnValue, resolveFundOffset } from '../composables/useCalculation'
import type { FundConfig } from '../types'

// 公积金配置（未启用时为 undefined，专区不渲染）
const fund = computed<FundConfig | undefined>(() => store.data.value.fund)
```

> `resolveColumnValue` 已 import；补 `hasColumnValue`、`resolveFundOffset`、`FundConfig` 类型到现有 import。

追加专区单元格取值 helper：

```ts
// 专区单元格取值
function fundMortgageAbs(month: number): number {
  return Math.abs(resolveColumnValue(fund.value!.mortgage, month).amount)
}
function fundContribution(month: number): number {
  return resolveColumnValue(fund.value!.contribution, month).amount
}
// 月冲：手填用手填值，否则自动联动房贷月供（返回 { value, auto }）
function fundOffsetDisplay(month: number): { value: number; auto: boolean } {
  if (!fund.value) return { value: 0, auto: false }
  if (hasColumnValue(fund.value.monthlyOffset, month)) {
    return { value: Math.abs(resolveColumnValue(fund.value.monthlyOffset, month).amount), auto: false }
  }
  return { value: resolveFundOffset(fund.value, month), auto: true }
}
```

- [ ] **Step 4: MonthlyTable thead——专区列表头（仅 fund 启用）**

在 `<thead>` 内「存款」列 `<th>...存款</th>`（约 line 577）之后、对比列表头 `v-if="selectedSnapshot"` 之前，插入：

```html
          <!-- 公积金专区表头（仅 fund 启用） -->
          <template v-if="fund">
            <th class="px-1 py-0 text-right tabular-nums font-semibold whitespace-nowrap border-l-2 border-neutral-400">房贷月供</th>
            <th class="px-1 py-0 text-right tabular-nums font-semibold whitespace-nowrap">公积金缴存</th>
            <th class="px-1 py-0 text-right tabular-nums font-semibold whitespace-nowrap">公积金月冲</th>
            <th class="px-1 py-0 text-right tabular-nums font-semibold whitespace-nowrap">公积金</th>
            <th class="px-1 py-0 text-right tabular-nums font-semibold whitespace-nowrap">总资产</th>
          </template>
```

- [ ] **Step 5: MonthlyTable tbody——专区数据单元格（仅 fund 启用）**

在每行 `<tr>` 内「累计列」`<td>...存款...</td>`（约 line 699-731）之后、对比列 `v-if="selectedSnapshot"` 之前，插入：

```html
          <!-- 公积金专区数据列（仅 fund 启用） -->
          <template v-if="fund">
            <!-- 房贷月供（只读，Task 4 改可编辑；显示绝对值） -->
            <td
              class="px-1 py-0 text-right tabular-nums whitespace-nowrap border-l-2 border-neutral-400"
              :class="getValueClass(-fundMortgageAbs(result.month))"
            >
              <span class="block w-full">{{ formatCurrency(fundMortgageAbs(result.month)) }}</span>
            </td>
            <!-- 公积金缴存（只读，Task 4 改可编辑） -->
            <td class="px-1 py-0 text-right tabular-nums whitespace-nowrap">
              <span class="block w-full">{{ formatCurrency(fundContribution(result.month)) }}</span>
            </td>
            <!-- 公积金月冲（只读 + 联动视觉；Task 4 改可编辑 + hover） -->
            <td
              class="px-1 py-0 text-right tabular-nums whitespace-nowrap"
              :class="{ 'text-neutral-400': fundOffsetDisplay(result.month).auto }"
              :data-fund-offset-auto="fundOffsetDisplay(result.month).auto ? result.month : false"
            >
              <span class="block w-full">{{ formatCurrency(fundOffsetDisplay(result.month).value) }}</span>
            </td>
            <!-- 公积金余额（只读；Task 6 加 click/右键/hover） -->
            <td
              class="px-1 py-0 text-right tabular-nums whitespace-nowrap"
              :class="{ 'bg-brand-50': result.isFundAnchor }"
            >
              <span class="block w-full">{{ formatCurrency(result.fundBalance) }}</span>
            </td>
            <!-- 总资产（只读，加粗，hover 公式） -->
            <td class="px-1 py-0 text-right tabular-nums whitespace-nowrap font-bold">
              <span
                class="block w-full"
                :aria-label="getFormulaAriaLabel(result, 'totalAssets')"
                @mouseenter="showFormula(result, 'totalAssets', $event)"
                @mouseleave="popover = null"
              >{{ formatCurrency(result.totalAssets) }}</span>
            </td>
          </template>
```

并扩展 `showFormula` 使其 fund 字段上下文正确（见 Step 6）。

- [ ] **Step 6: 扩展 `showFormula` 与 `formulaLabels` 支持 fund 字段**

把 `formulaLabels`（约 line 154-160）替换为：

```ts
const formulaLabels: Record<MonthFormulaField, string> = {
  investReturn: '理财',
  monthlyIncome: '收入',
  monthlyExpense: '支出',
  monthlyBalance: '结余',
  cumSavings: '存款',
  fundOffset: '月冲',
  fundBalance: '公积金',
  fundInterest: '结息',
  totalAssets: '总资产',
}
```

把 `showFormula` 函数（约 line 191-200）替换为（补 fund 上下文）：

```ts
function showFormula(result: MonthResult, field: MonthFormulaField, event: MouseEvent): void {
  const idx = props.results.findIndex(r => r.month === result.month)
  const initialDeposit = store.data.value.systemParams.initialDeposit ?? 0
  const prevCum = idx === 0 ? initialDeposit : props.results[idx - 1].cumSavings
  const prevFundBalance = idx === 0
    ? (store.data.value.systemParams.fundInitialBalance ?? 0)
    : props.results[idx - 1].fundBalance
  const od = fundOffsetDisplay(result.month)
  const { title, lines } = buildMonthFormula(result, field, {
    annualRate: store.data.value.systemParams.annualRate,
    prevCum,
    prevFundBalance,
    fundContribution: result.fundContribution,
    fundWithdrawal: result.fundWithdrawal,
    fundOffset: result.fundOffset,
    fundInterest: result.fundInterest,
    fundBalance: result.fundBalance,
    fundRate: store.data.value.systemParams.fundRate,
    mortgageAbs: fund.value ? fundMortgageAbs(result.month) : 0,
    offsetAutoLinked: od.auto,
  })
  popover.value = { title, lines, x: event.clientX + 10, y: event.clientY + 10 }
}
```

`buildMonthFormula` 与 `MonthFormulaField` 已在顶部 import（Task 2 已扩展类型）。

- [ ] **Step 7: 运行测试确认通过**

Run: `npx vitest run tests/components/MonthlyTable.spec.ts`
Expected: PASS —— 新增 3 个专区用例 + 现有用例回归。

- [ ] **Step 8: 提交**

```bash
git add src/components/MonthlyTable.vue tests/components/MonthlyTable.spec.ts
git commit -m "feat(公积金): MonthlyTable 专区 5 列骨架与月冲联动视觉"
```

---

## Task 4: MonthlyTable fund 单元格编辑 + 月冲 hover + 房贷符号翻转

**Files:**
- Modify: `src/components/MonthlyTable.vue`
- Test: `tests/components/MonthlyTable.spec.ts`

把房贷/缴存/月冲三列改为可编辑（独立 fund 编辑路径，镜像 editCell/editCum 双 ref 模式）。房贷输入正数存负数；月冲手填蓝底 + hover 公式；上下键跨行移动。

- [ ] **Step 1: 写失败测试**

在 `tests/components/MonthlyTable.spec.ts` 的「公积金专区」describe 内追加：

```ts
  it('房贷月供输入正数存负数', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.enableFund()
    const results = calculate(store.data.value)

    const MonthlyTable = (await import('../../src/components/MonthlyTable.vue')).default
    const wrapper = mount(MonthlyTable, { props: { results } })

    // 点击房贷月供单元格进入编辑
    await wrapper.find('[data-fund-edit="mortgage-202601"]').trigger('click')
    const input = wrapper.find('[data-fund-edit-input="mortgage-202601"]')
    await input.setValue('5000')
    await input.trigger('blur')

    expect(store.data.value.fund!.mortgage.entries[202601]).toBe(-5000)
  })

  it('公积金缴存输入正数原样存储', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.enableFund()
    const results = calculate(store.data.value)

    const MonthlyTable = (await import('../../src/components/MonthlyTable.vue')).default
    const wrapper = mount(MonthlyTable, { props: { results } })

    await wrapper.find('[data-fund-edit="contribution-202601"]').trigger('click')
    const input = wrapper.find('[data-fund-edit-input="contribution-202601"]')
    await input.setValue('2000')
    await input.trigger('blur')

    expect(store.data.value.fund!.contribution.entries[202601]).toBe(2000)
  })

  it('月冲手填覆盖后显示蓝底（已编辑）', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.enableFund()
    store.updateFundEntry('mortgage', 202601, -5000)
    store.updateFundEntry('monthlyOffset', 202601, 3000) // 手填覆盖
    const results = calculate(store.data.value)

    const MonthlyTable = (await import('../../src/components/MonthlyTable.vue')).default
    const wrapper = mount(MonthlyTable, { props: { results } })

    const cell = wrapper.find('[data-fund-offset-edited="202601"]')
    expect(cell.exists()).toBe(true)
    expect(cell.classes()).toContain('bg-brand-50')
    expect(cell.text()).toContain('3,000')
  })

  it('月冲手填编辑写回 monthlyOffset', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.enableFund()
    const results = calculate(store.data.value)

    const MonthlyTable = (await import('../../src/components/MonthlyTable.vue')).default
    const wrapper = mount(MonthlyTable, { props: { results } })

    await wrapper.find('[data-fund-edit="monthlyOffset-202601"]').trigger('click')
    const input = wrapper.find('[data-fund-edit-input="monthlyOffset-202601"]')
    await input.setValue('3000')
    await input.trigger('blur')

    expect(store.data.value.fund!.monthlyOffset.entries[202601]).toBe(3000)
  })

  it('月冲单元格 hover 展示公式（自动联动）', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.enableFund()
    store.updateFundEntry('mortgage', 202601, -5000)
    const results = calculate(store.data.value)

    const MonthlyTable = (await import('../../src/components/MonthlyTable.vue')).default
    const wrapper = mount(MonthlyTable, { props: { results } })

    await wrapper.find('[data-fund-offset-auto="202601"] span').trigger('mouseenter')
    expect(wrapper.text()).toContain('自动联动')
  })
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/components/MonthlyTable.spec.ts -t "公积金专区"`
Expected: FAIL —— `[data-fund-edit=...]` 不存在。

- [ ] **Step 3: script——新增 fund 编辑状态与函数**

在 `<script setup>` 内（现有 `editingCell`/`editCellValue` 附近，约 line 162-168）追加独立 fund 编辑状态：

```ts
// 公积金专区单元格编辑状态（独立 ref，镜像 editCell/editCum 模式）
const editingFundCell = ref<{ field: 'mortgage' | 'contribution' | 'monthlyOffset'; month: number } | null>(null)
const editFundCellValue = ref<string>('')
const editFundCellInput = ref<HTMLInputElement | null>(null)
const editFundOriginalValue = ref<number>(0)
function setEditFundCellInput(el: any) { editFundCellInput.value = el ?? null }

function fundEditKey(field: 'mortgage' | 'contribution' | 'monthlyOffset', month: number): string {
  return `${field}-${month}`
}

// 进入编辑：mortgage 预填绝对值（正数），其余原值
function startEditFundCell(
  field: 'mortgage' | 'contribution' | 'monthlyOffset',
  month: number,
) {
  if (!fund.value) return
  let current: number
  if (field === 'mortgage') current = Math.abs(resolveColumnValue(fund.value.mortgage, month).amount)
  else current = Math.abs(resolveColumnValue(fund.value[field], month).amount)
  editingFundCell.value = { field, month }
  editFundOriginalValue.value = Math.round(current)
  editFundCellValue.value = String(editFundOriginalValue.value)
  nextTick(() => {
    const el = document.querySelector<HTMLInputElement>(`[data-fund-edit-input="${fundEditKey(field, month)}"]`)
    el?.select()
  })
}

function confirmEditFundCell() {
  if (!editingFundCell.value) return
  const { field, month } = editingFundCell.value
  const trimmed = editFundCellValue.value.trim()
  if (trimmed === '') {
    store.updateFundEntry(field, month, null)
  } else {
    const num = Math.round(Number(trimmed))
    if (Number.isFinite(num) && num !== editFundOriginalValue.value) {
      // mortgage 存负数，其余原样
      store.updateFundEntry(field, month, field === 'mortgage' ? -num : num)
    }
  }
  editingFundCell.value = null
  editFundCellValue.value = ''
}

function cancelEditFundCell() {
  editingFundCell.value = null
  editFundCellValue.value = ''
}

async function moveEditFundCell(
  field: 'mortgage' | 'contribution' | 'monthlyOffset',
  month: number,
  direction: -1 | 1,
) {
  const idx = props.results.findIndex(r => r.month === month)
  const targetIdx = idx + direction
  if (idx === -1 || targetIdx < 0 || targetIdx >= props.results.length) return
  skipBlur.value = true
  confirmEditFundCell()
  await nextTick()
  startEditFundCell(field, props.results[targetIdx].month)
  await nextTick()
  skipBlur.value = false
}

function handleEditFundCellBlur() {
  if (skipBlur.value) return
  confirmEditFundCell()
}
```

并在 `useClickOutside` 注册区（约 line 426-429）追加：

```ts
useClickOutside(editFundCellInput, confirmEditFundCell)
```

- [ ] **Step 4: template——房贷/缴存/月冲单元格改可编辑**

把 Task 3 Step 5 插入的「房贷月供」`<td>` 替换为：

```html
            <td
              class="px-1 py-0 text-right tabular-nums whitespace-nowrap border-l-2 border-neutral-400 relative"
              :class="getValueClass(-fundMortgageAbs(result.month))"
            >
              <input
                v-if="editingFundCell?.field === 'mortgage' && editingFundCell?.month === result.month"
                :data-fund-edit-input="fundEditKey('mortgage', result.month)"
                :ref="setEditFundCellInput"
                type="text"
                inputmode="numeric"
                class="absolute inset-0 border rounded px-1 text-right text-[11px]"
                :value="editFundCellValue"
                @input="editFundCellValue = ($event.target as HTMLInputElement).value"
                @keyup.enter="confirmEditFundCell"
                @keyup.escape="cancelEditFundCell"
                @keydown.up.prevent="moveEditFundCell('mortgage', result.month, -1)"
                @keydown.down.prevent="moveEditFundCell('mortgage', result.month, 1)"
                @blur="handleEditFundCellBlur"
              />
              <span
                v-else
                class="block w-full cursor-pointer"
                :data-fund-edit="fundEditKey('mortgage', result.month)"
                @click="startEditFundCell('mortgage', result.month)"
              >{{ formatCurrency(fundMortgageAbs(result.month)) }}</span>
            </td>
```

「公积金缴存」`<td>` 替换为（同结构，field='contribution'，无符号翻转、无 border-l-2）：

```html
            <td class="px-1 py-0 text-right tabular-nums whitespace-nowrap relative">
              <input
                v-if="editingFundCell?.field === 'contribution' && editingFundCell?.month === result.month"
                :data-fund-edit-input="fundEditKey('contribution', result.month)"
                :ref="setEditFundCellInput"
                type="text"
                inputmode="numeric"
                class="absolute inset-0 border rounded px-1 text-right text-[11px]"
                :value="editFundCellValue"
                @input="editFundCellValue = ($event.target as HTMLInputElement).value"
                @keyup.enter="confirmEditFundCell"
                @keyup.escape="cancelEditFundCell"
                @keydown.up.prevent="moveEditFundCell('contribution', result.month, -1)"
                @keydown.down.prevent="moveEditFundCell('contribution', result.month, 1)"
                @blur="handleEditFundCellBlur"
              />
              <span
                v-else
                class="block w-full cursor-pointer"
                :data-fund-edit="fundEditKey('contribution', result.month)"
                @click="startEditFundCell('contribution', result.month)"
              >{{ formatCurrency(fundContribution(result.month)) }}</span>
            </td>
```

「公积金月冲」`<td>` 替换为（联动视觉 + 手填蓝底 + hover 公式 + 可编辑）：

```html
            <td
              class="px-1 py-0 text-right tabular-nums whitespace-nowrap relative"
              :class="{
                'text-neutral-400': fundOffsetDisplay(result.month).auto,
                'bg-brand-50': !fundOffsetDisplay(result.month).auto,
              }"
              :data-fund-offset-auto="fundOffsetDisplay(result.month).auto ? result.month : false"
              :data-fund-offset-edited="!fundOffsetDisplay(result.month).auto ? result.month : false"
            >
              <input
                v-if="editingFundCell?.field === 'monthlyOffset' && editingFundCell?.month === result.month"
                :data-fund-edit-input="fundEditKey('monthlyOffset', result.month)"
                :ref="setEditFundCellInput"
                type="text"
                inputmode="numeric"
                class="absolute inset-0 border rounded px-1 text-right text-[11px]"
                :value="editFundCellValue"
                @input="editFundCellValue = ($event.target as HTMLInputElement).value"
                @keyup.enter="confirmEditFundCell"
                @keyup.escape="cancelEditFundCell"
                @keydown.up.prevent="moveEditFundCell('monthlyOffset', result.month, -1)"
                @keydown.down.prevent="moveEditFundCell('monthlyOffset', result.month, 1)"
                @blur="handleEditFundCellBlur"
              />
              <span
                v-else
                class="block w-full cursor-pointer"
                :aria-label="getFormulaAriaLabel(result, 'fundOffset')"
                @click="startEditFundCell('monthlyOffset', result.month)"
                @mouseenter="showFormula(result, 'fundOffset', $event)"
                @mouseleave="popover = null"
              >{{ formatCurrency(fundOffsetDisplay(result.month).value) }}</span>
            </td>
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npx vitest run tests/components/MonthlyTable.spec.ts`
Expected: PASS —— 新增 5 个编辑用例 + 现有回归。

- [ ] **Step 6: 提交**

```bash
git add src/components/MonthlyTable.vue tests/components/MonthlyTable.spec.ts
git commit -m "feat(公积金): MonthlyTable 专区单元格编辑与月冲联动/hover/符号翻转"
```

---

## Task 5: FundFlowEditor 组件

**Files:**
- Create: `src/components/FundFlowEditor.vue`
- Test: `tests/components/FundFlowEditor.spec.ts`

仿 EventEditor：fixed 弹层定位点击坐标、竖向流水（期初/缴存/提取[可编辑]/月冲/结息/期末）、useClickOutside+Esc→commit、草稿行稳定 key、提交 `replaceMonthWithdrawals`、截断提示。

- [ ] **Step 1: 写失败测试**

新建 `tests/components/FundFlowEditor.spec.ts`：

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { MonthResult, FundWithdrawal } from '../../src/types'

async function loadFundFlowEditor() {
  return (await import('../../src/components/FundFlowEditor.vue')).default
}
async function loadUseStore() {
  return (await import('../../src/composables/useStore')).useStore
}

function makeResult(overrides: Partial<MonthResult> = {}): MonthResult {
  return {
    month: 202602, columnValues: [], totalFlow: 0, investReturn: 0,
    monthlyIncome: 0, monthlyExpense: 0, monthlyBalance: 0, cumSavings: 3000,
    isAnchor: false,
    fundBalance: 3000, fundInterest: 0, fundContribution: 2000,
    fundOffset: 1000, fundWithdrawal: 1000, fundOutflow: 2000,
    isFundAnchor: false, totalAssets: 6000,
    ...overrides,
  }
}

describe('FundFlowEditor', () => {
  beforeEach(() => {
    vi.useRealTimers()
    localStorage.clear()
    vi.resetModules()
  })
  afterEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it('展示流水：期初/缴存/提取/月冲/结息/期末', async () => {
    const FundFlowEditor = await loadFundFlowEditor()
    const withdrawals: FundWithdrawal[] = [{ id: 'w1', name: '首付提取', month: 202602, amount: 1000 }]
    const wrapper = mount(FundFlowEditor, {
      props: { month: 202602, result: makeResult(), prevFundBalance: 2000, withdrawals, x: 10, y: 10 },
    })
    const text = wrapper.text()
    expect(text).toContain('2026-02 公积金')
    expect(text).toContain('期初余额')
    expect(text).toContain('2,000')
    expect(text).toContain('缴存')
    expect(text).toContain('提取')
    expect(text).toContain('月冲')
    expect(text).toContain('期末余额')
    expect(text).toContain('3,000')
  })

  it('提取行预填并可增删', async () => {
    const FundFlowEditor = await loadFundFlowEditor()
    const withdrawals: FundWithdrawal[] = [{ id: 'w1', name: '首付提取', month: 202602, amount: 1000 }]
    const wrapper = mount(FundFlowEditor, {
      props: { month: 202602, result: makeResult(), prevFundBalance: 2000, withdrawals, x: 10, y: 10 },
    })
    expect(wrapper.find('[aria-label="删除该提取"]').exists()).toBe(true)
    await wrapper.find('[aria-label="添加提取"]').trigger('click')
    expect(wrapper.findAll('[aria-label="删除该提取"]')).toHaveLength(2)
    await wrapper.findAll('[aria-label="删除该提取"]')[0]!.trigger('click')
    expect(wrapper.findAll('[aria-label="删除该提取"]')).toHaveLength(1)
  })

  it('点完成写回 replaceMonthWithdrawals', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.enableFund()
    const FundFlowEditor = await loadFundFlowEditor()
    const wrapper = mount(FundFlowEditor, {
      props: { month: 202602, result: makeResult(), prevFundBalance: 2000, withdrawals: [], x: 10, y: 10 },
    })
    await wrapper.find('[aria-label="添加提取"]').trigger('click')
    const inputs = wrapper.findAll('input')
    await inputs[0]!.setValue('装修提取')
    await inputs[1]!.setValue('5000')
    await wrapper.find('[aria-label="完成"]').trigger('click')

    expect(store.data.value.fund!.withdrawals).toHaveLength(1)
    expect(store.data.value.fund!.withdrawals[0]!.name).toBe('装修提取')
    expect(store.data.value.fund!.withdrawals[0]!.amount).toBe(5000)
    expect(store.data.value.fund!.withdrawals[0]!.month).toBe(202602)
  })

  it('截断时编辑行显示请求值，流水行显示实际值，附「已截断」', async () => {
    const FundFlowEditor = await loadFundFlowEditor()
    // 请求提取 999999，但 result.fundWithdrawal=2000（已截断）
    const withdrawals: FundWithdrawal[] = [{ id: 'w1', name: '超额', month: 202602, amount: 999999 }]
    const result = makeResult({ fundWithdrawal: 2000 })
    const wrapper = mount(FundFlowEditor, {
      props: { month: 202602, result, prevFundBalance: 10000, withdrawals, x: 10, y: 10 },
    })
    const text = wrapper.text()
    expect(text).toContain('999,999')   // 编辑行请求值
    expect(text).toContain('已截断')
  })

  it('按传入坐标定位', async () => {
    const FundFlowEditor = await loadFundFlowEditor()
    const wrapper = mount(FundFlowEditor, {
      props: { month: 202602, result: makeResult(), prevFundBalance: 0, withdrawals: [], x: 80, y: 90 },
    })
    expect(wrapper.attributes('style')).toContain('left: 80px')
    expect(wrapper.attributes('style')).toContain('top: 90px')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/components/FundFlowEditor.spec.ts`
Expected: FAIL —— 模块不存在。

- [ ] **Step 3: 实现 FundFlowEditor.vue**

新建 `src/components/FundFlowEditor.vue`：

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useClickOutside } from '../composables/useClickOutside'
import { useStore } from '../composables/useStore'
import { formatCurrency } from '../utils/format'
import { formatMonth } from '../utils/month'
import type { MonthResult, FundWithdrawal } from '../types'

const props = defineProps<{
  month: number
  result: MonthResult            // 该月 MonthResult（取 fundContribution/fundOffset/fundInterest/fundBalance/fundWithdrawal）
  prevFundBalance: number        // 期初余额（上月末 fundBalance；首月取 fundInitialBalance）
  withdrawals: FundWithdrawal[]  // 该月提取（初始化草稿）
  x: number
  y: number
}>()

const emit = defineEmits<{ close: [] }>()
const store = useStore()

interface DraftRow { key: string; name: string; amount: string }
let draftKeySeq = 0
function nextDraftKey(): string { draftKeySeq += 1; return `fund-draft-${draftKeySeq}` }

const rows = ref<DraftRow[]>(
  props.withdrawals.map(w => ({ key: nextDraftKey(), name: w.name, amount: String(w.amount) })),
)
const dirty = ref(false)
function markDirty() { dirty.value = true }
const rootRef = ref<HTMLElement | null>(null)

// 提取请求总额（编辑行展示）
const requestedTotal = () => rows.value.reduce((s, r) => s + (Number(r.amount) || 0), 0)

function addRow() { rows.value.push({ key: nextDraftKey(), name: '', amount: '' }); markDirty() }
function removeRow(idx: number) { rows.value.splice(idx, 1); markDirty() }

function commit() {
  if (dirty.value) {
    const items = rows.value
      .map(r => ({ name: r.name.trim(), amount: Number(r.amount) }))
      .filter(r => r.name !== '' && Number.isFinite(r.amount))
      .map(r => ({ name: r.name, amount: Math.round(r.amount) }))
    store.replaceMonthWithdrawals(props.month, items)
  }
  emit('close')
}

useClickOutside(rootRef, commit)
onMounted(() => { rootRef.value?.focus() })
</script>

<template>
  <div
    ref="rootRef"
    class="fixed z-50 min-w-64 border rounded bg-white p-2 text-[12px] shadow-lg"
    :style="{ left: `${x}px`, top: `${y}px` }"
    tabindex="-1"
    @keyup.escape="commit"
  >
    <div class="mb-2 font-semibold">{{ formatMonth(month) }} 公积金</div>

    <!-- 流水：期初 / 缴存 / 提取（可编辑）/ 月冲 / 结息 / 期末 -->
    <div class="flex items-center justify-between gap-4">
      <span class="text-neutral-500">期初余额</span>
      <span class="tabular-nums">{{ formatCurrency(prevFundBalance) }}</span>
    </div>
    <div class="flex items-center justify-between gap-4">
      <span class="text-neutral-500">+ 缴存</span>
      <span class="tabular-nums">{{ formatCurrency(result.fundContribution) }}</span>
    </div>

    <div class="mt-1 text-neutral-500">- 提取</div>
    <div v-if="rows.length === 0" class="mb-1 text-neutral-400">暂无提取，点下方「添加」</div>
    <div v-for="(row, idx) in rows" :key="row.key" class="mb-1 flex items-center gap-1 pl-2">
      <input
        v-model="row.name"
        type="text"
        class="flex-1 border rounded px-1 text-[12px]"
        placeholder="名称"
        @input="markDirty"
      />
      <input
        v-model="row.amount"
        type="text"
        inputmode="numeric"
        class="w-24 border rounded px-1 text-right text-[12px]"
        placeholder="金额"
        @input="markDirty"
      />
      <button
        type="button"
        class="text-danger-600 hover:text-danger-800"
        aria-label="删除该提取"
        @click="removeRow(idx)"
      >×</button>
    </div>
    <button
      type="button"
      class="text-brand-600 hover:text-brand-700"
      aria-label="添加提取"
      @click="addRow"
    >+ 添加</button>

    <!-- 截断提示：请求总额 ≠ 实际 fundWithdrawal -->
    <div
      v-if="requestedTotal() !== result.fundWithdrawal"
      class="mt-1 text-[11px] text-amber-600"
    >已截断：请求 {{ formatCurrency(requestedTotal()) }}，实际提取 {{ formatCurrency(result.fundWithdrawal) }}</div>

    <div class="mt-1 flex items-center justify-between gap-4">
      <span class="text-neutral-500">- 月冲</span>
      <span class="tabular-nums">{{ formatCurrency(result.fundOffset) }}</span>
    </div>
    <div v-if="result.fundInterest !== 0" class="flex items-center justify-between gap-4">
      <span class="text-neutral-500">+ 结息</span>
      <span class="tabular-nums">{{ formatCurrency(result.fundInterest) }}</span>
    </div>

    <div class="mt-1 flex items-center justify-between gap-4 border-t pt-1 font-semibold">
      <span>= 期末余额</span>
      <span class="tabular-nums">{{ formatCurrency(result.fundBalance) }}</span>
    </div>

    <div class="mt-2 flex justify-end">
      <button
        type="button"
        class="border rounded px-2 py-0.5 hover:bg-neutral-50"
        aria-label="完成"
        @click="commit"
      >完成</button>
    </div>
  </div>
</template>
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/components/FundFlowEditor.spec.ts`
Expected: PASS（5 个用例）。

- [ ] **Step 5: 提交**

```bash
git add src/components/FundFlowEditor.vue tests/components/FundFlowEditor.spec.ts
git commit -m "feat(公积金): 新增 FundFlowEditor 月流水编辑弹层"
```

---

## Task 6: 公积金余额列三态（click→FundFlowEditor / 右键锚点 / hover / 接入）

**Files:**
- Modify: `src/components/MonthlyTable.vue`
- Test: `tests/components/MonthlyTable.spec.ts`

余额单元格：左键开 FundFlowEditor、右键出锚点菜单（新增 `FUND_BALANCE_COLUMN_ID`）、`isFundAnchor` 高亮、hover 余额公式。

- [ ] **Step 1: 写失败测试**

在「公积金专区」describe 内追加：

```ts
  it('点击公积金余额单元格打开 FundFlowEditor', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.enableFund()
    store.updateFundEntry('contribution', 202601, 1000)
    const results = calculate(store.data.value)

    const MonthlyTable = (await import('../../src/components/MonthlyTable.vue')).default
    const wrapper = mount(MonthlyTable, { props: { results } })

    await wrapper.find('[data-fund-balance="202601"]').trigger('click')
    expect(wrapper.findComponent({ name: 'FundFlowEditor' }).exists()).toBe(true)
  })

  it('右键公积金余额弹出锚点菜单（仅清除下方公积金锚点）', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.enableFund()
    store.addFundAnchor(202603, 500000) // 下方有公积金锚点
    const results = calculate(store.data.value)

    const MonthlyTable = (await import('../../src/components/MonthlyTable.vue')).default
    const wrapper = mount(MonthlyTable, { props: { results } })

    await wrapper.find('[data-fund-balance="202601"]').trigger('contextmenu')
    const menu = wrapper.findComponent({ name: 'ContextMenu' })
    expect(menu.exists()).toBe(true)
    const labels = menu.props('items').map((i: any) => i.label)
    expect(labels).toContain('清除下方公积金锚点')
    expect(labels).not.toContain('同步到下方每年此月')
  })

  it('公积金锚点月余额单元格高亮', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.enableFund()
    store.updateFundEntry('contribution', 202601, 1000)
    store.addFundAnchor(202603, 500000)
    const results = calculate(store.data.value)

    const MonthlyTable = (await import('../../src/components/MonthlyTable.vue')).default
    const wrapper = mount(MonthlyTable, { props: { results } })

    const anchorCell = wrapper.find('[data-fund-balance="202603"]')
    expect(anchorCell.classes()).toContain('bg-brand-50')
  })

  it('余额单元格 hover 展示公积金余额公式', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.enableFund()
    store.updateFundEntry('contribution', 202601, 1000)
    const results = calculate(store.data.value)

    const MonthlyTable = (await import('../../src/components/MonthlyTable.vue')).default
    const wrapper = mount(MonthlyTable, { props: { results } })

    await wrapper.find('[data-fund-balance="202601"] span').trigger('mouseenter')
    expect(wrapper.text()).toContain('上月余额')
  })
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/components/MonthlyTable.spec.ts -t "公积金专区"`
Expected: FAIL —— `[data-fund-balance=...]` 不存在。

- [ ] **Step 3: script——FUND_BALANCE_COLUMN_ID + FundFlowEditor 状态 + 右键扩展**

在 `<script setup>` 顶部 import 区追加：

```ts
import FundFlowEditor from './FundFlowEditor.vue'
```

在 `BALANCE_COLUMN_ID` 常量（约 line 253）之后追加：

```ts
// 公积金余额列在右键菜单逻辑中的特殊列标识
const FUND_BALANCE_COLUMN_ID = '__fund_balance__'
```

在 `eventEditor` 状态（约 line 41）附近追加 FundFlowEditor 状态：

```ts
// 公积金流水编辑器状态
const fundFlowEditor = ref<{ month: number; x: number; y: number } | null>(null)
function openFundFlowEditor(month: number, event: MouseEvent) {
  fundFlowEditor.value = { month, x: event.clientX, y: event.clientY }
}
function closeFundFlowEditor() {
  fundFlowEditor.value = null
}
```

把 `editedBelowRows`（约 line 259-263）替换为支持 fund 余额列：

```ts
function editedBelowRows(columnId: string, month: number): MonthResult[] {
  return props.results.filter(r =>
    r.month > month &&
    (columnId === BALANCE_COLUMN_ID ? r.isAnchor
      : columnId === FUND_BALANCE_COLUMN_ID ? r.isFundAnchor
      : getColumnValue(r, columnId).isEdited))
}
```

把 `clearEditedBelow`（约 line 271-279）替换为支持 fund 余额列：

```ts
function clearEditedBelow(columnId: string, month: number): void {
  editedBelowRows(columnId, month).forEach(r => {
    if (columnId === BALANCE_COLUMN_ID) {
      store.removeAnchor(r.month)
    } else if (columnId === FUND_BALANCE_COLUMN_ID) {
      store.removeFundAnchor(r.month)
    } else {
      store.updateColumnEntry(columnId, r.month, null)
    }
  })
}
```

把 `contextMenuItems` computed（约 line 287-311）的「同步到下方每年此月」判断与「清除」标签扩展。将整个 computed 替换为：

```ts
const contextMenuItems = computed(() => {
  const ctx = contextMenu.value
  if (!ctx) return []
  const items: { label: string; disabled?: boolean; onClick: () => void }[] = []

  const isBalanceColumn = ctx.columnId === BALANCE_COLUMN_ID || ctx.columnId === FUND_BALANCE_COLUMN_ID

  // 同步到下方每年此月：仅现金流列，且该月存在直接编辑值时启用
  if (!isBalanceColumn) {
    const column = columns.value.find(c => c.id === ctx.columnId)
    const hasDirectEntry = column ? String(ctx.month) in column.entries : false
    items.push({
      label: '同步到下方每年此月',
      disabled: !hasDirectEntry,
      onClick: () => store.syncYearly(ctx.columnId, ctx.month),
    })
  }

  const count = countEditedBelow(ctx.columnId, ctx.month)
  const clearLabel = ctx.columnId === FUND_BALANCE_COLUMN_ID
    ? '清除下方公积金锚点'
    : '清除下方编辑值'
  items.push({
    label: clearLabel,
    disabled: count === 0,
    onClick: () => clearEditedBelow(ctx.columnId, ctx.month),
  })

  return items
})
```

- [ ] **Step 4: template——余额单元格三态 + 模板末尾挂载 FundFlowEditor**

把 Task 3 Step 5 的「公积金余额」`<td>` 替换为：

```html
            <td
              class="px-1 py-0 text-right tabular-nums whitespace-nowrap cursor-pointer"
              :class="{ 'bg-brand-50': result.isFundAnchor }"
              :data-fund-balance="result.month"
              @click="openFundFlowEditor(result.month, $event)"
              @contextmenu.prevent="openContextMenu(FUND_BALANCE_COLUMN_ID, result.month, $event)"
            >
              <span
                class="block w-full"
                :aria-label="getFormulaAriaLabel(result, 'fundBalance')"
                @mouseenter="showFormula(result, 'fundBalance', $event)"
                @mouseleave="popover = null"
              >{{ formatCurrency(result.fundBalance) }}</span>
            </td>
```

在模板末尾 `<EventDetailPopover ... />`（约 line 784-792）之后追加：

```html
  <FundFlowEditor
    v-if="fundFlowEditor"
    :month="fundFlowEditor.month"
    :result="results.find(r => r.month === fundFlowEditor!.month)!"
    :prev-fund-balance="fundPrevBalance(fundFlowEditor.month)"
    :withdrawals="fundWithdrawalsByMonth(fundFlowEditor.month)"
    :x="fundFlowEditor.x"
    :y="fundFlowEditor.y"
    @close="closeFundFlowEditor"
  />
```

并在 script 补两个 helper（`fundPrevBalance` / `fundWithdrawalsByMonth`）：

```ts
function fundPrevBalance(month: number): number {
  const idx = props.results.findIndex(r => r.month === month)
  if (idx <= 0) return store.data.value.systemParams.fundInitialBalance ?? 0
  return props.results[idx - 1].fundBalance
}
function fundWithdrawalsByMonth(month: number): FundWithdrawal[] {
  return fund.value?.withdrawals.filter(w => w.month === month) ?? []
}
```

`FundWithdrawal` 类型补到顶部 import（`import type { MonthResult, FlowColumn, MilestoneEvent, FundWithdrawal } from '../types'`）。

- [ ] **Step 5: 运行测试确认通过**

Run: `npx vitest run tests/components/MonthlyTable.spec.ts`
Expected: PASS —— 新增 4 个余额交互用例 + 现有回归。

- [ ] **Step 6: 提交**

```bash
git add src/components/MonthlyTable.vue tests/components/MonthlyTable.spec.ts
git commit -m "feat(公积金): 余额列三态交互与 FUND_BALANCE 右键锚点菜单"
```

---

## Task 7: AnnualTable 公积金/总资产行 + aggregateByYear 扩展

**Files:**
- Modify: `src/composables/useCalculation.ts`（`YearlyPoint` + `aggregateByYear`）
- Modify: `src/components/AnnualTable.vue`
- Test: `tests/components/AnnualTable.spec.ts`

`aggregateByYear` 补 totalAssets/fundBalance 年末值；AnnualTable 在「年末存款」行后加「公积金」「总资产」两行（仅 fund 启用），hover 公式。

- [ ] **Step 1: 写失败测试**

在 `tests/components/AnnualTable.spec.ts`（已有年度表测试）末尾新增 describe：

```ts
import { calculate } from '../../src/composables/useCalculation'

describe('AnnualTable · 公积金/总资产', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  it('未启用 fund 时不渲染公积金/总资产行', async () => {
    const useStore = (await import('../../src/composables/useStore')).useStore
    useStore()
    const AnnualTable = (await import('../../src/components/AnnualTable.vue')).default
    const results = calculate(useStore().data.value)
    const wrapper = mount(AnnualTable, { props: { results } })
    const rowLabels = wrapper.findAll('tbody td:first-child').map(td => td.text())
    expect(rowLabels).not.toContain('公积金')
    expect(rowLabels).not.toContain('总资产')
  })

  it('启用 fund 后渲染公积金与总资产行（年末值）', async () => {
    const useStore = (await import('../../src/composables/useStore')).useStore
    const store = useStore()
    store.enableFund()
    store.updateFundEntry('contribution', store.data.value.systemParams.startMonth, 1000)
    const results = calculate(store.data.value)

    const AnnualTable = (await import('../../src/components/AnnualTable.vue')).default
    const wrapper = mount(AnnualTable, { props: { results } })
    const rowLabels = wrapper.findAll('tbody td:first-child').map(td => td.text())
    expect(rowLabels).toContain('公积金')
    expect(rowLabels).toContain('总资产')
  })

  it('aggregateByYear 含 totalAssets/fundBalance 年末值', async () => {
    const { aggregateByYear } = await import('../../src/composables/useCalculation')
    const useStore = (await import('../../src/composables/useStore')).useStore
    const store = useStore()
    store.enableFund()
    store.updateFundEntry('contribution', store.data.value.systemParams.startMonth, 1000)
    const results = calculate(store.data.value)
    const years = aggregateByYear(results)
    for (const y of years) {
      expect(typeof y.totalAssets).toBe('number')
      expect(typeof y.fundBalance).toBe('number')
    }
  })
})
```

> 顶部需 `import { mount } from '@vue/test-utils'`、`import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'`（按文件现有 import 补齐缺失项）。

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/components/AnnualTable.spec.ts -t "公积金/总资产"`
Expected: FAIL —— 无「公积金」「总资产」行 / `totalAssets` 字段不存在。

- [ ] **Step 3: useCalculation——YearlyPoint + aggregateByYear 扩展**

把 `YearlyPoint`（`src/composables/useCalculation.ts` 约 line 291-296）替换为：

```ts
export interface YearlyPoint {
  year: number
  income: number      // 该自然年 monthlyIncome 求和
  expense: number     // 该自然年 monthlyExpense 求和（正数；绘制时取负）
  cumSavings: number  // 该自然年最后一月的 cumSavings（年末存款）
  totalAssets: number // 该自然年最后一月的 totalAssets（年末总资产）
  fundBalance: number // 该自然年最后一月的 fundBalance（年末公积金）
}
```

把 `aggregateByYear` 的 `.map(([year, months]) => ({...}))`（约 line 316-323）替换为：

```ts
    .map(([year, months]) => ({
      year,
      income: months.reduce((sum, r) => sum + r.monthlyIncome, 0),
      expense: months.reduce((sum, r) => sum + r.monthlyExpense, 0),
      cumSavings: months[months.length - 1].cumSavings,
      totalAssets: months[months.length - 1].totalAssets,
      fundBalance: months[months.length - 1].fundBalance,
    }))
```

- [ ] **Step 4: AnnualTable——加 fund/totalAssets 年末值 + 两行 + hover**

在 `src/components/AnnualTable.vue` 的 `yearSummaries` computed `.map` 返回对象（约 line 91-100）追加两字段：

```ts
        endSavings: lastResult.cumSavings,
        fundBalance: lastResult.fundBalance,
        totalAssets: lastResult.totalAssets,
```

> `YearSummary` 类型（`src/types.ts`）目前无 fundBalance/totalAssets。在该 interface 加可选字段：

在 `src/types.ts` 的 `YearSummary`（约 line 109-117）末尾 `}` 前追加：

```ts
  fundBalance?: number   // 年末公积金余额（fund 启用时）
  totalAssets?: number   // 年末总资产（fund 启用时）
```

在 AnnualTable script 加 fund 判断与 year 公式 ctx 字段（`showYearFormula` 内）：

```ts
const fund = computed(() => store.data.value.fund)
```

把 `showYearFormula`（约 line 41-52）的 ctx 构造追加年末 fund 字段：

```ts
  const ctx: YearFormulaContext = {
    isFirstYear: idx === 0,
    firstMonthIsAnchor: idx === 0 && isFirstMonthAnchor(),
    initialDeposit: store.data.value.systemParams.initialDeposit ?? 0,
    prevYearEndSavings: idx > 0 ? yearSummaries.value[idx - 1].endSavings : 0,
    events: eventsByYear.value.get(summary.year) ?? [],
    yearEndFundBalance: summary.fundBalance ?? 0,
    yearEndTotalAssets: summary.totalAssets ?? 0,
  }
```

在模板「年末存款」`<tr>`（约 line 225-239）之后、`</tbody>` 之前插入（仅 fund 启用）：

```html
        <template v-if="fund">
          <tr class="border-b">
            <td class="px-1 py-0 whitespace-nowrap">公积金</td>
            <td
              v-for="summary in yearSummaries"
              :key="`fund-${summary.year}`"
              class="px-1 py-0 text-right tabular-nums whitespace-nowrap"
            >
              <span
                class="block w-full"
                @mouseenter="showYearFormula(summary, 'fundBalance', $event)"
                @mouseleave="popover = null"
              >{{ formatCurrency(summary.fundBalance ?? 0) }}</span>
            </td>
          </tr>
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
        </template>
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npx vitest run tests/components/AnnualTable.spec.ts`
Expected: PASS —— 新增 3 个用例 + 现有回归。

- [ ] **Step 6: 提交**

```bash
git add src/composables/useCalculation.ts src/types.ts src/components/AnnualTable.vue tests/components/AnnualTable.spec.ts
git commit -m "feat(公积金): AnnualTable 新增公积金/总资产年度行与 aggregateByYear 扩展"
```

---

## Task 8: FinanceChart 双线 + 退化

**Files:**
- Modify: `src/utils/financeChart.ts`
- Modify: `src/components/FinanceChart.vue`
- Test: `tests/utils/financeChart.spec.ts`

主线累计储蓄→总资产，叠加公积金余额副线（仅 fund 启用）；`buildChartOption(data, fundEnabled)` 显式 flag。

- [ ] **Step 1: 更新现有断言 + 写新失败测试**

`tests/utils/financeChart.spec.ts` 现有断言基于旧契约（`buildChartData` 返回无 totalAssets/fundBalance；`buildChartOption` 单参数 + 「累计储蓄」名）。本步先**更新**它们以匹配新契约，再新增双线/退化测试。

**1a. 更新 `makeResult` helper（补 fund 字段，否则 buildChartData 取到 undefined）**，把 line 5-18 的 `makeResult` 替换为：

```ts
function makeResult(overrides: Partial<MonthResult> = {}): MonthResult {
  return {
    month: 202601,
    columnValues: [],
    totalFlow: 0,
    investReturn: 0,
    monthlyIncome: 0,
    monthlyExpense: 0,
    monthlyBalance: 0,
    cumSavings: 0,
    isAnchor: false,
    fundBalance: 0,
    fundInterest: 0,
    fundContribution: 0,
    fundOffset: 0,
    fundWithdrawal: 0,
    fundOutflow: 0,
    isFundAnchor: false,
    totalAssets: 0,
    ...overrides,
  }
}
```

**1b. 更新 `buildChartData` 两个用例**（`toEqual` 深相等需含新字段）。`按月` 用例（line 35-40）替换为：

```ts
    expect(buildChartData(results, 'month')).toEqual({
      categories: ['26/01', '26/02'],
      income: [10000, 10000],
      expense: [-6000, -6000],
      cumSavings: [50000, 55000],
      totalAssets: [50000, 55000],
      fundBalance: [0, 0],
    })
```

`按年` 用例（line 49-54）替换为：

```ts
    expect(buildChartData(results, 'year')).toEqual({
      categories: ['2026', '2027'],
      income: [10000, 12000],
      expense: [-5000, -5000],
      cumSavings: [110000, 120000],
      totalAssets: [110000, 120000],
      fundBalance: [0, 0],
    })
```

**1c. 更新 `buildChartOption` 用例**（2 参数 + 总资产名 + data 补新字段）。`三系列` 用例（line 59-76）替换为：

```ts
  it('三系列：收入/支出走左轴，总资产走右轴；数据与配色正确（退化模式）', () => {
    const data = { categories: ['26/01'], income: [10000], expense: [-6000], cumSavings: [50000], totalAssets: [50000], fundBalance: [0] }

    const option = buildChartOption(data, false)

    expect(option.series.map(s => s.name)).toEqual(['收入', '支出', '总资产'])
    expect(option.series.map(s => s.type)).toEqual(['bar', 'bar', 'line'])
    expect(option.series[0].yAxisIndex).toBe(0)
    expect(option.series[1].yAxisIndex).toBe(0)
    expect(option.series[2].yAxisIndex).toBe(1)
    expect(option.series[0].data).toEqual([10000])
    expect(option.series[1].data).toEqual([-6000])
    expect(option.series[2].data).toEqual([50000])
    expect(option.series[0].itemStyle?.color).toBe('#dc2626')
    expect(option.series[1].itemStyle?.color).toBe('#15803d')
    expect(option.xAxis.data).toEqual(['26/01'])
    expect(option.legend.data).toEqual(['收入', '支出', '总资产'])
  })
```

**1d. 新增双线/退化用例**，在 `describe('buildChartOption', ...)` 之后追加：

```ts
describe('fund 双线', () => {
  it('buildChartData 含 totalAssets / fundBalance 数组', () => {
    const results: MonthResult[] = [
      makeResult({ month: 202601, cumSavings: 100, fundBalance: 50, totalAssets: 150 }),
    ]
    const data = buildChartData(results, 'month')
    expect(data.totalAssets).toEqual([150])
    expect(data.fundBalance).toEqual([50])
  })

  it('buildChartOption fundEnabled=true 含总资产与公积金余额两条线', () => {
    const data = buildChartData([], 'month')
    const opt = buildChartOption(data, true)
    const names = opt.series.map(s => s.name)
    expect(names).toEqual(['收入', '支出', '总资产', '公积金余额'])
    expect(opt.legend.data).toEqual(['收入', '支出', '总资产', '公积金余额'])
    // 公积金余额为第 4 条，右轴
    expect(opt.series[3].yAxisIndex).toBe(1)
  })

  it('buildChartOption fundEnabled=false 仅总资产线（退化）', () => {
    const data = buildChartData([], 'month')
    const opt = buildChartOption(data, false)
    const names = opt.series.map(s => s.name)
    expect(names).toContain('总资产')
    expect(names).not.toContain('公积金余额')
    expect(opt.legend.data).not.toContain('公积金余额')
  })
})
```

> 顶部 `import { buildChartData, buildChartOption } from '../../src/utils/financeChart'` 与 `import type { MonthResult } from '../../src/types'` 已存在（line 1-3），无需改。

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/utils/financeChart.spec.ts`
Expected: FAIL —— `data.totalAssets` 不存在 / `buildChartOption` 只接受 1 参数。

- [ ] **Step 3: financeChart.ts——ChartData + buildChartData + buildChartOption**

把 `ChartData` interface（约 line 6-11）替换为：

```ts
export interface ChartData {
  categories: string[]
  income: number[]
  expense: number[]      // 已取负（支出向下）
  cumSavings: number[]
  totalAssets: number[]  // 总资产（cumSavings + fundBalance）
  fundBalance: number[]  // 公积金余额
}
```

新增配色常量（在 `COLOR_CUM` 附近）：

```ts
const COLOR_FUND = '#d97706'   // 公积金余额副线（琥珀）
```

把 `buildChartData`（约 line 49-66）替换为：

```ts
export function buildChartData(results: MonthResult[], granularity: Granularity): ChartData {
  if (granularity === 'year') {
    const years = aggregateByYear(results)
    return {
      categories: years.map(p => String(p.year)),
      income: years.map(p => p.income),
      expense: years.map(p => -p.expense),
      cumSavings: years.map(p => p.cumSavings),
      totalAssets: years.map(p => p.totalAssets),
      fundBalance: years.map(p => p.fundBalance),
    }
  }

  return {
    categories: results.map(r => formatAxisLabel(r.month)),
    income: results.map(r => r.monthlyIncome),
    expense: results.map(r => -r.monthlyExpense),
    cumSavings: results.map(r => r.cumSavings),
    totalAssets: results.map(r => r.totalAssets),
    fundBalance: results.map(r => r.fundBalance),
  }
}
```

把 `buildChartOption`（约 line 72-88）替换为（接受 `fundEnabled`，主线改总资产，条件加公积金线）：

```ts
export function buildChartOption(data: ChartData, fundEnabled: boolean): ChartOption {
  const legendData = fundEnabled ? ['收入', '支出', '总资产', '公积金余额'] : ['收入', '支出', '总资产']
  const series: ChartSeries[] = [
    { name: '收入', type: 'bar', yAxisIndex: 0, data: data.income, itemStyle: { color: COLOR_INCOME } },
    { name: '支出', type: 'bar', yAxisIndex: 0, data: data.expense, itemStyle: { color: COLOR_EXPENSE } },
    { name: '总资产', type: 'line', yAxisIndex: 1, data: data.totalAssets, smooth: true, showSymbol: false, lineStyle: { color: COLOR_CUM, width: 2.5 }, itemStyle: { color: COLOR_CUM } },
  ]
  if (fundEnabled) {
    series.push({
      name: '公积金余额', type: 'line', yAxisIndex: 1, data: data.fundBalance,
      smooth: true, showSymbol: false, lineStyle: { color: COLOR_FUND }, itemStyle: { color: COLOR_FUND },
    })
  }
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: legendData },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', data: data.categories, axisLine: { lineStyle: { color: COLOR_AXIS } } },
    yAxis: [
      { type: 'value', alignTicks: true, splitLine: { lineStyle: { color: COLOR_GRID } } },
      { type: 'value', alignTicks: true, splitLine: { lineStyle: { color: COLOR_GRID } } },
    ],
    series,
  }
}
```

> `ChartSeries.lineStyle.width` 字段：现有 `ChartSeries` interface 有 `lineStyle?: { color: string }`，需扩展为 `lineStyle?: { color: string; width?: number }`。在 `ChartSeries`（约 line 13-22）把 `lineStyle?: { color: string }` 改为 `lineStyle?: { color: string; width?: number }`。

- [ ] **Step 4: FinanceChart.vue——读 fund 存在性并传 fundEnabled**

在 `src/components/FinanceChart.vue` `<script setup>` import 区与 setup 内：

```ts
import { useStore } from '../composables/useStore'
```

```ts
const store = useStore()
const fundEnabled = computed(() => !!store.data.value.fund)
```

把 `render()`（约 line 27-30）替换为：

```ts
function render() {
  chart?.setOption(buildChartOption(chartData.value, fundEnabled.value) as unknown as echarts.EChartsCoreOption)
}
```

> `computed` 已在顶部 import（line 2）。`render` 由 `watch(chartData, render)` 触发；fund 开关切换会改 `chartData`（results 变）从而重渲染。若需 fund 开关本身（不改 results）也触发，追加 `watch(fundEnabled, render)`。

在 `watch(chartData, render)`（约 line 40）之后追加：

```ts
watch(fundEnabled, render)
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npx vitest run tests/utils/financeChart.spec.ts tests/components/FinanceChart.spec.ts`
Expected: PASS —— 新增双线/退化用例 + 现有 financeChart 单测与组件测试回归。

- [ ] **Step 6: 全量回归 + 类型检查 + 构建**

Run: `npx vitest run && npx vue-tsc --noEmit && npm run build`
Expected: 全部测试通过；无类型错误；构建成功。

- [ ] **Step 7: 提交**

```bash
git add src/utils/financeChart.ts src/components/FinanceChart.vue tests/utils/financeChart.spec.ts
git commit -m "feat(公积金): FinanceChart 总资产主线 + 公积金余额双线与退化"
```

---

## 完成判定

- [ ] 8 个 task 全部提交，`npx vitest run` 全绿（335 基线 + 新增）。
- [ ] `npx vue-tsc --noEmit` 无类型错误。
- [ ] `npm run build` 通过。
- [ ] 无 fund 时 UI 完全退化（专区/图表公积金线不出现，年度表无公积金/总资产行，总资产=存款），与改造前一致。
- [ ] 不破坏既有 header 两行结构 / 视图三按钮 / ToolsMenu「更多」断言。
- [ ] 每任务独立提交，提交信息中文。
- [ ] 手动验证（`npm run dev`）：勾选公积金启用开关 → 月表出现专区 5 列 → 编辑房贷/缴存/月冲 → 月冲未填淡灰联动 → 点余额开 FundFlowEditor 编辑提取 → 右键余额清锚点 → 年度表多公积金/总资产行 → 图表总资产+公积金双线。
