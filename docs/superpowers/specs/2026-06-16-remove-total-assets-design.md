# 移除界面「总资产」展示，图表主线回归「存款」

日期：2026-06-16

## 背景

「总资产 = 存款(cumSavings) + 公积金余额(fundBalance)」这个合计，目前在多处界面展示：

- 月度表（`MonthlyTable`）公积金专区最右列；
- 年度表（`AnnualTable`）公积金启用时的「总资产」行；
- 图表（`FinanceChart`）：主曲线 + 标题区高亮数字 + 鼠标悬停 tooltip。

其中存款、公积金余额已各自单独展示，合计值属信息冗余。项目负责人判断「总资产」这一合计在界面上无必要。

## 目标

将「总资产」从所有界面展示中撤除；图表主曲线由「总资产」回归为「存款」（`cumSavings`），保留储蓄累积趋势主线。

## 非目标（明确不做）

- **不动计算层**：`totalAssets` 字段继续在 `MonthResult` / 年度汇总中由计算逻辑产出（计算过程的自然副产物）。
- **不动 `monthlyAudit`** 中「总资产 = 存款 + 公积金」的正确性不变量。
- **不动公积金余额**的任何展示：月度表「公积金」列、年度表「公积金」行、图表公积金余额副线。
- **不动任何计算逻辑**（`useCalculation`、`aggregateByYear`）。

## 用户可见变化

1. **月度表**：公积金专区删去「总资产」列，专区剩 5 列（房贷月供 / 公积金缴存 / 公积金月冲 / 存款补扣 / 公积金余额）。
2. **年度表**：删去「总资产」行，公积金启用时仅剩「公积金」行。
3. **图表**：
   - 主线系列由 `totalAssets` 改为 `cumSavings`，名称「总资产」→「存款」，保留靛蓝色 `COLOR_CUM` + 渐变面积 `areaStyle`（视觉不变，仅语义换）。
   - 标题区高亮数字由「当前总资产」改为「当前存款」（取最末月 `cumSavings`）。
   - tooltip 中「总资产」行改为「存款」。
4. **公积金余额副线**（图表琥珀色细线）：保留不动。

## 涉及改动（文件级）

### 展示层

- `src/components/MonthlyTable.vue`
  - 删公积金专区（`v-if="fund"` template 内）的「总资产」表头 `<th>` 与每行「总资产」单元格 `<td>`；
  - 移除组件内与总资产列相关的列名映射 / hover 公式调用。

- `src/components/AnnualTable.vue`
  - 删公积金启用 template 内的「总资产」行 `<tr>`；
  - 移除对应 hover 公式调用。

- `src/components/FinanceChart.vue`
  - 标题区高亮：取值由最末月 `totalAssets` 改为 `cumSavings`，文字「总资产」→「存款」。

- `src/utils/financeChart.ts`
  - `ChartData` 删 `totalAssets: number[]` 字段（保留 `fundBalance`）；
  - `buildChartData` 月、年两处不再产出 `totalAssets`；
  - `buildChartOption`：主线 `name:'总资产', data:data.totalAssets` → `name:'存款', data:data.cumSavings`；`legendData` 同步「总资产」→「存款」；
  - tooltip formatter：`get('总资产')` → `get('存款')`，标签「总资产」→「存款」。

### 死代码清理（展示撤除后无引用方）

- `src/utils/formula.ts`
  - 月度：`MonthFormulaField` 去掉 `'totalAssets'`；`MONTH_LABELS` 删 `totalAssets`；`buildMonthFormula` 删 `case 'totalAssets'`。
  - 年度：`YearFormulaField` 去掉 `'totalAssets'`；`YEAR_LABELS` 删 `totalAssets`；`YearFormulaContext` 删 `yearEndTotalAssets`；`buildYearFormula` 删 `case 'totalAssets'`。

### 保留不动

- `src/types.ts` 的 `totalAssets` 字段；
- `src/composables/useCalculation.ts` 的计算与 `aggregateByYear`；
- `monthlyAudit` 的总资产不变量。

## 测试更新

- `tests/components/MonthlyTable.spec.ts`：总资产列相关用例改为「不出现总资产」或删除。
- `tests/components/AnnualTable.spec.ts`：`公积金/总资产` describe 块改为只验「公积金」行，断言「不出现总资产」。
- `tests/components/FinanceChart.spec.ts`：标题高亮文字「存款」；主线名「存款」。
- `tests/utils/financeChart.spec.ts`：系列名 / legend / tooltip 中「总资产」→「存款」，主线数据源改为 `cumSavings`。
- `tests/utils/formula.spec.ts`：删「总资产公式」「年末总资产公式」用例。
- `tests/composables/monthlyAudit.spec.ts`：不动（仍校验 `totalAssets` 不变量）。

## 风险与回滚

- **风险低**：仅展示层 + 死代码清理，不碰计算核心；`totalAssets` 数据仍由计算层产出，保留不变量校验兜底。
- **回滚**：`git revert` 本次提交即可恢复展示。
