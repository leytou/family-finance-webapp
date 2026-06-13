# 住房公积金（核心计算与状态层）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为家庭财务规划工具引入独立公积金账户的核心数据模型、双账户计算引擎与状态管理（含持久化校验/迁移），全部可单元测试验证。

**Architecture:** 在现有单一"累计储蓄"账户基础上，新增独立 `fund` 子结构（第二资金池）。`calculate()` 改为集中式双账户循环：可支配账户不变，新增 `processFund()` 纯函数处理公积金缴存/提取/月冲/按年结息；月冲默认联动房贷月供；公积金转出抵扣可支配支出。`useStore` 扩展校验、normalize 与操作函数。`fund` 为可选字段，保证向后兼容。

**Tech Stack:** Vue 3 (Composition API + TypeScript)、Vitest、localStorage 持久化。

**范围说明：** 本计划覆盖**核心计算与状态层**（任务 1–6），可独立单元测试。UI 集成（MonthlyTable 专区列、FundFlowEditor、AnnualTable、FinanceChart、FormulaPopover、App.vue 参数）作为核心完成后的**后续计划**，因为 UI 增量建立在已验证的核心之上。

**对应 spec：** `docs/superpowers/specs/2026-06-14-housing-fund-design.md`

---

## 文件结构

| 文件 | 责任 | 本计划动作 |
|---|---|---|
| `src/types.ts` | 核心类型定义 | 新增 `FundWithdrawal`/`FundAnchor`/`FundConfig`；扩展 `SystemParams`/`PlanData`/`MonthResult` |
| `src/composables/useCalculation.ts` | 月度计算引擎 | 新增 `hasColumnValue`/`resolveFundOffset`/`processFund`；改造 `calculate` 为双账户循环 |
| `src/composables/useStore.ts` | 状态管理与持久化 | 新增 fund 校验/normalize/操作函数；放宽 `isValidPlanData` |
| `tests/composables/useCalculation.spec.ts` | 计算引擎测试 | 更新 helper；新增 fund 测试用例 |
| `tests/composables/useStore.spec.ts` | store 测试 | 新增 fund 校验/操作测试 |

---

## Task 1: 数据模型（`src/types.ts`）

**Files:**
- Modify: `src/types.ts`

本任务定义所有新类型与字段扩展，是后续任务的基础。纯类型变更，无独立测试（由后续任务的测试覆盖）。

- [ ] **Step 1: 新增 fund 相关接口**

在 `src/types.ts` 的 `MilestoneEvent` 接口之后、`MonthlyAnchor` 之前，插入：

```ts
// 单月一次性公积金提取（买房首付等）：从公积金账户转出到可支配储蓄
export interface FundWithdrawal {
  id: string
  name: string        // 如「买房提取」
  month: number       // YYYYMM
  amount: number      // 元，正数
}

// 公积金账户余额锚点（校验用，同 MonthlyAnchor 语义）
export interface FundAnchor {
  month: number
  actualBalance: number
}

// 公积金配置（PlanData.fund，可选；缺失=无公积金）
export interface FundConfig {
  mortgage: FlowColumn        // 房贷月供（专区固定列，进可支配支出 totalFlow）
  contribution: FlowColumn    // 公积金缴存（稀疏+yearly，进公积金账户）
  monthlyOffset: FlowColumn   // 公积金月冲（稀疏+yearly；未手填时默认取 mortgage 同月值）
  withdrawals: FundWithdrawal[]   // 单月提取
  anchors: FundAnchor[]           // 公积金余额锚点
}
```

- [ ] **Step 2: 扩展 `SystemParams`**

将 `SystemParams`（`src/types.ts:29-33`）替换为：

```ts
export interface SystemParams {
  startMonth: number
  annualRate: number
  initialDeposit?: number   // 初始存款（元），作为累计计算的起点本金；缺失视为 0
  fundRate: number            // 公积金年利率，默认 0.015
  fundInterestMonth: number   // 公积金结息月 1-12，默认 7
  fundInitialBalance?: number // 初始公积金余额（元），缺失视为 0
}
```

- [ ] **Step 3: 扩展 `PlanData`**

将 `PlanData`（`src/types.ts:35-42`）替换为：

```ts
export interface PlanData {
  version: number
  systemParams: SystemParams
  columns: FlowColumn[]
  anchors: MonthlyAnchor[]
  snapshots: PlanSnapshot[]
  events: MilestoneEvent[]   // 单月一次性大额事件；脉冲，不携带延续
  fund?: FundConfig          // 公积金配置；缺失=无公积金，向后兼容
}
```

- [ ] **Step 4: 扩展 `MonthResult`**

将 `MonthResult`（`src/types.ts:44-54`）替换为：

```ts
export interface MonthResult {
  month: number
  columnValues: { id: string; name: string; amount: number; isEdited: boolean; enabled?: boolean }[]
  totalFlow: number
  investReturn: number
  monthlyIncome: number
  monthlyExpense: number
  monthlyBalance: number
  cumSavings: number
  isAnchor: boolean
  // —— 公积金账户（无 fund 时均为 0/false）——
  fundBalance: number       // 月末公积金账户余额
  fundInterest: number      // 当月入账结息（仅结息月非 0）
  fundContribution: number  // 当月缴存额（展示用）
  fundOffset: number        // 当月月冲额（实际扣取，已截断）
  fundWithdrawal: number    // 当月提取额（实际扣取，已截断）
  fundOutflow: number       // 当月转出到可支配合计 = fundOffset + fundWithdrawal
  isFundAnchor: boolean     // 该月公积金余额是否被锚点覆盖
  totalAssets: number       // = cumSavings + fundBalance
}
```

- [ ] **Step 5: 类型检查通过**

Run: `npx vue-tsc --noEmit`
Expected: 无新增类型错误（注意：`useCalculation.ts`、`useStore.ts` 中构造 `MonthResult`/`PlanData` 的地方会因缺少新字段而报错，这是预期的，将在 Task 4/5 修复；本步只需确认 `types.ts` 本身无语法/类型错误）。

- [ ] **Step 6: Commit**

```bash
git add src/types.ts
git commit -m "feat(公积金): 新增 fund 数据模型与 MonthResult/PlanData/SystemParams 扩展"
```

---

## Task 2: `hasColumnValue` 辅助函数

为月冲"默认联动房贷月供"提供判定依据：判断某列在指定月是否有用户输入（直接编辑或向前延续），区别于"规则3 无任何 entry 返回 0"。独立新增，**不改动** `resolveColumnValue` 的返回契约，避免破坏现有 11 处 `toEqual` 断言。

**Files:**
- Modify: `src/composables/useCalculation.ts`
- Test: `tests/composables/useCalculation.spec.ts`

- [ ] **Step 1: 写失败测试**

在 `tests/composables/useCalculation.spec.ts` 顶部的 import 中加入 `hasColumnValue`：

```ts
import { calculate, resolveColumnValue, hasColumnValue, buildComparison, aggregateByYear } from '../../src/composables/useCalculation'
```

在 `describe('resolveColumnValue', ...)` 块**之后**新增：

```ts
describe('hasColumnValue', () => {
  it('该月有直接编辑值 → true', () => {
    const column: FlowColumn = { id: 'c1', name: 'x', entries: { 202601: 100 } }
    expect(hasColumnValue(column, 202601)).toBe(true)
  })

  it('该月向前延续到非零 entry → true', () => {
    const column: FlowColumn = { id: 'c1', name: 'x', entries: { 202601: 100 } }
    expect(hasColumnValue(column, 202603)).toBe(true)
  })

  it('该月向前延续到 0 entry → true（0 也是有效输入）', () => {
    const column: FlowColumn = { id: 'c1', name: 'x', entries: { 202601: 0 } }
    expect(hasColumnValue(column, 202603)).toBe(true)
  })

  it('完全无任何 entry → false', () => {
    const column: FlowColumn = { id: 'c1', name: 'x', entries: {} }
    expect(hasColumnValue(column, 202601)).toBe(false)
  })

  it('仅有 yearly 标记月、其后非同月 → false（yearly 不作延续源）', () => {
    const column: FlowColumn = { id: 'c1', name: 'x', entries: { 202612: 500 }, yearlyMonths: { 202612: true } }
    expect(hasColumnValue(column, 202701)).toBe(false)
  })

  it('yearly 月本身 → true', () => {
    const column: FlowColumn = { id: 'c1', name: 'x', entries: { 202612: 500 }, yearlyMonths: { 202612: true } }
    expect(hasColumnValue(column, 202612)).toBe(true)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/composables/useCalculation.spec.ts -t "hasColumnValue"`
Expected: FAIL，`hasColumnValue is not defined`（或导入失败）。

- [ ] **Step 3: 实现 `hasColumnValue`**

在 `src/composables/useCalculation.ts` 的 `resolveColumnValue` 函数**之后**插入：

```ts
/**
 * 判断某列在指定月是否有「用户输入值」（直接编辑或向前延续，含 0）。
 * 区别于 resolveColumnValue 的「规则3 无任何 entry 返回 0」：本函数在那种情况下返回 false。
 * 供月冲默认联动判定（未手填月冲时回退到房贷月供）。
 */
export function hasColumnValue(column: FlowColumn, month: number): boolean {
  // 直接编辑值
  if (String(month) in column.entries) return true

  // 向前查找最近的非 yearly entry（与 resolveColumnValue 规则2 一致）
  const isYearlyKey = (k: number) => Boolean(column.yearlyMonths?.[k])
  const entryKeys = Object.keys(column.entries)
    .map(Number)
    .filter(key => key < month && !isYearlyKey(key))
  return entryKeys.length > 0
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/composables/useCalculation.spec.ts -t "hasColumnValue"`
Expected: PASS（6 个用例全绿）。

- [ ] **Step 5: 全量回归**

Run: `npx vitest run tests/composables/useCalculation.spec.ts`
Expected: 全部通过（确认未破坏现有 `resolveColumnValue` 测试）。

- [ ] **Step 6: Commit**

```bash
git add src/composables/useCalculation.ts tests/composables/useCalculation.spec.ts
git commit -m "feat(公积金): 新增 hasColumnValue 辅助函数（月冲默认联动判定基础）"
```

---

## Task 3: `resolveFundOffset` 月冲默认联动

月冲未手填时自动取同行房贷月供值。

**Files:**
- Modify: `src/composables/useCalculation.ts`
- Test: `tests/composables/useCalculation.spec.ts`

- [ ] **Step 1: 写失败测试**

在 `tests/composables/useCalculation.spec.ts` 的 import 中加入 `resolveFundOffset` 与 `FundConfig` 类型：

```ts
import { calculate, resolveColumnValue, hasColumnValue, resolveFundOffset, buildComparison, aggregateByYear } from '../../src/composables/useCalculation'
import type { PlanData, FlowColumn, MonthResult, PlanSnapshot, FundConfig } from '../../src/types'
```

在 `hasColumnValue` 的 describe 块之后新增：

```ts
describe('resolveFundOffset', () => {
  function makeFund(overrides: Partial<FundConfig> = {}): FundConfig {
    return {
      mortgage: { id: 'm', name: '房贷月供', entries: { 202601: 5000 } },
      contribution: { id: 'c', name: '公积金缴存', entries: {} },
      monthlyOffset: { id: 'o', name: '公积金月冲', entries: {} },
      withdrawals: [],
      anchors: [],
      ...overrides,
    }
  }

  it('月冲未手填 → 默认取房贷月供', () => {
    const fund = makeFund()
    expect(resolveFundOffset(fund, 202601)).toBe(5000)
    expect(resolveFundOffset(fund, 202603)).toBe(5000) // 房贷延续
  })

  it('月冲有直接编辑值 → 用月冲自身值', () => {
    const fund = makeFund({ monthlyOffset: { id: 'o', name: '公积金月冲', entries: { 202601: 3000 } } })
    expect(resolveFundOffset(fund, 202601)).toBe(3000)
  })

  it('月冲向前延续 → 用延续值', () => {
    const fund = makeFund({ monthlyOffset: { id: 'o', name: '公积金月冲', entries: { 202601: 3000 } } })
    expect(resolveFundOffset(fund, 202603)).toBe(3000)
  })

  it('月冲与房贷都无值 → 0', () => {
    const fund = makeFund({
      mortgage: { id: 'm', name: '房贷月供', entries: {} },
    })
    expect(resolveFundOffset(fund, 202601)).toBe(0)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/composables/useCalculation.spec.ts -t "resolveFundOffset"`
Expected: FAIL，`resolveFundOffset is not defined`。

- [ ] **Step 3: 实现 `resolveFundOffset`**

在 `src/composables/useCalculation.ts` 的 `hasColumnValue` 之后插入：

```ts
/**
 * 解析月冲在指定月的「目标值」：月冲有用户输入（直接编辑或延续）则用之，
 * 否则默认取房贷月供（mortgage）同月解析值（自动全额抵扣房贷）。
 */
export function resolveFundOffset(fund: FundConfig, month: number): number {
  if (hasColumnValue(fund.monthlyOffset, month)) {
    return resolveColumnValue(fund.monthlyOffset, month).amount
  }
  return resolveColumnValue(fund.mortgage, month).amount
}
```

并在文件顶部 import 中补 `FundConfig` 类型：

```ts
import type { FlowColumn, FundConfig, MonthResult, PlanData, PlanSnapshot } from '../types'
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/composables/useCalculation.spec.ts -t "resolveFundOffset"`
Expected: PASS（4 个用例全绿）。

- [ ] **Step 5: Commit**

```bash
git add src/composables/useCalculation.ts tests/composables/useCalculation.spec.ts
git commit -m "feat(公积金): 新增 resolveFundOffset 月冲默认联动房贷月供"
```

---

## Task 4: 双账户计算循环（`calculate` + `processFund`）

核心任务。改造 `calculate` 为双账户循环，新增 `processFund` 纯函数。多个 TDD 子步骤。

**关键计算约定（实现须严格遵守）：**
- 房贷月供 `mortgage` 纳入可支配 `totalFlow/monthlyIncome/monthlyExpense`（作为支出），但不出现在 `columnValues`（专区单独渲染）。
- 公积金转出 `fundOutflow` 加进 `monthlyBalance`：`monthlyBalance = totalFlow + investReturn + fundOutflow`。`cumSavings = prevCum + monthlyBalance`（锚点除外）——保持现有 cumSavings 公式不变。
- 同月公积金处理顺序：缴存 → 提取 → 月冲 → 结息 → 锚点覆盖。
- 结息：`fundAccrual` 跨月累计，结息月（`month % 100 === fundInterestMonth`）并入余额、计入 `fundInterest`、清零。
- 提取/月冲超余额 → `min` 截断。
- 无 `fund` → 所有 fund 字段为 0/false，`totalAssets === cumSavings`，行为与现状一致。

**Files:**
- Modify: `src/composables/useCalculation.ts`
- Test: `tests/composables/useCalculation.spec.ts`

- [ ] **Step 1: 更新测试 helper `makePlan`/`makeResult`**

在 `tests/composables/useCalculation.spec.ts` 中：

`makePlan`（约第 5-18 行）替换为（补 fund 默认参数字段）：

```ts
function makePlan(overrides: Partial<PlanData> = {}): PlanData {
  return {
    version: 2,
    systemParams: {
      startMonth: 202601,
      annualRate: 0,
      fundRate: 0,
      fundInterestMonth: 7,
    },
    columns: [],
    anchors: [],
    snapshots: [],
    events: [],
    ...overrides,
  }
}
```

`makeResult`（约第 20-33 行）替换为：

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

- [ ] **Step 2: 写「向后兼容」失败测试**

在 `describe('calculate', ...)` 块内末尾新增（确保无 fund 时行为不变）：

```ts
  it('无 fund 时公积金字段全为 0，totalAssets === cumSavings', () => {
    const results = calculate(makePlan({
      columns: [{ id: 'col1', name: '工资', entries: { 202601: 10000 } }],
    }))
    const r = results[0]
    expect(r.fundBalance).toBe(0)
    expect(r.fundOutflow).toBe(0)
    expect(r.totalAssets).toBe(r.cumSavings)
    expect(r.isFundAnchor).toBe(false)
  })

  it('totalAssets === cumSavings + fundBalance（不变量，含 fund 场景）', () => {
    const results = calculate(makePlan({
      systemParams: { startMonth: 202601, annualRate: 0, fundRate: 0.015, fundInterestMonth: 7 },
      fund: {
        mortgage: { id: 'm', name: '房贷月供', entries: {} },
        contribution: { id: 'c', name: '公积金缴存', entries: { 202601: 1000 } },
        monthlyOffset: { id: 'o', name: '公积金月冲', entries: {} },
        withdrawals: [],
        anchors: [],
      },
    }))
    for (const r of results) {
      expect(r.totalAssets).toBe(r.cumSavings + r.fundBalance)
    }
  })
```

- [ ] **Step 3: 写「缴存累积」失败测试**

```ts
  it('公积金缴存逐月累积到 fundBalance', () => {
    const results = calculate(makePlan({
      systemParams: { startMonth: 202601, annualRate: 0, fundRate: 0, fundInterestMonth: 7 },
      fund: {
        mortgage: { id: 'm', name: '房贷月供', entries: {} },
        contribution: { id: 'c', name: '公积金缴存', entries: { 202601: 1000 } },
        monthlyOffset: { id: 'o', name: '公积金月冲', entries: {} },
        withdrawals: [],
        anchors: [],
      },
    }))
    expect(results[0].fundBalance).toBe(1000)
    expect(results[0].fundContribution).toBe(1000)
    expect(results[1].fundBalance).toBe(2000)
    expect(results[2].fundBalance).toBe(3000)
  })
```

- [ ] **Step 4: 写「按年结息」失败测试**

```ts
  it('按年结息：结息月并入余额并计入 fundInterest，非结息月为 0', () => {
    const results = calculate(makePlan({
      // fundRate=0.12 便于手算：每月应计 = 余额*0.01
      systemParams: { startMonth: 202601, annualRate: 0, fundRate: 0.12, fundInterestMonth: 7 },
      fund: {
        mortgage: { id: 'm', name: '房贷月供', entries: {} },
        contribution: { id: 'c', name: '公积金缴存', entries: { 202601: 10000 } },
        monthlyOffset: { id: 'o', name: '公积金月冲', entries: {} },
        withdrawals: [],
        anchors: [],
      },
    }))
    // 1-6 月每月余额：10000,20000,...,60000；应计累加（不计入余额）
    for (let i = 0; i < 6; i++) {
      expect(results[i].fundInterest).toBe(0)
    }
    // 结息月(7月,index=6)：前6月应计 = 10000+20000+30000+40000+50000+60000 各*0.01 = 2100
    // 7月自身：先缴存→余额70000→应计累计+70000*0.01=700 → 总应计 2100+700=2800 → 并入余额 → 72800
    expect(results[6].fundInterest).toBe(2800)
    expect(results[6].fundBalance).toBe(72800)
    // 8月：无结息
    expect(results[7].fundInterest).toBe(0)
  })
```

- [ ] **Step 5: 写「月冲默认联动 + 截断 + 抵扣」失败测试**

```ts
  it('月冲默认联动房贷月供：公积金全额抵扣，可支配净效果为 0', () => {
    const results = calculate(makePlan({
      systemParams: { startMonth: 202601, annualRate: 0, fundRate: 0, fundInterestMonth: 7 },
      fund: {
        mortgage: { id: 'm', name: '房贷月供', entries: { 202601: -5000 } },
        contribution: { id: 'c', name: '公积金缴存', entries: { 202601: 5000 } },
        monthlyOffset: { id: 'o', name: '公积金月冲', entries: {} }, // 未填，默认取房贷月供 5000
        withdrawals: [],
        anchors: [],
      },
    }))
    const r = results[0]
    expect(r.fundContribution).toBe(5000)
    expect(r.fundOffset).toBe(5000)        // 月冲全额
    expect(r.fundBalance).toBe(0)          // 5000 缴存 - 5000 月冲
    expect(r.monthlyExpense).toBe(5000)    // 房贷月供计入可支配支出
    expect(r.fundOutflow).toBe(5000)       // 转出抵扣
    expect(r.cumSavings).toBe(0)           // -5000(房贷) + 5000(月冲转出) = 0
  })

  it('月冲超余额截断：差额由可支配承担', () => {
    const results = calculate(makePlan({
      systemParams: { startMonth: 202601, annualRate: 0, fundRate: 0, fundInterestMonth: 7 },
      fund: {
        mortgage: { id: 'm', name: '房贷月供', entries: { 202601: -5000 } },
        contribution: { id: 'c', name: '公积金缴存', entries: { 202601: 2000 } }, // 仅 2000
        monthlyOffset: { id: 'o', name: '公积金月冲', entries: {} },             // 默认取 5000，但余额只够 2000
        withdrawals: [],
        anchors: [],
      },
    }))
    const r = results[0]
    expect(r.fundOffset).toBe(2000)        // 截断到余额
    expect(r.fundBalance).toBe(0)
    expect(r.cumSavings).toBe(-3000)       // -5000(房贷) + 2000(月冲转出)
  })
```

- [ ] **Step 6: 写「提取」失败测试**

```ts
  it('提取从公积金出、转入可支配，总资产不变', () => {
    const results = calculate(makePlan({
      systemParams: { startMonth: 202601, annualRate: 0, fundRate: 0, fundInterestMonth: 7 },
      fund: {
        mortgage: { id: 'm', name: '房贷月供', entries: {} },
        contribution: { id: 'c', name: '公积金缴存', entries: { 202601: 100000 } },
        monthlyOffset: { id: 'o', name: '公积金月冲', entries: {} },
        withdrawals: [{ id: 'w1', name: '买房提取', month: 202602, amount: 30000 }],
        anchors: [],
      },
    }))
    // 首月：缴存 100000，无提取 → fundBalance=100000，可支配 0
    expect(results[0].fundBalance).toBe(100000)
    expect(results[0].cumSavings).toBe(0)
    expect(results[0].totalAssets).toBe(100000)
    // 次月：期初 100000 + 缴存 100000 = 200000，提取 30000 → fundBalance=170000；
    //       提取款转入可支配 → cumSavings=30000；总资产=170000+30000=200000
    expect(results[1].fundWithdrawal).toBe(30000)
    expect(results[1].fundBalance).toBe(170000)
    expect(results[1].fundOutflow).toBe(30000)
    expect(results[1].cumSavings).toBe(30000)
    expect(results[1].totalAssets).toBe(200000)
  })

- [ ] **Step 7: 写「提取超余额截断」失败测试**

```ts
  it('提取超余额截断到余额', () => {
    const results = calculate(makePlan({
      systemParams: { startMonth: 202601, annualRate: 0, fundRate: 0, fundInterestMonth: 7 },
      fund: {
        mortgage: { id: 'm', name: '房贷月供', entries: {} },
        contribution: { id: 'c', name: '公积金缴存', entries: { 202601: 10000 } },
        monthlyOffset: { id: 'o', name: '公积金月冲', entries: {} },
        withdrawals: [{ id: 'w1', name: '超额提取', month: 202602, amount: 999999 }],
        anchors: [],
      },
    }))
    // 次月期初 10000 + 缴存 10000 = 20000；提取截断到 20000
    expect(results[1].fundWithdrawal).toBe(20000)
    expect(results[1].fundBalance).toBe(0)
    expect(results[1].cumSavings).toBe(20000)
  })
```

- [ ] **Step 8: 写「公积金锚点」失败测试**

```ts
  it('公积金余额锚点覆盖 fundBalance', () => {
    const results = calculate(makePlan({
      systemParams: { startMonth: 202601, annualRate: 0, fundRate: 0, fundInterestMonth: 7 },
      fund: {
        mortgage: { id: 'm', name: '房贷月供', entries: {} },
        contribution: { id: 'c', name: '公积金缴存', entries: { 202601: 1000 } },
        monthlyOffset: { id: 'o', name: '公积金月冲', entries: {} },
        withdrawals: [],
        anchors: [{ month: 202603, actualBalance: 500000 }],
      },
    }))
    expect(results[1].fundBalance).toBe(2000)
    expect(results[2]).toMatchObject({ month: 202603, fundBalance: 500000, isFundAnchor: true })
    expect(results[3].fundBalance).toBe(501000) // 从锚点继续 + 缴存 1000
  })
```

- [ ] **Step 9: 运行全部新测试确认失败**

Run: `npx vitest run tests/composables/useCalculation.spec.ts -t "fund\\|公积金\\|totalAssets"`
Expected: FAIL（新用例因 `calculate` 尚未输出 fund 字段而失败）。

- [ ] **Step 10: 实现 `processFund` 纯函数**

在 `src/composables/useCalculation.ts` 的 `resolveFundOffset` 之后插入：

```ts
/** processFund 单月公积金处理结果 */
export interface FundMonthResult {
  fundBalance: number
  fundInterest: number
  fundContribution: number
  fundOffset: number
  fundWithdrawal: number
  fundOutflow: number
  isFundAnchor: boolean
  nextAccrual: number   // 传给下月的应计利息
}

/**
 * 处理单月公积金账户：缴存 → 提取 → 月冲 → 结息 → 锚点覆盖。
 * @param fund 公积金配置
 * @param month 当前月 YYYYMM
 * @param prevBalance 上月末余额（首月取 fundInitialBalance）
 * @param accrual 进入本月时的应计利息
 * @param fundRate 公积金年利率
 * @param fundInterestMonth 结息月（1-12）
 */
export function processFund(
  fund: FundConfig,
  month: number,
  prevBalance: number,
  accrual: number,
  fundRate: number,
  fundInterestMonth: number,
): FundMonthResult {
  let balance = prevBalance

  // 缴存
  const contribution = resolveColumnValue(fund.contribution, month).amount
  balance += contribution

  // 提取（逐笔截断）
  let withdrawalOut = 0
  for (const w of fund.withdrawals.filter(w => w.month === month)) {
    const take = Math.min(w.amount, balance)
    balance -= take
    withdrawalOut += take
  }

  // 月冲（默认联动房贷月供，截断到余额）
  const offsetTarget = resolveFundOffset(fund, month)
  const offsetOut = Math.min(offsetTarget, balance)
  balance -= offsetOut

  const fundOutflow = withdrawalOut + offsetOut

  // 结息：按月计提，结息月并入
  let fundInterest = 0
  let nextAccrual = accrual + (balance * fundRate) / 12
  if (month % 100 === fundInterestMonth) {
    balance += nextAccrual
    fundInterest = nextAccrual
    nextAccrual = 0
  }

  // 锚点覆盖
  const anchor = fund.anchors.find(a => a.month === month)
  const isFundAnchor = Boolean(anchor)
  if (anchor) balance = anchor.actualBalance

  return {
    fundBalance: balance,
    fundInterest,
    fundContribution: contribution,
    fundOffset: offsetOut,
    fundWithdrawal: withdrawalOut,
    fundOutflow,
    isFundAnchor,
    nextAccrual,
  }
}
```

- [ ] **Step 11: 改造 `calculate` 为双账户循环**

将 `src/composables/useCalculation.ts` 中整个 `calculate` 函数（约第 73-137 行）替换为：

```ts
/**
 * 计算所有月份的储蓄结果（双账户：可支配储蓄 + 公积金账户）
 * @param plan 计划数据
 * @returns 月度结果数组
 */
export function calculate(plan: PlanData): MonthResult[] {
  const results: MonthResult[] = []
  const fund = plan.fund
  const fundRate = plan.systemParams.fundRate ?? 0
  const fundInterestMonth = plan.systemParams.fundInterestMonth ?? 7
  const fundInitialBalance = Number(plan.systemParams.fundInitialBalance) || 0
  let fundAccrual = 0 // 公积金应计利息，跨月维护

  for (let index = 0; index < PROJECTION_MONTHS; index++) {
    const month = addMonths(plan.systemParams.startMonth, index)

    // —— 可支配部分 ——
    const prevCum = index === 0
      ? (Number(plan.systemParams.initialDeposit) || 0)
      : results[index - 1].cumSavings

    const columnValues = plan.columns.map(col => resolveColumnValue(col, month))

    // 注入虚拟「专项」列值
    const monthEvents = plan.events.filter(e => e.month === month)
    if (monthEvents.length > 0) {
      const eventsNet = monthEvents.reduce((sum, e) => sum + e.amount, 0)
      columnValues.push({
        id: EVENT_COLUMN_ID,
        name: '专项',
        amount: eventsNet,
        isEdited: false,
        enabled: true,
      })
    }

    // 房贷月供纳入可支配统计（不出现在 columnValues，专区单独渲染）
    const mortgageValue = fund ? resolveColumnValue(fund.mortgage, month).amount : 0

    const activeValues = columnValues.filter(col => col.enabled !== false)
    const totalFlow = activeValues.reduce((sum, col) => sum + col.amount, 0) + mortgageValue
    const investReturn = (prevCum * plan.systemParams.annualRate) / 12
    const monthlyIncome = activeValues.reduce((sum, col) => col.amount > 0 ? sum + col.amount : sum, 0)
      + (mortgageValue > 0 ? mortgageValue : 0)
    const monthlyExpense = activeValues.reduce((sum, col) => col.amount < 0 ? sum + Math.abs(col.amount) : sum, 0)
      + (mortgageValue < 0 ? Math.abs(mortgageValue) : 0)

    // —— 公积金部分 ——
    let fundBalance = 0, fundInterest = 0, fundContribution = 0
    let fundOffset = 0, fundWithdrawal = 0, fundOutflow = 0, isFundAnchor = false
    if (fund) {
      const prevFundBalance = index === 0 ? fundInitialBalance : results[index - 1].fundBalance
      const fr = processFund(fund, month, prevFundBalance, fundAccrual, fundRate, fundInterestMonth)
      fundAccrual = fr.nextAccrual
      fundBalance = fr.fundBalance
      fundInterest = fr.fundInterest
      fundContribution = fr.fundContribution
      fundOffset = fr.fundOffset
      fundWithdrawal = fr.fundWithdrawal
      fundOutflow = fr.fundOutflow
      isFundAnchor = fr.isFundAnchor
    }

    // —— 汇总（公积金转出抵扣可支配）——
    const monthlyBalance = totalFlow + investReturn + fundOutflow
    const anchor = plan.anchors.find(item => item.month === month)
    const cumSavings = anchor ? anchor.actualSavings : prevCum + monthlyBalance
    const totalAssets = cumSavings + fundBalance

    results.push({
      month,
      columnValues,
      totalFlow,
      investReturn,
      monthlyIncome,
      monthlyExpense,
      monthlyBalance,
      cumSavings,
      isAnchor: Boolean(anchor),
      fundBalance,
      fundInterest,
      fundContribution,
      fundOffset,
      fundWithdrawal,
      fundOutflow,
      isFundAnchor,
      totalAssets,
    })
  }

  return results
}
```

- [ ] **Step 12: 运行新测试确认通过**

Run: `npx vitest run tests/composables/useCalculation.spec.ts`
Expected: PASS（含所有新增 fund 用例 + 现有用例回归）。

> 结息数值已按 `processFund` 逻辑手算验证：每月先完成缴存/提取/月冲得到 `balance`，再 `accrual += balance*rate/12`，结息月（`month%100===fundInterestMonth`）把 `accrual` 并入余额。Step 4 的 2800/72800 即据此得出。

- [ ] **Step 13: Commit**

```bash
git add src/composables/useCalculation.ts tests/composables/useCalculation.spec.ts
git commit -m "feat(公积金): 双账户计算循环 processFund + 月冲联动/按年结息/提取/锚点"
```

---

## Task 5: `useStore` 校验与 normalize

让 store 能正确校验、加载、迁移含 `fund` 的数据，并对旧数据补默认。

**Files:**
- Modify: `src/composables/useStore.ts`
- Test: `tests/composables/useStore.spec.ts`

- [ ] **Step 1: 读取现有 store 测试 helper 模式**

Run: `npx vitest run tests/composables/useStore.spec.ts`
（先确认现有 store 测试通过，了解其 mock localStorage 与 helper 模式。）

- [ ] **Step 2: 写失败测试 — fund 校验与迁移**

在 `tests/composables/useStore.spec.ts` 中（参照该文件已有的 localStorage mock 与 `useStore` 调用模式）新增 describe 块：

```ts
describe('fund 校验与迁移', () => {
  // 复用文件顶部已有的 loadUseStore（动态 import + resetModules 隔离）
  beforeEach(() => {
    vi.useRealTimers()
    localStorage.clear()
    vi.resetModules()
  })

  it('旧数据（无 fund、SystemParams 无 fundRate）加载时补默认', async () => {
    const legacy = {
      version: 2,
      systemParams: { startMonth: 202601, annualRate: 0.03 },
      columns: [], anchors: [], snapshots: [], events: [],
    }
    localStorage.setItem('family-finance-plan', JSON.stringify({
      version: 1,
      scenarios: [{ id: 's1', name: '默认方案', plan: legacy }],
      activeId: 's1',
    }))
    const useStore = await loadUseStore()
    const store = useStore()
    expect(store.data.value.systemParams.fundRate).toBe(0.015)
    expect(store.data.value.systemParams.fundInterestMonth).toBe(7)
    expect(store.data.value.fund).toBeUndefined()
  })

  it('含合法 fund 的数据正常加载', async () => {
    const plan = {
      version: 2,
      systemParams: { startMonth: 202601, annualRate: 0.03, fundRate: 0.015, fundInterestMonth: 7 },
      columns: [], anchors: [], snapshots: [], events: [],
      fund: {
        mortgage: { id: 'm', name: '房贷月供', entries: {} },
        contribution: { id: 'c', name: '公积金缴存', entries: { 202601: 1000 } },
        monthlyOffset: { id: 'o', name: '公积金月冲', entries: {} },
        withdrawals: [{ id: 'w1', name: '买房', month: 202602, amount: 30000 }],
        anchors: [{ month: 202603, actualBalance: 500000 }],
      },
    }
    localStorage.setItem('family-finance-plan', JSON.stringify({
      version: 1,
      scenarios: [{ id: 's1', name: '默认方案', plan }],
      activeId: 's1',
    }))
    const useStore = await loadUseStore()
    const store = useStore()
    expect(store.data.value.fund?.contribution.entries[202601]).toBe(1000)
    expect(store.data.value.fund?.withdrawals).toHaveLength(1)
  })

  it('fund 内部结构非法（mortgage 非 FlowColumn）时整个 workspace 回退默认', async () => {
    const bad = {
      version: 2,
      systemParams: { startMonth: 202601, annualRate: 0.03, fundRate: 0.015, fundInterestMonth: 7 },
      columns: [], anchors: [], snapshots: [], events: [],
      fund: { mortgage: '不是列', contribution: { id: 'c', name: 'x', entries: {} }, monthlyOffset: { id: 'o', name: 'x', entries: {} }, withdrawals: [], anchors: [] },
    }
    localStorage.setItem('family-finance-plan', JSON.stringify({
      version: 1,
      scenarios: [{ id: 's1', name: '默认方案', plan: bad }],
      activeId: 's1',
    }))
    const useStore = await loadUseStore()
    const store = useStore()
    // isValidPlanData 因 fund 非法返回 false → isValidWorkspace false → loadWorkspace 回退默认
    expect(store.data.value.columns).toEqual([])
    expect(store.data.value.fund).toBeUndefined()
  })
})
```

> 注：第三例的回退粒度（整体回退 vs 仅丢弃 fund）取决于实现选择。本计划采用「fund 非法则整个 plan 非法 → workspace 回退默认」（与现有 `isValidWorkspace` 严格校验一致）。若实现改为「丢弃 fund 保留其余」，请相应调整该断言。

- [ ] **Step 3: 运行测试确认失败**

Run: `npx vitest run tests/composables/useStore.spec.ts -t "fund 校验与迁移"`
Expected: FAIL（fund 字段尚未校验/normalize，`fundRate` 为 undefined）。

- [ ] **Step 4: 实现校验函数**

在 `src/composables/useStore.ts` 中 `isValidEvent` 之后新增：

```ts
function isValidFundWithdrawal(value: unknown): boolean {
  if (!isObject(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    Number.isInteger(value.month) &&
    isFiniteNumber(value.amount)
  )
}

function isValidFundAnchor(value: unknown): boolean {
  if (!isObject(value)) return false
  return Number.isInteger(value.month) && isFiniteNumber(value.actualBalance)
}

function isValidFund(value: unknown): boolean {
  if (!isObject(value)) return false
  if (!isValidColumn(value.mortgage)) return false
  if (!isValidColumn(value.contribution)) return false
  if (!isValidColumn(value.monthlyOffset)) return false
  if (!Array.isArray(value.withdrawals) || !value.withdrawals.every(isValidFundWithdrawal)) return false
  if (!Array.isArray(value.anchors) || !value.anchors.every(isValidFundAnchor)) return false
  return true
}
```

- [ ] **Step 5: 放宽 `isValidPlanData`**

将 `isValidPlanData`（约第 92-110 行）中 `fund` 校验加入。在现有 `events` 校验块之后、`return` 之前插入：

```ts
  if ('fund' in value) {
    if (value.fund !== undefined && !isValidFund(value.fund)) return false
  }
```

并在最终 `return` 的条件里补 `fundRate`/`fundInterestMonth` 校验。将最终 return 替换为：

```ts
  return (
    isFiniteNumber(value.version) &&
    isFiniteNumber(value.systemParams.startMonth) &&
    isFiniteNumber(value.systemParams.annualRate) &&
    // fund 参数可选：缺失时由 normalizeWorkspace 补默认；存在时须为有限数
    (value.systemParams.fundRate === undefined || isFiniteNumber(value.systemParams.fundRate)) &&
    (value.systemParams.fundInterestMonth === undefined || isFiniteNumber(value.systemParams.fundInterestMonth)) &&
    Array.isArray(value.columns) &&
    value.columns.every(isValidColumn) &&
    Array.isArray(value.anchors) &&
    value.anchors.every(isValidAnchor)
  )
```

- [ ] **Step 6: normalize 补默认**

将 `normalizeWorkspace`（约第 129-143 行）中，对每个 scenario 的循环体替换为：

```ts
function normalizeWorkspace(ws: Workspace): Workspace {
  for (const scenario of ws.scenarios) {
    if (!Array.isArray(scenario.plan.snapshots)) {
      scenario.plan.snapshots = []
    }
    if (!Array.isArray(scenario.plan.events)) {
      scenario.plan.events = []
    }
    // 初始存款缺失或非有限数时补 0
    if (!isFiniteNumber(scenario.plan.systemParams.initialDeposit)) {
      scenario.plan.systemParams.initialDeposit = 0
    }
    // 公积金参数补默认（旧数据缺失时）
    if (!isFiniteNumber(scenario.plan.systemParams.fundRate)) {
      scenario.plan.systemParams.fundRate = 0.015
    }
    if (!isFiniteNumber(scenario.plan.systemParams.fundInterestMonth)) {
      scenario.plan.systemParams.fundInterestMonth = 7
    }
    if (!isFiniteNumber(scenario.plan.systemParams.fundInitialBalance)) {
      scenario.plan.systemParams.fundInitialBalance = 0
    }
    // fund 缺失保持 undefined（视为无公积金）；fund 存在则补其内部数组默认
    if (scenario.plan.fund) {
      if (!Array.isArray(scenario.plan.fund.withdrawals)) scenario.plan.fund.withdrawals = []
      if (!Array.isArray(scenario.plan.fund.anchors)) scenario.plan.fund.anchors = []
    }
  }
  return ws
}
```

- [ ] **Step 7: `createDefault` 补 fund 参数**

将 `createDefault`（约第 15-28 行）的 `systemParams` 替换为：

```ts
    systemParams: {
      startMonth: getCurrentMonth(),
      annualRate: 0.025,
      initialDeposit: 0,
      fundRate: 0.015,
      fundInterestMonth: 7,
      fundInitialBalance: 0,
    },
```

- [ ] **Step 8: 运行测试确认通过**

Run: `npx vitest run tests/composables/useStore.spec.ts`
Expected: PASS（含新增 fund 用例 + 现有回归）。

- [ ] **Step 9: Commit**

```bash
git add src/composables/useStore.ts tests/composables/useStore.spec.ts
git commit -m "feat(公积金): useStore 校验/normalize/migration 支持 fund 可选字段"
```

---

## Task 6: `useStore` 公积金操作函数

提供 UI 层（后续计划）调用的 fund 编辑 API。

**Files:**
- Modify: `src/composables/useStore.ts`
- Test: `tests/composables/useStore.spec.ts`

- [ ] **Step 1: 写失败测试**

在 `tests/composables/useStore.spec.ts` 新增 describe（参照该文件现有调用 `useStore()` 后操作并断言 `data.value` 的模式）：

```ts
describe('fund 操作函数', () => {
  beforeEach(() => {
    vi.useRealTimers()
    localStorage.clear()
    vi.resetModules()
  })

  it('enableFund 创建空 FundConfig，disableFund 移除', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    expect(store.data.value.fund).toBeUndefined()
    store.enableFund()
    expect(store.data.value.fund).toBeDefined()
    expect(store.data.value.fund?.mortgage.entries).toEqual({})
    expect(store.data.value.fund?.withdrawals).toEqual([])
    store.disableFund()
    expect(store.data.value.fund).toBeUndefined()
  })

  it('updateFundEntry 写入指定 fund 列的月份值', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.enableFund()
    store.updateFundEntry('contribution', 202601, 2000)
    expect(store.data.value.fund?.contribution.entries[202601]).toBe(2000)
  })

  it('replaceMonthWithdrawals 替换指定月提取', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.enableFund()
    store.replaceMonthWithdrawals(202602, [{ name: '买房提取', amount: 30000 }])
    expect(store.data.value.fund?.withdrawals).toHaveLength(1)
    expect(store.data.value.fund?.withdrawals[0].month).toBe(202602)
  })

  it('addFundAnchor / removeFundAnchor 维护公积金锚点', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.enableFund()
    store.addFundAnchor(202603, 500000)
    expect(store.data.value.fund?.anchors).toHaveLength(1)
    store.removeFundAnchor(202603)
    expect(store.data.value.fund?.anchors).toHaveLength(0)
  })

  it('setFundRate 设置公积金年利率', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.setFundRate(0.02)
    expect(store.data.value.systemParams.fundRate).toBe(0.02)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/composables/useStore.spec.ts -t "fund 操作函数"`
Expected: FAIL（函数未定义）。

- [ ] **Step 3: 实现操作函数**

在 `src/composables/useStore.ts` 的 `removeAnchor`/`addAnchor` 附近（return 之前）新增：

```ts
  // —— 公积金操作 ——
  function emptyFlowColumn(name: string): FlowColumn {
    return { id: generateId(), name, entries: {} }
  }

  function enableFund(): void {
    const plan = getActivePlan()
    if (plan.fund) return
    plan.fund = {
      mortgage: emptyFlowColumn('房贷月供'),
      contribution: emptyFlowColumn('公积金缴存'),
      monthlyOffset: emptyFlowColumn('公积金月冲'),
      withdrawals: [],
      anchors: [],
    }
  }

  function disableFund(): void {
    const plan = getActivePlan()
    plan.fund = undefined
  }

  function updateFundEntry(
    field: 'mortgage' | 'contribution' | 'monthlyOffset',
    month: number,
    value: number | null,
  ): void {
    const plan = getActivePlan()
    if (!plan.fund) return
    const column = plan.fund[field]
    if (value === null) {
      delete column.entries[month]
      if (column.yearlyMonths) delete column.yearlyMonths[month]
    } else {
      column.entries[month] = value
    }
  }

  function syncFundYearly(field: 'mortgage' | 'contribution' | 'monthlyOffset', month: number): void {
    const plan = getActivePlan()
    if (!plan.fund) return
    const column = plan.fund[field]
    const amount = column.entries[month]
    if (amount === undefined) return
    if (!column.yearlyMonths) column.yearlyMonths = {}
    const moy = month % 100
    const start = plan.systemParams.startMonth
    for (let i = 0; i < 60; i++) {
      const m = addMonths(start, i)
      if (m % 100 === moy && m >= month) {
        column.entries[m] = amount
        column.yearlyMonths[m] = true
      }
    }
  }

  function replaceMonthWithdrawals(month: number, items: { name: string; amount: number }[]): void {
    const plan = getActivePlan()
    if (!plan.fund) return
    plan.fund.withdrawals = plan.fund.withdrawals.filter(w => w.month !== month)
    for (const it of items) {
      const name = it.name.trim()
      if (name && Number.isFinite(it.amount)) {
        plan.fund.withdrawals.push({ id: generateId(), name, month, amount: Math.round(it.amount) })
      }
    }
  }

  function addFundAnchor(month: number, actualBalance: number): void {
    const plan = getActivePlan()
    if (!plan.fund) return
    const existing = plan.fund.anchors.findIndex(a => a.month === month)
    if (existing >= 0) {
      plan.fund.anchors[existing].actualBalance = actualBalance
    } else {
      plan.fund.anchors.push({ month, actualBalance })
    }
  }

  function removeFundAnchor(month: number): void {
    const plan = getActivePlan()
    if (!plan.fund) return
    plan.fund.anchors = plan.fund.anchors.filter(a => a.month !== month)
  }

  function setFundRate(rate: number): void {
    getActivePlan().systemParams.fundRate = rate
  }

  function setFundInterestMonth(m: number): void {
    getActivePlan().systemParams.fundInterestMonth = m
  }

  function setFundInitialBalance(v: number): void {
    getActivePlan().systemParams.fundInitialBalance = v
  }
```

> `syncFundYearly` 复用了 `useStore.ts` 已 import 的 `addMonths`（见文件顶部 `import { ... addMonths ... }`）。若未 import，在顶部 import 中补 `addMonths`。

- [ ] **Step 4: 在 return 中导出新函数**

将 `useStore` 的 `return` 对象（约第 441-466 行）追加：

```ts
    enableFund,
    disableFund,
    updateFundEntry,
    syncFundYearly,
    replaceMonthWithdrawals,
    addFundAnchor,
    removeFundAnchor,
    setFundRate,
    setFundInterestMonth,
    setFundInitialBalance,
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npx vitest run tests/composables/useStore.spec.ts -t "fund 操作函数"`
Expected: PASS。

- [ ] **Step 6: 全量回归 + 类型检查**

Run: `npx vitest run && npx vue-tsc --noEmit`
Expected: 所有测试通过；无类型错误。

- [ ] **Step 7: Commit**

```bash
git add src/composables/useStore.ts tests/composables/useStore.spec.ts
git commit -m "feat(公积金): useStore 新增 fund 编辑操作函数"
```

---

## 完成标准

- [ ] `npx vitest run` 全绿（含所有新增 fund 计算与 store 测试）。
- [ ] `npx vue-tsc --noEmit` 无类型错误。
- [ ] 旧数据（无 fund）加载后行为与改造前完全一致（`totalAssets === cumSavings`）。
- [ ] 每个任务独立提交，提交信息中文。

## 后续计划（UI 集成，核心完成后另起计划）

1. MonthlyTable 公积金专区 5 列（房贷月供/缴存/月冲可编辑 + 公积金余额 + 总资产），月冲默认联动视觉提示。
2. FundFlowEditor 组件（仿 EventEditor，编辑该月提取 + 展示流水）。
3. 公积金余额列锚点右键交互（`FUND_BALANCE_COLUMN_ID`）。
4. AnnualTable 新增「公积金」「总资产」年度行。
5. FinanceChart 主线改总资产、叠加公积金区域。
6. FormulaPopover 扩展月冲/公积金余额/结息/总资产公式。
7. App.vue header 新增公积金启用开关、fundRate、fundInterestMonth、fundInitialBalance 输入。
