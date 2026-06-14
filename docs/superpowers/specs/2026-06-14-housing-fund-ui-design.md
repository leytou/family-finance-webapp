# 住房公积金 UI 集成设计

> 日期：2026-06-14
> 状态：已定稿，待实现计划
> 依赖：核心计算与状态层已完成（`docs/superpowers/specs/2026-06-14-housing-fund-design.md`）。
> 基线：当前 master `npx vitest run` = **335 测试全绿**（22 文件）。
> 关联：
> - **header 两行重构已完成并合入**（commit `3fddef9`）：App.vue 现已是「导航/操作」两行，第二行「参数」区含起始月份/年化收益率/初始存款 + 撤销/重做。本设计的公积金参数直接进该现有参数行，**无需再做 header 重构**。
> - **图表专业化改版**（`chart-redesign-design.md` / `chart-redesign.md`）为独立**已规划未实现**努力：大改 `buildChartOption`（累计储蓄→渐变面积+粗线、支出正值双柱、朱砂/竹青配色、万元格式），**不涉及 fund/总资产/公积金**。本设计的图表双线任务建立在**当前**（未改版）图表之上；若改版先实现，双线需并入其 area 主线形态。

## 1. 背景与范围

公积金核心层（数据模型、双账户计算循环 `processFund`、`useStore` 操作函数）已合并 master。本设计覆盖 **UI 集成层**——把已就绪的 fund 数据与 API 接入现有界面，让用户能启用公积金、编辑缴存/月冲/提取、查看公积金余额与总资产。

**非目标（YAGNI）：**
- 不改任何核心计算逻辑（`useCalculation` 不动）。
- 不改公积金数据模型（`types.ts` 不动）。
- 不加可支配储蓄线在图表的切换（默认隐藏即可，后续按需）。
- 不加年度结息合计行（spec 标「可选」，本期略）。
- 不做窄屏响应式收纳。
- 不实现图表专业化改版（`chart-redesign`，独立 effort，见顶部关联）。本任务的图表双线建立在当前（未改版）图表之上。

## 2. 已确认的交互决策

| 决策点 | 选择 |
|---|---|
| header 与 fund 参数耦合 | **复用现有参数行**：header 两行重构已合入（`3fddef9`），公积金参数直接进第二行「参数」区，无需再做重构 |
| 公积金参数排布 | **开关门控**：`enableFund` 复选框 +「公积金」小标签分隔；未启用隐藏 3 个输入 |
| 月冲默认联动视觉提示 | **淡灰文字**（`text-neutral-400`、无蓝底）；手填→正常黑字 + 淡蓝底 `bg-brand-50`；hover 公式说明 |
| 专区列分组 | **轻量分隔竖线**（`border-l-2 border-neutral-400`、无底色）；总资产加粗 |
| FundFlowEditor 布局 | **竖向流水 + 内嵌提取编辑**（fixed 弹层定位点击坐标，仿 EventEditor） |
| 图表叠加 | **双线**：总资产主线（靛蓝加粗）+ 公积金余额副线（琥珀淡线）；可支配储蓄默认隐藏 |

## 3. 关键约定（继承自核心层，UI 须遵守）

- **mortgage 符号**：房贷月供在数据里存**负数**。`resolveFundOffset` 内部 `Math.abs` 得正数月冲目标。
- **月冲默认联动**：月冲列未手填（`hasColumnValue(monthlyOffset, month) === false`）时，目标值取房贷月供绝对值；手填则覆盖。
- **公积金转出不计可支配收支**：`monthlyIncome/monthlyExpense` 不含公积金流水（核心层已保证），UI 收支列无需特殊处理。
- **无 fund 时完全退化**：专区列不渲染、图表公积金线不渲染、`totalAssets === cumSavings`。

## 4. MonthlyTable 公积金专区（5 列）

在现有「存款」列之后新增 5 列，前置 `border-l-2 border-neutral-400` 粗竖线分隔（比理财列 `border-neutral-300` 更重，标志专区起点）。**仅当 `store.data.value.fund` 存在时整块专区渲染（`v-if`），未启用零侵入。**

| 列 | 编辑性 | 显示 | 备注 |
|---|---|---|---|
| 房贷月供 | 可编辑 | 显示绝对值（正数） | 内部存负；提交取负（见 §4.1） |
| 公积金缴存 | 可编辑 | 正数 | 存正数，复用单元格编辑 |
| 公积金月冲 | 可编辑 | 正数；未手填=淡灰联动房贷月供 | 手填→蓝底 |
| 公积金 | 只读 | `fundBalance`；左键开 FundFlowEditor；右键设锚点；`isFundAnchor`→蓝底 | hover 公式 |
| 总资产 | 只读 | `totalAssets`，加粗 | hover 公式 |

### 4.1 房贷月供符号处理

房贷月供内部存负数（`-5000`），但**单元格显示绝对值**，编辑框接受正数、提交时取负（`-value`）。

理由：
1. 与「公积金月冲」列（也显示正数）一致。
2. 与「支出」列对房贷的呈现一致（`monthlyExpense` 本就显示正数幅度）。
3. 避免用户漏写负号导致房贷误计为可支配收入。

**缴存/月冲存正数、不做符号翻转；仅房贷翻转。**

### 4.2 月冲默认联动视觉

- **未手填**（`hasColumnValue(fund.monthlyOffset, month) === false`）：单元格显示 `resolveFundOffset`（= 房贷月供绝对值），样式 `text-neutral-400`（淡灰）、**无蓝底**；点击可覆盖编辑。hover → FormulaPopover「月冲 = 房贷月供(X) [自动联动]」。
- **手填覆盖**：显示用户输入值，正常黑字 + 淡蓝底 `bg-brand-50`（复用「蓝底=已编辑」语义）。hover →「月冲 = 手填值(X)」。

此标记不与现有约定冲突：蓝底=已编辑、斜体=负数、`opacity-40`=禁用列、`↻`=年度。

### 4.3 公积金余额单元格三态

- **左键** → 打开 `FundFlowEditor`（与专项列左键开 EventEditor 同模式）。
- **右键** → 锚点菜单（新增 `FUND_BALANCE_COLUMN_ID`，见 §5）。
- **hover** → FormulaPopover（公积金余额公式，见 §7）。
- `isFundAnchor === true` → `bg-brand-50` 高亮（同存款锚点）。

### 4.4 单元格编辑实现

现有 `startEditCell/confirmEditCell` 按 `columnId`（动态列）运作。公积金 3 列（mortgage/contribution/monthlyOffset）不在 `columns` 里，走 `updateFundEntry(field, month, value)`。

**不重载现有函数**（避免破坏现有 11 处列编辑断言），新增并行的小型 fund 编辑路径，**完全镜像现有 `editCell`/`editCum` 双 ref 模式**（每个编辑态独立 ref + 独立 `useClickOutside`）：
- 状态：`editingFundCell: { field: 'mortgage'|'contribution'|'monthlyOffset'; month: number } | null`、`editFundCellValue: string`、`editFundCellInput: HTMLInputElement | null`（独立 ref，**不复用 `editCellInput`**，避免外部点击误触发 `confirmEditCell`）、`editFundOriginalValue: number`。
- 函数：`setEditFundCellInput(el)` 函数 ref setter、`startEditFundCell(field, month, currentValue)`、`confirmEditFundCell()`、`cancelEditFundCell()`、`moveEditFundCell(field, month, direction)`、`handleEditFundCellBlur()`。
- 共享 `skipBlur` 标志（上下键跨行移动时跳过 blur）、共享 `v-focus` 指令。
- `confirmEditFundCell` 内：`field === 'mortgage'` 时提交值取负（`-Math.round(num)`）；其余两字段原样。空输入 → `updateFundEntry(field, month, null)` 删除 entry。值未变化时不写入。
- 单独注册 `useClickOutside(editFundCellInput, confirmEditFundCell)`。

## 5. 公积金余额锚点右键（`FUND_BALANCE_COLUMN_ID`）

新增常量 `FUND_BALANCE_COLUMN_ID = '__fund_balance__'`。`openContextMenu` 已接受任意 columnId；`contextMenuItems` 计算属性扩展：
- `BALANCE_COLUMN_ID` 与 `FUND_BALANCE_COLUMN_ID` 均**不显示**「同步到每年此月」（只读列，无 entry）。
- 「清除下方编辑值」项：
  - `BALANCE_COLUMN_ID` → `store.removeAnchor(r.month)`
  - `FUND_BALANCE_COLUMN_ID` → `store.removeFundAnchor(r.month)`
- `editedBelowRows` / `countEditedBelow`：`FUND_BALANCE_COLUMN_ID` 判断 `r.isFundAnchor`。

## 6. FundFlowEditor 组件（新建 `src/components/FundFlowEditor.vue`）

仿 `EventEditor.vue`：`fixed` 定位在点击坐标、`useClickOutside`+Esc→`commit`、草稿行稳定 key（`draftKeySeq`）、`markDirty` 跳过 no-op 写入、`onMounted` 聚焦容器接收 Esc。

### 6.1 竖向流水 + 内嵌提取编辑

```
2026-02 公积金
期初余额           2,000        ← 上月 result.fundBalance（首月取 fundInitialBalance）
+ 缴存             2,000        ← result.fundContribution（只读）
- 提取                          ← 该组可编辑
   [首付提取] [1000] ×          ← name+amount，+添加，×删除（草稿行）
   + 添加
- 月冲                0         ← result.fundOffset（只读，processFund 实际截断值）
+ 结息                0         ← result.fundInterest（只读，仅结息月非 0）
─────────────────
= 期末余额         3,000  ●     ← result.fundBalance（加粗）
                    [完成]
```

### 6.2 编辑范围与数据来源

- **只编辑提取**（`store.replaceMonthWithdrawals(month, items)`）；缴存/月冲/结息只读展示（在各自列/派生计算）。
- Props：`month`、`result`（该月 `MonthResult`，取 fundContribution/fundOffset/fundInterest/fundBalance）、`prevFundBalance`（期初）、`withdrawals`（该月 `FundWithdrawal[]`，初始化草稿）、`x/y`。
- 提交 `commit`：`markDirty` 时把草稿行过滤（名称非空 + 金额有限数）后 `replaceMonthWithdrawals`。

### 6.3 流水顺序与截断

- **流水顺序遵循 `processFund` 计算顺序**：缴存 → 提取 → 月冲 → 结息。（spec §6.3 文字把月冲写在提取前，但 §4.4 与代码 `processFund` 是提取在前；两负项不影响期末，按代码顺序更准。）
- **截断处理**：编辑行显示**请求值**（用户输入）；`-提取`/`-月冲` 流水行显示 `processFund` **实际截断值**（`result.fundWithdrawal` / `result.fundOffset`）。两者不等时编辑行附「已截断」提示。期末恒等于 `result.fundBalance`，保证流水自洽。

> 注意：spec §6.3 把月冲列在提取前；本设计按 `processFund` 实际顺序（提取→月冲）展示，已在 §2 决策中与用户确认。

## 7. formula.ts 扩展

### 7.1 `MonthFormulaField` 扩展

新增 `'fundOffset' | 'fundBalance' | 'fundInterest' | 'totalAssets'`。`MONTH_LABELS` 补对应中文（月冲/公积金/结息/总资产）。

`buildMonthFormula` 新增 case：
- **月冲**：`hasColumnValue` 为真 → `公积金月冲 = 手填值(X)`；为假 → `公积金月冲 = 房贷月供(X) [自动联动]`。
- **公积金余额**：`公积金 = 上月余额(A) + 缴存(B) - 提取(C) - 月冲(D) + 结息(E) = F`（A=prevFundBalance，B=fundContribution，C=fundWithdrawal，D=fundOffset，E=fundInterest，F=fundBalance）。
- **结息**：`结息 = 应计利息(X) [年利率 {rate}%]`（结息月；rate=fundRate×100）。非结息月 `fundInterest=0`，公式显示 `结息 = 0（非结息月）`。
- **总资产**：`总资产 = 存款(A) + 公积金(B) = C`。

`MonthFormulaContext` 新增可选字段：`prevFundBalance`、`fundContribution`、`fundWithdrawal`、`fundOffset`、`fundInterest`、`fundBalance`、`fundRate`、`mortgageAbs`（房贷月供绝对值）、`offsetAutoLinked`（是否自动联动）。

### 7.2 `YearFormulaField` 扩展

新增 `'fundBalance' | 'totalAssets'`。`buildYearFormula` 加对应 case（年末 fundBalance / 年末 totalAssets）。

## 8. AnnualTable 新增行

`yearSummaries` 已按年聚合 `MonthResult`。在「年末存款」行后新增（仅 `fund` 启用时渲染）：
- **公积金** 行 = 该年最后一月 `fundBalance`。
- **总资产** 行 = 该年最后一月 `totalAssets`（加粗，`bg-neutral-50` 同年末存款行风格）。

两行支持 hover 公式（`buildYearFormula` 新 case）。**不加年度结息合计行**（YAGNI）。

## 9. FinanceChart 双线

### 9.1 `financeChart.ts`

- `ChartData` 新增 `totalAssets: number[]`、`fundBalance: number[]`。
- `buildChartData`：按月/按年填充（按年用年末值，取自扩展后的 `aggregateByYear`，见 §9.3）。
- `buildChartOption(data, fundEnabled)`：
  - `累计储蓄` 线 → 改名 **总资产**（靛蓝 `COLOR_CUM`，加粗线宽）。
  - **仅当 `fundEnabled === true`** 时新增 **公积金余额** 线（琥珀 `#d97706`、`showSymbol:false`、`smooth:true`），并把它加入图例。
  - 新增配色常量 `COLOR_FUND = '#d97706'`。
- **退化**：`fundEnabled === false`（`store.data.value.fund` 不存在）时不 push 公积金线，图例仅 `['收入','支出','总资产']`；`总资产` 线等同原累计储蓄。显式传 flag 避免用「fundBalance 全 0」误判「启用但余额恰为 0」。

### 9.2 FinanceChart.vue

- `import { useStore }`（与 MonthlyTable/AnnualTable 兄弟一致），读 `const fundEnabled = computed(() => !!store.data.value.fund)`。
- `render()` 调 `buildChartOption(chartData.value, fundEnabled.value)`。
- `aggregateByYear` / `YearlyPoint` 扩展见 §9.3。

### 9.3 `aggregateByYear` 扩展（`useCalculation.ts`）

`YearlyPoint` 新增 `totalAssets: number`、`fundBalance: number`（年末值，取该年最后一月 `MonthResult`），供按年图表使用。

## 10. App.vue 参数行 · 追加公积金参数

header 两行重构已合入（`3fddef9`）。第二行「参数」区现有：起始月份 / 年化收益率 / 初始存款（左侧）+ 撤销/重做（右侧）。**仅在左侧参数组末尾（初始存款之后）追加公积金参数，不动其他控件与两行结构。**

```
[参数] 起始月份[__] 年化%[__] 初始存款[__] │ 公积金[☑启用] 年利率%[1.5] 结息月[7] 初始余额[0]   ↶撤销 ↷重做
```

- 「公积金」小标签 + 左竖线分隔（`border-l pl-3`，与「参数」标签同级风格），作为参数组内的子分组。
- `enableFund` 复选框：勾选→`store.enableFund()`，取消→`store.disableFund()`（双向桥接；`disableFund` 会清空 fund 配置，需 `window.confirm` 二次确认以防误删）。
- 未启用时 `v-if="data.fund"` 隐藏后 3 个输入；启用后行内出现（开关门控，§2 已确认）。
- 3 个输入分别绑 `setFundRate` / `setFundInterestMonth` / `setFundInitialBalance`：
  - 年利率：`:value="(data.systemParams.fundRate*100).toFixed(1)"` + `@input` 写回 `Number(v)/100`。
  - 结息月：`<select>` 1-12 或 number input，绑 `setFundInterestMonth`。
  - 初始余额：number input，绑 `setFundInitialBalance`。
- `App.vue` script 解构 `useStore()` 补 `enableFund/disableFund/setFundRate/setFundInterestMonth/setFundInitialBalance`。

> 注：复选框「取消启用」会丢失 fund 配置（缴存/月冲/提取/锚点全删）。加 `window.confirm` 二次确认作为防误删保护（spec 原未提及，属本次新增的防误删决策）。

## 11. 文件改动清单

| 文件 | 改动 |
|---|---|
| `src/components/MonthlyTable.vue` | 专区 5 列 + 粗竖线；fund 单元格编辑路径（`startEditFundCell`/`confirmEditFundCell`/`moveEditFundCell`）；月冲联动视觉；`FUND_BALANCE_COLUMN_ID` 右键；FundFlowEditor 接入 |
| `src/components/FundFlowEditor.vue` | **新建**，竖向流水 + 内嵌提取编辑 |
| `src/components/AnnualTable.vue` | 「公积金」「总资产」两行 + hover 公式 |
| `src/components/FinanceChart.vue` | `import { useStore }` 读 `fund` 存在性，传 `fundEnabled` 给 `buildChartOption` |
| `src/utils/financeChart.ts` | `ChartData` 加 totalAssets/fundBalance；双线 option；退化处理 |
| `src/composables/useCalculation.ts` | `aggregateByYear` / `YearlyPoint` 加 totalAssets/fundBalance 年末值 |
| `src/utils/formula.ts` | `MonthFormulaField`/`YearFormulaField` 扩展 + build 公式新 case |
| `src/App.vue` | 参数行追加公积金参数（enableFund 门控 + 3 输入 + disable 二次确认）；不动两行结构与现有控件 |
| `tests/components/FundFlowEditor.spec.ts` | **新建** |
| `tests/components/MonthlyTable.spec.ts` | 专区列渲染/编辑/月冲联动/余额右键 |
| `tests/components/AnnualTable.spec.ts` | 公积金/总资产行 |
| `tests/components/FinanceChart.spec.ts`（已存在） | 扩展：双线数据 + 退化 |
| `tests/App.spec.ts` | 公积金参数区（enableFund 门控 / 3 输入绑定 / disable 确认）；不动两行结构断言 |

> 不改动：`src/components/ToolsMenu.vue`（`更多` 已完成 `25a9d49`）、`tests/components/ToolsMenu.spec.ts`（已存在）；header 两行结构本身（已完成 `3fddef9`）。

## 12. 测试计划

- **MonthlyTable**：专区 5 列仅在 fund 启用时渲染；房贷月供输入正数存负数；月冲未手填显示房贷月供绝对值且淡灰、手填蓝底；公积金余额左键开 FundFlowEditor、右键出锚点菜单、`isFundAnchor` 高亮；总资产只读。
- **FundFlowEditor**：流水展示期初/缴存/提取/月冲/结息/期末；提取增删改提交 `replaceMonthWithdrawals`；截断时编辑行显示请求值+「已截断」、流水行显示实际值；完成/外部点击提交。
- **FUND_BALANCE 右键**：仅「清除下方公积金锚点」；无年度同步项；调 `removeFundAnchor`。
- **AnnualTable**：fund 启用时多「公积金」「总资产」两行；未启用不出现。
- **FinanceChart**：fund 启用 → totalAssets + fundBalance 双线；未启用 → 仅总资产线（退化）。
- **App.vue 参数行**：enableFund 门控隐藏/显示 3 输入；3 输入绑定正确（年利率/结息月/初始余额）；取消启用弹二次确认。
- **formula**：各新 case 输出符合预期文案。

## 13. 完成标准

- `npx vitest run` 全绿（**335 基线** + 新增）。
- `npx vue-tsc --noEmit` 无类型错误。
- `npm run build` 通过。
- 无 fund 时 UI 完全退化（专区/图表公积金线不出现，总资产=存款），与改造前一致。
- 不破坏既有 header 两行结构 / 视图三按钮 / ToolsMenu「更多」断言。
- 每任务独立提交，提交信息中文。

## 14. 实现顺序建议（供 writing-plans 参考）

1. App.vue 参数行追加公积金参数（enableFund 门控 + 3 输入 + disable 二次确认）——启用入口，先做才能验证后续。
2. MonthlyTable 专区 5 列骨架（仅 fund 启用渲染 + 粗竖线 + 总资产/余额只读列）。
3. MonthlyTable fund 单元格编辑（房贷/缴存/月冲 + 月冲联动视觉 + 符号翻转）。
4. 公积金余额列三态（hover 公式 + 锚点高亮 + `FUND_BALANCE_COLUMN_ID` 右键）。
5. FundFlowEditor 组件 + 接入余额单元格左键。
6. formula.ts 扩展（月冲/余额/结息/总资产公式）。
7. AnnualTable 公积金/总资产行 + aggregateByYear 扩展。
8. FinanceChart 双线 + 退化。

> 顺序理由：参数行（启用入口）先做；专区骨架先于编辑/交互；FundFlowEditor 依赖余额列左键接入；formula 供多个组件 hover；图表/年度表最后，纯展示。注意 §1 图表改版为并行独立努力，若先于本任务实现，第 8 步需并入其 area 主线形态。
