# 指标栏新增「累计总收入」实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: 用 superpowers:executing-plans 逐任务实现。步骤用 `- [ ]` 复选框跟踪。

**Goal:** 在顶部指标栏新增一格「累计总收入」（各月收入求和），并把顺序调整为 收入 → 支出 → 理财收益。

**Architecture:** 复用现有「指标聚合纯函数 + 展示组件」结构：在 `computeKeyMetrics` 增加 `totalIncome` 聚合字段（口径与 `useComparison` 的 `totalIncome` 完全一致），展示组件 `KeyMetricsBar` 在 `cells` 数组中插入新格并调整顺序。

**Tech Stack:** Vue 3 + TypeScript、Vitest、UnoCSS（中式配色：`positive`=朱砂红、`negative`=竹青绿）。

**关联设计文档：** `docs/superpowers/specs/2026-06-19-key-metrics-total-income-design.md`

---

## 文件结构

| 文件 | 责任 | 本次动作 |
|------|------|----------|
| `src/utils/keyMetrics.ts` | 由月度结果聚合首屏关键指标（纯函数） | 新增 `totalIncome` 字段与累加 |
| `src/components/KeyMetricsBar.vue` | 渲染指标栏各格 | 插入「累计总收入」格、调整顺序 |
| `tests/utils/keyMetrics.test.ts` | `computeKeyMetrics` 单元测试 | 新增 `totalIncome` 用例、更新空结果断言 |

说明：项目对纯逻辑（`utils/`）做单测、对展示组件较少单测；本计划沿用该模式——口径正确性由 `keyMetrics.test.ts` 保证，组件层靠类型检查（`npm run build`）与运行验证。

---

## Task 1: `computeKeyMetrics` 增加 `totalIncome` 聚合（TDD）

**Files:**
- Modify: `src/utils/keyMetrics.ts`
- Test: `tests/utils/keyMetrics.test.ts`

- [ ] **Step 1: 写失败测试**

在 `tests/utils/keyMetrics.test.ts` 的 `describe` 块内（建议紧跟「累计总支出」用例之后）新增：

```ts
it('累计总收入 = monthlyIncome 求和（不含初始本金）', () => {
  const r = [mk(202601, { monthlyIncome: 18000 }), mk(202602, { monthlyIncome: 18500 })]
  expect(computeKeyMetrics(r, false).totalIncome).toBe(36500)
})
```

- [ ] **Step 2: 运行测试，确认失败**

运行：`npx vitest run tests/utils/keyMetrics.test.ts`
预期：FAIL，报 `totalIncome` 为 `undefined`（字段尚未存在）。

- [ ] **Step 3: 实现：接口加字段**

修改 `src/utils/keyMetrics.ts` 的 `KeyMetrics` 接口，新增一行：

```ts
export interface KeyMetrics {
  finalCum: number       // 最终累计存款（末月 cumSavings）
  minCum: number         // 期间最低累计存款
  minMonth: number       // 最低点所在月（YYYYMM；空结果为 0）
  totalReturn: number    // 累计理财收益
  totalExpense: number   // 累计总支出（正数金额）
  totalIncome: number    // 累计总收入（各月 monthlyIncome 求和，不含初始本金）
  fundBalance: number | null  // 末月公积金余额；未启用公积金为 null
}
```

- [ ] **Step 4: 实现：函数体累加 + 空结果**

修改 `computeKeyMetrics` 函数（三处：空结果返回值、新增累加变量、循环内累加、返回对象）：

```ts
export function computeKeyMetrics(results: MonthResult[], fundEnabled: boolean): KeyMetrics {
  if (results.length === 0) {
    return { finalCum: 0, minCum: 0, minMonth: 0, totalReturn: 0, totalExpense: 0, totalIncome: 0, fundBalance: null }
  }
  let minCum = results[0].cumSavings
  let minMonth = results[0].month
  let totalReturn = 0
  let totalExpense = 0
  let totalIncome = 0
  for (const r of results) {
    if (r.cumSavings < minCum) {
      minCum = r.cumSavings
      minMonth = r.month
    }
    totalReturn += r.investReturn
    totalExpense += r.monthlyExpense
    totalIncome += r.monthlyIncome
  }
  const last = results[results.length - 1]
  return {
    finalCum: last.cumSavings,
    minCum,
    minMonth,
    totalReturn,
    totalExpense,
    totalIncome,
    fundBalance: fundEnabled ? last.fundBalance : null,
  }
}
```

- [ ] **Step 5: 更新空结果用例的断言**

修改 `tests/utils/keyMetrics.test.ts` 中「空结果返回 0 且不抛错」用例，补一条断言：

```ts
it('空结果返回 0 且不抛错', () => {
  const m = computeKeyMetrics([], false)
  expect(m.finalCum).toBe(0)
  expect(m.minMonth).toBe(0)
  expect(m.totalIncome).toBe(0)
})
```

- [ ] **Step 6: 运行测试，确认通过**

运行：`npx vitest run tests/utils/keyMetrics.test.ts`
预期：PASS（全部用例，含新增的「累计总收入」用例）。

- [ ] **Step 7: 提交**

```bash
git add src/utils/keyMetrics.ts tests/utils/keyMetrics.test.ts
git commit -m "feat(metrics): 指标聚合增加累计总收入（各月收入求和）"
```

---

## Task 2: `KeyMetricsBar` 新增「累计总收入」格并调整顺序

**Files:**
- Modify: `src/components/KeyMetricsBar.vue`（`cells` computed，约 26-46 行）

- [ ] **Step 1: 修改 `cells` 数组**

将 `src/components/KeyMetricsBar.vue` 中 `base: Cell[]` 数组改为以下顺序（在「期间最低存款」后插入「累计总收入」，并把「累计理财收益」移到「累计总支出」之后）：

```ts
  const base: Cell[] = [
    {
      label: '期末存款',
      value: formatCurrency(m.value.finalCum),
      sub: monthCount > 0 ? `月均净存入 ¥${formatCurrency(monthlyAvg)}` : undefined,
      tone: '',
    },
    {
      label: '期间最低存款',
      value: formatCurrency(m.value.minCum),
      sub: m.value.minMonth ? monthToLabel(m.value.minMonth) : undefined,
      tone: minIsWarn.value ? 'warn' : '',
    },
    { label: '累计总收入', value: formatCurrency(m.value.totalIncome), tone: 'pos' },
    { label: '累计总支出', value: formatCurrency(m.value.totalExpense), tone: 'neg' },
    { label: '累计理财收益', value: formatCurrency(m.value.totalReturn), tone: 'pos' },
  ]
```

要点：
- 新增「累计总收入」格 `tone: 'pos'`（朱砂红，与「累计理财收益」同色）。
- 「累计理财收益」从原第 3 格移到第 5 格（支出之后），实现 收入 → 支出 → 收益 顺序。
- 公积金条件格（`if (m.value.fundBalance !== null)` 分支）不动，仍追加在最末。

- [ ] **Step 2: 类型检查 + 全量测试，确认无破坏**

运行：`npm run build`
预期：构建成功，无 TypeScript 报错（验证 `m.value.totalIncome` 类型正确、模板渲染无误）。

运行：`npm run test`
预期：全部测试通过（组件改动不影响现有用例）。

- [ ] **Step 3: 运行验证（人工）**

启动 `npm run dev`，在浏览器查看指标栏：
- 未开公积金时为 5 格，顺序：期末存款 → 期间最低存款 → 累计总收入(红) → 累计总支出(绿) → 累计理财收益(红)。
- 「累计总收入」数值 = 各月收入之和，与「方案对比 → 全程总收入」一致。
- 开启公积金时为 6 格（最右多「公积金期末余额」）。

- [ ] **Step 4: 提交**

```bash
git add src/components/KeyMetricsBar.vue
git commit -m "feat(ui): 指标栏新增累计总收入格，顺序调整为收入→支出→收益"
```

---

## 验收清单

- [ ] `computeKeyMetrics` 返回 `totalIncome`（各月 `monthlyIncome` 求和，不含初始本金）。
- [ ] 指标栏显示「累计总收入」格，朱砂红，位于「期间最低存款」与「累计总支出」之间。
- [ ] 顺序为 期末存款 → 期间最低存款 → 累计总收入 → 累计总支出 → 累计理财收益（→ 公积金）。
- [ ] 「累计总收入」数值与「方案对比 → 全程总收入」一致。
- [ ] `npm run test` 全绿、`npm run build` 通过。
