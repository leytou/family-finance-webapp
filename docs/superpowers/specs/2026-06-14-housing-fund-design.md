# 住房公积金功能设计

> 日期：2026-06-14
> 状态：已定稿，待实现计划

## 1. 背景与目标

家庭财务规划工具当前只有单一"累计储蓄"账户：所有现金流列汇总为 `totalFlow`，按统一 `annualRate` 计算投资收益，月度结余累加进 `cumSavings`（见 `src/composables/useCalculation.ts:73-137`）。

现实中，**住房公积金是一个独立的资金池**——独立（更低的）结息利率、定向用途（购房/还贷/租房）。它不能简单作为一条现金流列加入，因为：

1. 缴存的钱进入独立公积金账户，而非可支配储蓄。
2. 公积金按约 1.5% 年化结息（远低于投资收益率），且按年结息。
3. 缴存具有双重性：个人部分从工资扣除、单位部分是额外福利，但两者都增加公积金账户余额（家庭资产增加）。
4. 资金只能定向用于房相关支出（购房提取、冲还房贷）。

**目标**：引入"第二账户"，支持公积金缴存累积、按年结息、月冲抵扣房贷、单月提取，并以"总资产 = 可支配储蓄 + 公积金"视角展示。

### 非目标（YAGNI，明确排除）

- 公积金贷款模拟（商贷/公积金贷利率对比、本金/月供计算）。
- 缴存"基数 × 比例"自动计算（采用手动填缴存额）。
- 个人/单位缴存分开列（采用合一列：缴存总额）。
- 公积金按月结息（采用按年结息）。

## 2. 设计原则

1. **独立账户**：公积金用独立的 `fund` 子结构承载，不混入现有 `columns`。现有可支配现金流逻辑零改动。
2. **`cumSavings`（可支配储蓄）语义不变**，保证向后兼容。新增 `fundBalance` 与 `totalAssets = cumSavings + fundBalance`。
3. **内部转账不计收支**：提取/月冲的转出转入可支配储蓄是"搬家"，不计入 `monthlyIncome/monthlyExpense`，不改变家庭总资产。
4. **房贷月供是可支配支出**：月冲转出抵扣它。月冲额 = 房贷月供时，可支配净效果为 0（公积金全额抵扣房贷）。

## 3. 数据模型（`src/types.ts`）

### 新增类型

```ts
// 单月一次性提取（买房首付等），从公积金账户转出到可支配储蓄
export interface FundWithdrawal {
  id: string
  name: string        // 如「买房提取」
  month: number       // YYYYMM
  amount: number      // 元，正数
}

// 公积金账户余额锚点（校验用，同 MonthlyAnchor 的语义）
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

### `SystemParams` 扩展

```ts
export interface SystemParams {
  startMonth: number
  annualRate: number
  initialDeposit?: number
  fundRate: number            // 公积金年利率，默认 0.015
  fundInterestMonth: number   // 结息月 1-12，默认 7
  fundInitialBalance?: number // 初始公积金余额，默认 0
}
```

### `PlanData` 扩展

```ts
export interface PlanData {
  version: number
  systemParams: SystemParams
  columns: FlowColumn[]
  anchors: MonthlyAnchor[]
  snapshots: PlanSnapshot[]
  events: MilestoneEvent[]
  fund?: FundConfig           // 可选；缺失=无公积金，向后兼容
}
```

### `MonthResult` 扩展

```ts
export interface MonthResult {
  // ... 现有字段不变 ...
  // 新增
  fundBalance: number       // 月末公积金账户余额
  fundInterest: number      // 当月入账结息（仅结息月非 0）
  fundContribution: number  // 当月缴存额（展示用）
  fundOffset: number        // 当月月冲额（展示用，实际扣取值，已截断）
  fundWithdrawal: number    // 当月提取额（展示用，实际扣取值，已截断）
  fundOutflow: number       // 当月转出到可支配合计 = fundOffset + fundWithdrawal
  isFundAnchor: boolean     // 该月公积金余额是否被锚点覆盖
  totalAssets: number       // = cumSavings + fundBalance
}
```

## 4. 计算逻辑（`src/composables/useCalculation.ts`）

采用**集中式双账户循环**：在现有月度循环内同时维护"可支配储蓄"和"公积金账户"，公积金子逻辑抽成独立纯函数。

### 4.1 月冲默认联动 — `resolveFundOffset`

月冲未手填时自动取同行房贷月供值（用户选择"固定列+自动联动"）。

```ts
// 解析月冲在指定月的值：有用户输入（含延续）则用之，否则默认取 mortgage 同月值
function resolveFundOffset(fund: FundConfig, month: number): number {
  const offset = resolveColumnValue(fund.monthlyOffset, month)
  if (/* monthlyOffset 该月有用户输入或延续值 */) return offset.amount
  return resolveColumnValue(fund.mortgage, month).amount
}
```

> 实现提示：需区分 `resolveColumnValue` 的"规则3（无任何 entry，返回 0）"与"有有效值"。建议给 `resolveColumnValue` 增加返回 `hasValue` 标志，或由 `resolveFundOffset` 内部判断 `fund.monthlyOffset.entries` 是否存在任何 `key ≤ month`（非 yearly）的延续源。

### 4.2 房贷月供纳入可支配支出

`fund.mortgage` 虽在 `fund` 下，但属于可支配支出。计算可支配 `totalFlow` 时，把 `mortgage` 作为一条额外支出列纳入（与 `columns` 同样用 `resolveColumnValue` 解析，参与 `totalFlow/monthlyIncome/monthlyExpense`）。月表专区里它独立成列，但统计上归可支配。

### 4.3 `calculate` 双账户循环（每月）

```
// 跨月状态（循环外维护）
let fundAccrual = 0          // 应计利息（按月计提，结息月入账）

for each month:
  // —— 可支配部分（现有逻辑， mortgage 作为支出纳入）——
  prevSavings = index===0 ? initialDeposit : results[index-1].cumSavings
  columnValues = columns.map(resolveColumnValue) + 事件注入
  mortgageValue = resolveColumnValue(fund.mortgage, month)        // 纳入可支配
  totalFlow = activeColumns合计 + mortgageValue
  investReturn = prevSavings * annualRate / 12

  // —— 公积金部分（新增 processFund 纯函数）——
  prevFundBalance = index===0 ? fundInitialBalance : results[index-1].fundBalance
  balance = prevFundBalance
  contribution = resolveColumnValue(fund.contribution, month).amount
  balance += contribution                                     // 缴存

  // 提取（逐笔，截断到余额）
  withdrawalOut = sum(min(w.amount, balance)) 逐笔后更新 balance
  // 月冲（默认联动房贷月供，截断到余额）
  offsetTarget = resolveFundOffset(fund, month)
  offsetOut = min(offsetTarget, balance); balance -= offsetOut

  fundOutflow = withdrawalOut + offsetOut                     // 转出合计

  // 结息（按月计提、按年入账）
  fundInterest = 0
  fundAccrual += balance * fundRate / 12
  if (month % 100 === fundInterestMonth) {
    balance += fundAccrual
    fundInterest = fundAccrual
    fundAccrual = 0
  }

  // 公积金锚点覆盖
  isFundAnchor = 该月存在 FundAnchor
  if (isFundAnchor) balance = anchor.actualBalance
  fundBalance = balance

  // —— 汇总 ——
  cumSavings = 可支配锚点存在 ? anchor.actualSavings
               : prevSavings + totalFlow + investReturn + fundOutflow
  totalAssets = cumSavings + fundBalance
```

### 4.4 顺序与边界

- 同月内公积金处理顺序：**缴存 → 提取 → 月冲 → 结息 → 锚点覆盖**。
- 公积金转出 `fundOutflow` 加进当月 `cumSavings`，但**当月不参与 `investReturn`**（`investReturn` 基于上月末 `prevSavings`），下月起生息——与可支配逻辑对称。
- `fundAccrual` 是循环外跨月状态（与 `cumSavings` 同级维护）。
- 提取/月冲超余额 → `min` 截断，不透支。
- 月冲不足（余额 < 房贷月供）→ 月冲截断到余额，差额由可支配房贷月供列自然承担（可支配 `cumSavings` 多减）。
- 锚点优先：可支配锚点覆盖 `cumSavings`；公积金锚点覆盖 `fundBalance`。当 `cumSavings` 被锚点覆盖时，`fundOutflow` 的抵扣效应被锚点吸收（与现有锚点语义一致）。

## 5. 持久化与迁移（`src/composables/useStore.ts`）

### 校验放宽

- `isValidColumn` 已有，复用校验 `mortgage/contribution/monthlyOffset`（均为合法 `FlowColumn`）。
- 新增 `isValidFundWithdrawal`、`isValidFundAnchor`。
- `isValidPlanData`：`fund` 可选；存在时校验内部结构与数组。
- `SystemParams` 校验增加 `fundRate`、`fundInterestMonth` 为有限数。

### normalize

- `normalizeWorkspace`：对每个 `scenario.plan`，若 `systemParams` 缺 `fundRate`/`fundInterestMonth`，补默认（`0.015` / `7`）；`fund` 缺失则保持 `undefined`（视为无公积金）。
- `fundInitialBalance` 缺失补 `0`。

### version

- **不升 version**（`fund` 可选字段保证 v2 数据无破坏；CLAUDE.md 虽说"不需兼容旧数据"，但可选字段成本极低且更稳）。
- `createDefault()` 不带 `fund`（默认无公积金），但 `systemParams` 应包含 `fundRate: 0.015`、`fundInterestMonth: 7`、`fundInitialBalance: 0`；用户首次启用公积金时由 `enableFund()` 创建空 `FundConfig`（`mortgage/contribution/monthlyOffset` 为空 `FlowColumn`）。

### 新增 store 操作函数

- `enableFund()` / `disableFund()`：创建/移除 `fund`。
- `updateFundEntry(field: 'mortgage'|'contribution'|'monthlyOffset', month, value)`：复用 `updateColumnEntry` 模式。
- `syncFundYearly(field, month)`：复用 `syncYearly` 模式。
- `replaceMonthWithdrawals(month, items)`：复用 `replaceMonthEvents` 模式。
- `addFundAnchor(month, balance)` / `removeFundAnchor(month)`。
- `setFundRate` / `setFundInterestMonth` / `setFundInitialBalance`。

## 6. UI / 交互

### 6.1 ParamPanel

新增「公积金」参数区：
- 启用公积金开关（`enableFund`/`disableFund`）。
- 公积金年利率 `fundRate`（默认 1.5%）。
- 结息月 `fundInterestMonth`（默认 7）。
- 初始公积金余额 `fundInitialBalance`。

### 6.2 MonthlyTable — 公积金专区固定列

在现有「存款」列之后新增 **5 列**：

| 列 | 编辑性 | 说明 |
|---|---|---|
| 房贷月供 | 可编辑 | 进可支配支出（totalFlow/monthlyExpense） |
| 公积金缴存 | 可编辑 | 稀疏+yearly，进公积金账户 |
| 公积金月冲 | 可编辑 | 未手填时默认=同行房贷月供（淡显/标记「自动」）；手填覆盖 |
| 公积金 | 余额 | 右键设锚点；点击单元格弹出 `FundFlowEditor` |
| 总资产 | 只读 | cumSavings + fundBalance |

- 房贷月供纳入 `totalFlow/monthlyExpense`；公积金缴存/月冲/提取不计入可支配收支（独立公积金维度）。
- 公积金余额列：新增 `FUND_BALANCE_COLUMN_ID`，右键菜单复用 `BALANCE_COLUMN_ID` 模式（清除下方锚点等）；点击打开 `FundFlowEditor`。
- 单元格编辑复用现有 `startEditCell`/`confirmEditCell` 逻辑（针对 mortgage/contribution/monthlyOffset 三列）。

### 6.3 FundFlowEditor（新组件，仿 EventEditor）

点击公积金余额单元格弹出，展示该月公积金流水：
- 期初余额 → +缴存 → -月冲 → -提取（明细，可多笔编辑）→ +结息 → =期末余额。
- 编辑该月提取记录（名称+金额），提交走 `replaceMonthWithdrawals`。

### 6.4 AnnualTable

年度汇总新增「公积金」（年末 `fundBalance`）、「总资产」（年末 `totalAssets`）列；可选展示年度结息合计。

### 6.5 FinanceChart

主线改为**总资产**（`cumSavings + fundBalance`）；叠加公积金余额区域（堆叠或副线）；可保留可支配储蓄线作为切换。

### 6.6 FormulaPopover（`src/utils/formula.ts`）

扩展 `MonthFormulaField` / `YearFormulaField`：
- 月冲公式：`公积金月冲 = 房贷月供(X) [默认联动]` 或 `= 手填值(X)`。
- 公积金余额公式：`公积金 = 上月余额(A) + 缴存(B) - 提取(C) - 月冲(D) + 结息(E) = F`。
- 结息公式（结息月）：`结息 = 应计利息(X) [年利率 1.5%]`。
- 总资产公式：`总资产 = 存款(A) + 公积金(B) = C`。

## 7. 测试计划（Vitest）

### 计算单元测试（`useCalculation`）

- **缴存累积**：多月缴存 → `fundBalance` 正确累加。
- **按年结息**：结息月 `fundInterest` 非零并入余额；非结息月 `fundInterest=0`；年内计提不提前生息（`fundAccrual` 不参与当月余额）。
- **月冲默认联动**：未手填月冲 → 取房贷月供；手填 → 覆盖。
- **月冲/提取截断**：余额不足时 `min` 截断。
- **提取转入可支配**：`fundOutflow` 加进 `cumSavings`。
- **月冲=房贷月供**：可支配净效果为 0（`totalFlow` 含 -房贷，`+fundOutflow` 抵消）。
- **公积金锚点**覆盖 `fundBalance`。
- **向后兼容**：无 `fund` 时 `totalAssets === cumSavings`、`fundBalance === 0`，行为与现状一致。
- **不变量**：每月 `totalAssets === cumSavings + fundBalance`。

### store 测试

- `enableFund`/`disableFund`；`updateFundEntry`/`syncFundYearly`；`replaceMonthWithdrawals`；`addFundAnchor`/`removeFundAnchor`。
- `fund` 可选字段的校验与 `normalize`（旧数据补默认、缺失 fund 保持 undefined）。

### 组件测试

- MonthlyTable 公积金专区列渲染、单元格编辑、月冲默认联动显示。
- FundFlowEditor 提取编辑。
- 公积金余额锚点右键交互。

## 8. 边界与不变量（汇总）

- 提取/月冲超余额 → 截断到余额，不透支。
- 月冲不足 → 截断，差额由可支配房贷列自然承担。
- 锚点优先：可支配锚点 → `cumSavings`；公积金锚点 → `fundBalance`。
- 无 `fund` → 完全等价现状（`totalAssets === cumSavings`）。
- `fundOutflow` 当月不计 `investReturn`，下月生息。
- 不变量：`totalAssets === cumSavings + fundBalance`（每月成立）。

## 9. 实现顺序建议（供 writing-plans 参考）

1. `types.ts` 数据模型（新增类型 + 扩展 SystemParams/PlanData/MonthResult）。
2. `useCalculation` 双账户循环 + `resolveFundOffset` 等纯函数（配单元测试）。
3. `useStore` 校验/normalize/操作函数（配测试）。
4. MonthlyTable 公积金专区 5 列 + 单元格编辑。
5. FundFlowEditor 提取编辑。
6. 公积金余额锚点右键交互。
7. AnnualTable 汇总列。
8. FinanceChart 总资产主线。
9. FormulaPopover 公式扩展。
10. ParamPanel 公积金参数区。
