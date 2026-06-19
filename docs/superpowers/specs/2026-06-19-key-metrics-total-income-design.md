# 指标栏新增「累计总收入」

## 背景

顶部指标栏（`KeyMetricsBar`）当前展示：期末存款、期间最低存款、累计理财收益、累计总支出、公积金期末余额（启用公积金时）。缺少「累计总收入」，用户希望补上，与「累计总支出」「累计理财收益」凑成 收入 / 支出 / 收益 的完整对照。

## 目标

在指标栏新增一格「累计总收入」。

## 现状

- 指标由 `src/utils/keyMetrics.ts` 的纯函数 `computeKeyMetrics(results, fundEnabled)` 聚合，返回 `KeyMetrics`。
  - 现有字段：`finalCum`（末月 cumSavings）、`minCum`/`minMonth`（期间最低点）、`totalReturn`（investReturn 求和）、`totalExpense`（monthlyExpense 求和）、`fundBalance`（末月公积金余额）。
- 展示组件 `src/components/KeyMetricsBar.vue` 按 `cells` 数组渲染，每格 `{ label, value, sub?, tone }`，`tone` 决定圆点与数字颜色。
- 口径参照：`src/composables/useComparison.ts` 的 `computeScenarioMetrics` 已有
  `totalIncome = results.reduce((sum, r) => sum + r.monthlyIncome, 0)`，对应「方案对比」中的「全程总收入」行。
- 配色约定（`uno.config.ts`，**与常规红绿相反，需特别注意**）：
  - `positive` = 朱砂红 `#c0504d`，语义为 收入 / 增长
  - `negative` = 竹青绿 `#5e8270`，语义为 支出 / 下降
  - `warning` = 琥珀橙 `#d97706`
  - `brand` = 靛蓝 `#4f46e5`（圆点用）
  - `ink` = 近黑 `#1a2233`（中性数字用）

## 设计

### 口径

- 「累计总收入」= 各月 `monthlyIncome` 求和（**不含初始本金**；初始存款是起步本金，不计入月收入）。
- 必须与「方案对比」的「全程总收入」口径完全一致，避免两处数字对不上。

### 指标栏顺序（最终）

未开公积金（5 格）：

```
期末存款 → 期间最低存款 → 累计总收入 → 累计总支出 → 累计理财收益
```

开了公积金（6 格）：以上顺序 + 公积金期末余额（最右）。

即：在「期间最低存款」之后插入「累计总收入」；原「累计理财收益」从第 3 格移至第 5 格（支出之后）。

### 配色

- 「累计总收入」`tone = 'pos'`（朱砂红），圆点 + 数字均红色，与「累计理财收益」同色。
- 其余各格配色不变。

颜色对照（圆点 / 数字）：

| 格子 | 圆点 | 数字 |
|------|------|------|
| 期末存款 | 靛蓝 | 近黑 |
| 期间最低存款 | 靛蓝（低于初始存款时变橙） | 近黑（告警时变橙） |
| **累计总收入（新增）** | 朱砂红 | 朱砂红 |
| 累计总支出 | 竹青绿 | 竹青绿 |
| 累计理财收益 | 朱砂红 | 朱砂红 |
| 公积金期末余额 | 琥珀橙 | 琥珀橙 |

## 改动点

1. `src/utils/keyMetrics.ts`
   - `KeyMetrics` 接口新增 `totalIncome: number`。
   - `computeKeyMetrics` 循环中累加 `totalIncome += r.monthlyIncome`；空结果返回 `totalIncome: 0`。
2. `src/components/KeyMetricsBar.vue`
   - `cells` 中在「期间最低存款」之后插入「累计总收入」格：`{ label: '累计总收入', value: formatCurrency(m.value.totalIncome), tone: 'pos' }`。
   - 保持其后「累计总支出」→「累计理财收益」的顺序（理财收益因此移到支出之后）。
3. 测试
   - `tests/utils/keyMetrics.test.ts`：新增用例「累计总收入 = monthlyIncome 求和」；空结果用例补 `totalIncome` 为 0 的断言。
   - 若存在 `KeyMetricsBar` 组件渲染测试，补一格「累计总收入」的断言。

## 非目标（YAGNI）

- 不改动「方案对比」视图（已有「全程总收入」行）。
- 不改动月度 / 年度表格。
- 不为「累计总收入」加副标题（`sub`），与理财收益 / 支出保持一致。

## 风险 / 注意

- 「累计理财收益」位置后移是肉眼可见的 UI 变化，已与用户确认接受。
- `totalIncome` 口径须与 `useComparison` 一致（均不含初始本金）。
