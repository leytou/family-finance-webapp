# UI 重新设计（浅色金融终端）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把家庭财务规划应用的整个界面改造为「浅色金融终端」风格，新增关键指标条作为视觉焦点，所有功能/计算/数据/交互零改动。

**Architecture:** 分两层落地——① 设计基底（UnoCSS token 扩展 + 全局字体/样式 + 一个可测的关键指标聚合纯函数）；② 按视图/弹窗并行铺开新视觉。视觉改造以「配色/类名映射表 + 文件改动要点 + 验证」驱动，不重写数据与逻辑。

**Tech Stack:** Vue 3 (Composition API + TS)、UnoCSS、ECharts 6、Vitest、vite-plugin-singlefile

**参考设计文档：** `docs/superpowers/specs/2026-06-19-ui-redesign-design.md`

---

## 关于 TDD 的说明（重要）

本计划是**视觉改造**。TDD 只适用于「有计算逻辑」的部分：

- **Task 2（关键指标聚合）** 用完整 TDD：抽成纯函数 `computeKeyMetrics()`，先写测试。
- **其余 Task（纯样式/排版）** 不写新单元测试。验证标准统一为三条：
  1. `npm run test` 全部通过（确保没破坏现有行为 / `data-testid`）
  2. `npm run build` 通过（含 `vue-tsc` 类型检查）
  3. 用真实数据导入后手动核对（见 Task 11 的核对清单）

这是诚实的做法：样式无法用单元测试断言，强行写 DOM 快照测试维护成本高且脆弱。

## File Structure

**新建：**
- `src/utils/keyMetrics.ts` — 纯函数 `computeKeyMetrics(results, fundEnabled)`，聚合关键指标（可单测）
- `src/components/KeyMetricsBar.vue` — 关键指标条（纯展示，消费上面的纯函数）
- `src/styles/theme.css` — 全局：字体 @import、`:root` 变量、body 基础、滚动条
- `tests/utils/keyMetrics.test.ts` — 聚合函数测试

**修改：**
- `uno.config.ts` — 扩展 `theme.colors`（canvas/surface/line/ink）与 `theme.fontFamily`（mono/sans）
- `src/main.ts` — 引入 `theme.css`
- `src/App.vue` — 主框架（导航/参数行/指标条接入/布局 B/视图切换样式）
- `src/components/MonthlyTable.vue` — 视觉 + 负数改色（第 644 行）
- `src/components/AnnualTable.vue` — 视觉
- `src/components/FinanceChart.vue` — 外壳视觉（标题区/容器）
- `src/utils/financeChart.ts` — 配色常量微调（网格/轴对齐新 token，配色语义不变）
- `src/components/ComparisonView.vue` — 视觉
- `src/components/CalculatorView.vue` — 视觉
- `src/components/FormulaPopover.vue`、`EventEditor.vue`、`EventDetailPopover.vue`、`ContextMenu.vue`、`MonthPicker.vue`、`FundFlowEditor.vue`、`ToolsMenu.vue` — 弹窗统一
- `src/components/ScenarioTabs.vue` — 视觉

## 全局配色/类名映射表（所有视觉任务共用）

执行任何视觉任务时，按此表替换 UnoCSS 类名。**语义色（brand/positive/negative/warning/success/danger/neutral 既有）保留不动**，只替换下面这些「表面/线条/文字」类。

| 旧 class | 新 class | 含义 |
|---|---|---|
| 应用根 `bg-white` | `bg-canvas` | 冷调浅灰底 |
| 面板/表格 `bg-white` | `bg-surface` | 白色面板 |
| 表头/参数行 `bg-neutral-50` | `bg-surface-2` | 次级表面 |
| 边框 `border-neutral-300`、`border-neutral-400` | `border-line` | 主分隔线 |
| 行分隔 `border-neutral-200`、淡边框 | `border-line-soft` | 次级分隔 |
| 弱文字 `text-neutral-400`、`text-neutral-500` | `text-ink-3` | 表头/占位 |
| 次文字 `text-neutral-600`、`text-neutral-700` | `text-ink-2` | 列名/说明 |
| 主文字 `text-neutral-900` | `text-ink` | 主文字 |
| hover `hover:bg-neutral-50`、`hover:bg-neutral-100` | `hover:bg-surface-2` | hover 态 |

> 替换原则：逐个文件用编辑器全局搜索替换上表中的类名；**不要替换语义色**（`text-positive-*` / `text-negative-*` / `text-brand-*` / `text-warning-*` / `text-danger-*` 等保持原样）。替换后人工扫一遍该文件确认无遗漏/无误伤。

**新增统一类用法：**
- 等宽数字列/标签：加 `font-mono tabular-nums`
- 区块标题：`font-mono text-[10.5px] tracking-[0.18em] uppercase text-ink-2`
- 视图切换 pill 选中：`bg-brand-50 text-brand-700 font-semibold`；未选：`text-ink-3 hover:bg-surface-2`
- 弹窗外壳：`bg-surface rounded-xl shadow-[0_18px_50px_-20px_rgba(26,34,51,0.25)] border border-line`

---

## Task 1: 设计基底（UnoCSS token + 全局样式 + 字体）

**Files:**
- Modify: `uno.config.ts`
- Create: `src/styles/theme.css`
- Modify: `src/main.ts`

- [ ] **Step 1: 扩展 `uno.config.ts` 的 theme**

在现有 `theme.colors` 对象内**新增**以下键（与既有 brand/positive/... 并列，值不变）：

```ts
canvas: { DEFAULT: '#f3f5fa' },
surface: { DEFAULT: '#ffffff', 2: '#f8fafc' },
line: { DEFAULT: '#e4e8f1', soft: '#eef1f7' },
ink: { DEFAULT: '#1a2233', 2: '#5b6678', 3: '#8a93a6' },
```

在 `theme` 内**新增** `fontFamily`（与 `colors` 并列）：

```ts
fontFamily: {
  mono: ['JetBrains Mono', 'Cascadia Code', 'Consolas', 'ui-monospace', 'monospace'],
  sans: ['PingFang SC', 'Microsoft YaHei', 'system-ui', 'sans-serif'],
},
```

- [ ] **Step 2: 创建 `src/styles/theme.css`**

```css
/* 浅色金融终端 · 全局基底 */
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap');

:root {
  --font-mono: 'JetBrains Mono', 'Cascadia Code', 'Consolas', ui-monospace, monospace;
  --font-sans: 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif;
}

html, body, #app {
  height: 100%;
}

body {
  margin: 0;
  font-family: var(--font-sans);
  background: #f3f5fa;        /* canvas */
  color: #1a2233;             /* ink */
  -webkit-font-smoothing: antialiased;
}

/* 终端式等宽数字工具类（配合 UnoSS font-mono / tabular-nums） */
.num {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

/* 细滚动条，配合浅色终端 */
* {
  scrollbar-width: thin;
  scrollbar-color: #cbd5e1 transparent;
}
*::-webkit-scrollbar { width: 8px; height: 8px; }
*::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
*::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
*::-webkit-scrollbar-track { background: transparent; }
```

- [ ] **Step 3: 在 `src/main.ts` 引入 theme.css**

在 `main.ts` 顶部、引入 UnoCSS 之后加一行：

```ts
import './styles/theme.css'
```

- [ ] **Step 4: 验证构建与测试不破**

Run: `npm run test`
Expected: 全部 PASS（未改逻辑）

Run: `npm run build`
Expected: 构建成功，无 TS 错误

- [ ] **Step 5: 手动确认基底生效**

Run: `npm run dev`，打开页面。
Expected: 应用底色从纯白变为冷调浅灰（`#f3f5fa`），字体微变（中文系统黑体）；表格内容、功能全部正常。

- [ ] **Step 6: Commit**

```bash
git add uno.config.ts src/styles/theme.css src/main.ts
git commit -m "feat(ui): 建立浅色金融终端设计基底——token/字体/全局样式"
```

---

## Task 2: 关键指标聚合纯函数（TDD）

**Files:**
- Create: `src/utils/keyMetrics.ts`
- Test: `tests/utils/keyMetrics.test.ts`

- [ ] **Step 1: 写失败测试 `tests/utils/keyMetrics.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { computeKeyMetrics } from '../../src/utils/keyMetrics'
import type { MonthResult } from '../../src/types'

// 构造最小 MonthResult（只填聚合用到的字段，其余置 0/false）
function mk(month: number, over: Partial<MonthResult> = {}): MonthResult {
  return {
    month,
    columnValues: [], totalFlow: 0, investReturn: 0,
    monthlyIncome: 0, monthlyExpense: 0, monthlyBalance: 0, cumSavings: 0,
    isAnchor: false, fundBalance: 0, fundInterest: 0, fundContribution: 0,
    fundOffset: 0, fundOffsetShortfall: 0, fundWithdrawal: 0, fundOutflow: 0,
    isFundAnchor: false, totalAssets: 0,
    ...over,
  }
}

describe('computeKeyMetrics', () => {
  it('最终累计 = 末月 cumSavings', () => {
    const r = [mk(202601, { cumSavings: 100 }), mk(202602, { cumSavings: 250 })]
    expect(computeKeyMetrics(r, false).finalCum).toBe(250)
  })

  it('期间最低余额取最小 cumSavings 及其月份', () => {
    const r = [
      mk(202601, { cumSavings: 500 }),
      mk(202604, { cumSavings: 300 }),
      mk(202606, { cumSavings: 400 }),
    ]
    const m = computeKeyMetrics(r, false)
    expect(m.minCum).toBe(300)
    expect(m.minMonth).toBe(202604)
  })

  it('累计理财收益 = investReturn 求和', () => {
    const r = [mk(202601, { investReturn: 100 }), mk(202602, { investReturn: 50.5 })]
    expect(computeKeyMetrics(r, false).totalReturn).toBe(150.5)
  })

  it('累计总支出 = monthlyExpense 求和（正值金额）', () => {
    const r = [mk(202601, { monthlyExpense: 14000 }), mk(202602, { monthlyExpense: 14500 })]
    expect(computeKeyMetrics(r, false).totalExpense).toBe(28500)
  })

  it('空结果返回 0 且不抛错', () => {
    const m = computeKeyMetrics([], false)
    expect(m.finalCum).toBe(0)
    expect(m.minMonth).toBe(0)
  })

  it('fundEnabled 时返回末月公积金余额，否则为 null', () => {
    const r = [mk(202601, { fundBalance: 1000 }), mk(202602, { fundBalance: 2000 })]
    expect(computeKeyMetrics(r, true).fundBalance).toBe(2000)
    expect(computeKeyMetrics(r, false).fundBalance).toBeNull()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test -- tests/utils/keyMetrics.test.ts`
Expected: FAIL（`computeKeyMetrics` 未定义 / 模块找不到）

- [ ] **Step 3: 实现 `src/utils/keyMetrics.ts`**

```ts
import type { MonthResult } from '../types'

export interface KeyMetrics {
  finalCum: number       // 最终累计存款（末月 cumSavings）
  minCum: number         // 期间最低累计存款
  minMonth: number       // 最低点所在月（YYYYMM；空结果为 0）
  totalReturn: number    // 累计理财收益
  totalExpense: number   // 累计总支出（正数金额）
  fundBalance: number | null  // 末月公积金余额；未启用公积金为 null
}

/** 由月度计算结果聚合首屏关键指标。纯函数，不含展示逻辑。 */
export function computeKeyMetrics(results: MonthResult[], fundEnabled: boolean): KeyMetrics {
  if (results.length === 0) {
    return { finalCum: 0, minCum: 0, minMonth: 0, totalReturn: 0, totalExpense: 0, fundBalance: null }
  }
  let minCum = results[0].cumSavings
  let minMonth = results[0].month
  let totalReturn = 0
  let totalExpense = 0
  for (const r of results) {
    if (r.cumSavings < minCum) {
      minCum = r.cumSavings
      minMonth = r.month
    }
    totalReturn += r.investReturn
    totalExpense += r.monthlyExpense
  }
  const last = results[results.length - 1]
  return {
    finalCum: last.cumSavings,
    minCum,
    minMonth,
    totalReturn,
    totalExpense,
    fundBalance: fundEnabled ? last.fundBalance : null,
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run test -- tests/utils/keyMetrics.test.ts`
Expected: 6 个用例全部 PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/keyMetrics.ts tests/utils/keyMetrics.test.ts
git commit -m "feat(ui): 关键指标聚合纯函数 computeKeyMetrics + 单测"
```

---

## Task 3: 关键指标条组件 + App 主框架

**Files:**
- Create: `src/components/KeyMetricsBar.vue`
- Modify: `src/App.vue`

- [ ] **Step 1: 创建 `src/components/KeyMetricsBar.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import type { MonthResult } from '../types'
import { computeKeyMetrics } from '../utils/keyMetrics'
import { formatCurrency } from '../utils/format'
import { monthToLabel } from '../utils/month'

const props = defineProps<{
  results: MonthResult[]
  fundEnabled: boolean
  initialDeposit: number
}>()

const m = computed(() => computeKeyMetrics(props.results, props.fundEnabled))

// 期间最低是否低于初始存款（告警色判定）
const minIsWarn = computed(() => m.value.minCum < props.initialDeposit)

interface Cell { label: string; value: string; sub?: string; tone: '' | 'pos' | 'neg' | 'warn' }
const cells = computed<Cell[]>(() => {
  const base: Cell[] = [
    {
      label: '最终累计',
      value: formatCurrency(m.value.finalCum),
      sub: props.initialDeposit > 0
        ? `较初始 ${((m.value.finalCum - props.initialDeposit) / props.initialDeposit * 100).toFixed(1)}%`
        : undefined,
    },
    {
      label: '期间最低余额',
      value: formatCurrency(m.value.minCum),
      sub: m.value.minMonth ? monthToLabel(m.value.minMonth) : undefined,
      tone: minIsWarn.value ? 'warn' : '',
    },
    { label: '累计理财收益', value: formatCurrency(m.value.totalReturn), tone: 'pos' },
    { label: '累计总支出', value: formatCurrency(m.value.totalExpense), tone: 'neg' },
  ]
  if (m.value.fundBalance !== null) {
    base.push({ label: '公积金期末余额', value: formatCurrency(m.value.fundBalance), tone: 'warn' })
  }
  return base
})
</script>

<template>
  <div class="grid border-b border-line bg-surface"
       :style="{ gridTemplateColumns: `repeat(${cells.length}, 1fr)` }">
    <div v-for="(c, i) in cells" :key="c.label"
         class="px-4 py-3"
         :class="i < cells.length - 1 ? 'border-r border-line-soft' : ''">
      <div class="font-mono text-[9.5px] tracking-[0.16em] uppercase text-ink-3 flex items-center gap-1.5">
        <span class="inline-block w-1.5 h-1.5 rounded-full"
              :class="{
                'bg-brand': c.tone === '',
                'bg-positive-600': c.tone === 'pos',
                'bg-negative-600': c.tone === 'neg',
                'bg-warning-600': c.tone === 'warn',
              }" />
        {{ c.label }}
      </div>
      <div class="font-mono text-[22px] font-bold mt-1 tabular-nums"
           :class="{
             'text-ink': c.tone === '',
             'text-positive-600': c.tone === 'pos',
             'text-negative-600': c.tone === 'neg',
             'text-warning-600': c.tone === 'warn',
           }">
        <span class="text-ink-3 text-[13px] font-medium mr-0.5">¥</span>{{ c.value }}
      </div>
      <div v-if="c.sub" class="font-mono text-[10px] text-ink-3 mt-0.5">{{ c.sub }}</div>
    </div>
  </div>
</template>
```

> **注意：** 上面用到了 `monthToLabel`。先在 `src/utils/month.ts` 确认是否已有把 `YYYYMM` 转成「YYYY·MM」的函数；若有则用其真实导出名替换 `monthToLabel`；若没有，在 `month.ts` 新增：
> ```ts
> /** YYYYMM → 'YYYY·MM'，用于关键指标副标题展示 */
> export function monthToLabel(month: number): string {
>   const y = Math.floor(month / 100)
>   const m = month % 100
>   return `${y}·${String(m).padStart(2, '0')}`
> }
> ```
> （执行此步前先 `Read src/utils/month.ts` 确认现有导出，避免重复定义。）

- [ ] **Step 2: 在 `App.vue` 接入指标条 + 重写主框架样式**

修改 `App.vue` 的 `<script setup>`：
- 新增 `import KeyMetricsBar from './components/KeyMetricsBar.vue'`
- 新增计算：
```ts
const fundEnabled = computed(() => !!data.value.fund)   // 已存在则复用，勿重复声明
const keyMetricsProps = computed(() => ({
  results: results.value,
  fundEnabled: fundEnabled.value,
  initialDeposit: data.value.systemParams.initialDeposit ?? 0,
}))
```
> ⚠️ `fundEnabled` 在现有 App.vue 已声明（第 109 行）。**不要重复声明**，只新增 `keyMetricsProps`。

修改 `App.vue` 的 `<template>`：
- 根 `<div>` 的 `bg-white` → `bg-canvas`，`text-neutral-900` → `text-ink`
- 顶部 `<header>` 内第一行导航按钮：把所有 `bg-brand-50 border-brand-200` 选中态保持，未选 `hover:bg-neutral-50` → `hover:bg-surface-2`；按钮加 `font-mono`
- 第二行参数行：`bg-neutral-50` → `bg-surface-2`；`text-neutral-400` → `text-ink-3`；各类 `text-neutral-*` 按映射表替换；标签加 `font-mono`
- 在参数行 `</div>` 之后、`</header>` 之前（仅 `activeView !== 'calculator'` 时）插入指标条：
```html
<KeyMetricsBar
  v-if="activeView !== 'calculator' && activeView !== 'comparison'"
  :results="keyMetricsProps.results"
  :fund-enabled="keyMetricsProps.fundEnabled"
  :initial-deposit="keyMetricsProps.initialDeposit"
/>
```
- 表格视图区（`v-else` 分支）用编号区块标题包裹，年度表加可收起开关：
```html
<template v-else>
  <div class="flex-none max-h-[35%] overflow-auto border-b border-line">
    <div class="font-mono text-[10.5px] tracking-[0.18em] uppercase text-ink-2 px-4 py-1.5 flex items-center gap-2 bg-surface">
      <span class="text-brand-600 font-bold">01</span> 年度汇总
    </div>
    <AnnualTable :results="results" />
  </div>
  <div class="flex-1 overflow-auto">
    <div class="font-mono text-[10.5px] tracking-[0.18em] uppercase text-ink-2 px-4 py-1.5 flex items-center gap-2 bg-surface sticky top-0 z-1">
      <span class="text-brand-600 font-bold">02</span> 月度流水
    </div>
    <MonthlyTable :results="results" />
  </div>
</template>
```
> 「年度表可收起」作为可选增强：若要实现，加一个 `const annualCollapsed = ref(false)` + localStorage 持久化，标题右侧加 `▾/▸` 按钮切换 `max-h-[35%]` 与 `max-h-0 overflow-hidden`。首版可不做折叠，仅保留编号标题。

- [ ] **Step 3: 验证**

Run: `npm run test` → Expected: 全 PASS
Run: `npm run build` → Expected: 构建成功

Run: `npm run dev`，打开页面。
Expected: 参数行下方出现 4–5 格关键指标条（朱砂/竹青/琥珀数字），数字与表格末行累计一致；导航/参数行配色切到冷调浅灰。

- [ ] **Step 4: Commit**

```bash
git add src/components/KeyMetricsBar.vue src/App.vue src/utils/month.ts
git commit -m "feat(ui): 关键指标条 + App 主框架（导航/参数行/布局 B 编号分区）"
```

---

## Task 4: 月度表新视觉（含负数改色）

**Files:**
- Modify: `src/components/MonthlyTable.vue`

> ⚠️ 此文件 1100+ 行。执行前先 `Read` 全文，理解列结构。**只改 class 与第 644 行负数函数，不改任何逻辑/事件/data-testid。**

- [ ] **Step 1: 负数从斜体改为竹青色**

定位约第 644 行的负数 class 函数（`if (value < 0) return 'italic'`）。改为：

```ts
  if (value < 0) return 'text-negative-600'
```

（确认该函数返回值是拼进单元格 class 的；若有别处也用 `italic` 表达负数，一并改成 `text-negative-600`。）

- [ ] **Step 2: 按映射表替换表面/线条/文字类**

对整个文件应用「全局配色/类名映射表」：`bg-neutral-50`→`bg-surface-2`、`bg-white`→`bg-surface`、`border-neutral-300/400`→`border-line`、`text-neutral-400/500`→`text-ink-3`、`text-neutral-600/700`→`text-ink-2`、`hover:bg-neutral-50/100`→`hover:bg-surface-2`。**不替换语义色**（`text-positive/negative/brand/warning/danger-*`）。

- [ ] **Step 3: 表头终端化**

表头单元格加 `font-mono`，表头文字已是 `text-[11px]`/`tabular-nums`，保持。表头底色 `bg-surface-2`。年末行 `border-b-2 border-neutral-400` → `border-b-2 border-line`。公积金专区 `border-l-2 border-neutral-400` → `border-l-2 border-brand-300`（专区用品牌色分隔更醒目）。

- [ ] **Step 4: 验证**

Run: `npm run test` → Expected: 全 PASS（`data-testid` 未动）
Run: `npm run build` → Expected: 成功
Run: `npm run dev` → 打开页面，核对：负数显示为竹青色（非斜体）；表头/边框/文字层次符合冷调；手填单元格高亮、hover、列拖拽、右键菜单、公式浮窗均正常。

- [ ] **Step 5: Commit**

```bash
git add src/components/MonthlyTable.vue
git commit -m "style(ui): 月度表浅色终端化；负数改竹青色"
```

---

## Task 5: 年度表新视觉

**Files:**
- Modify: `src/components/AnnualTable.vue`

- [ ] **Step 1: 按映射表替换类名**

`Read` 全文，应用「全局配色/类名映射表」。年末存款行 `bg-neutral-50 font-bold` → `bg-surface-2 font-bold`；年度结余行保持 `font-semibold`。

- [ ] **Step 2: 数字列加等宽对齐**

数字单元格确认 `font-mono tabular-nums`（沿用现有 `tabular-nums`，补 `font-mono`）。

- [ ] **Step 3: 验证**

Run: `npm run test` → PASS；`npm run build` → 成功；`npm run dev` → 年度表与月度表视觉语言一致，hover 公式浮窗正常。

- [ ] **Step 4: Commit**

```bash
git add src/components/AnnualTable.vue
git commit -m "style(ui): 年度表浅色终端化"
```

---

## Task 6: 图表视图升级

**Files:**
- Modify: `src/components/FinanceChart.vue`
- Modify: `src/utils/financeChart.ts:57-59`（仅网格/轴中性色）

> 图表配色语义（朱砂/竹青/靛蓝/琥珀）已与表格同源，**不改语义色**。只升级外壳与中性色。

- [ ] **Step 1: `financeChart.ts` 中性色对齐新 token**

第 58-59 行：
```ts
const COLOR_AXIS = '#cbd5e1'   // 保持（slate-300，与 line 接近）
const COLOR_GRID = '#eef2f7'   // 保持（= line-soft）
```
> 若已一致则无需改动。确认 tooltip `backgroundColor:'#ffffff'`、`borderColor:'#e2e8f0'` 与新 `surface/line` 一致（白/#e4e8f1 接近，可把 borderColor 微调为 `#e4e8f1`）。

- [ ] **Step 2: `FinanceChart.vue` 外壳终端化**

`Read` 全文。标题区：左侧「财务趋势图」改 `font-mono`/或衬线感；当前存款 hero 数字用 `text-brand-600 font-mono font-bold`；右侧「按月/按年」分段按钮未选 `text-ink-3`、选中 `bg-brand-50 text-brand-700`。容器 `bg-white`→`bg-surface`，其余 `text-neutral-*` 按映射表替换。

- [ ] **Step 3: 验证**

Run: `npm run test` → PASS；`npm run build` → 成功；`npm run dev` → 切到图表视图，柱状图朱砂/竹青、存款靛蓝面积线、公积金琥珀副线显示正常，按月/按年切换、tooltip 正常。

- [ ] **Step 4: Commit**

```bash
git add src/components/FinanceChart.vue src/utils/financeChart.ts
git commit -m "style(ui): 图表视图外壳终端化"
```

---

## Task 7: 对比视图新视觉

**Files:**
- Modify: `src/components/ComparisonView.vue`

- [ ] **Step 1: 按映射表替换类名**

`Read` 全文。`bg-neutral-50`→`bg-surface-2`、`hover:bg-neutral-50`→`hover:bg-surface-2`、`text-neutral-*`→`text-ink-*`。表头 `bg-surface-2`，差额正负保持 `text-positive-600`/`text-negative-600`。方案勾选 pill 选中 `bg-brand-50 text-brand-700`。标题加 `font-mono`。

- [ ] **Step 2: 验证**

Run: `npm run test` → PASS；`npm run build` → 成功；`npm run dev` → 对比视图勾选 ≥2 方案显示对比表，差额朱砂/竹青正常。

- [ ] **Step 3: Commit**

```bash
git add src/components/ComparisonView.vue
git commit -m "style(ui): 对比视图浅色终端化"
```

---

## Task 8: 计算器视图新视觉

**Files:**
- Modify: `src/components/CalculatorView.vue`

- [ ] **Step 1: 按映射表替换类名**

`Read` 全文。两栏 section 标题 `font-mono`；`bg-brand-50` 合计行保持；输入框/表格按映射表替换 `bg-white`→`bg-surface`、`text-neutral-*`→`text-ink-*`；数字 `font-mono tabular-nums`。

- [ ] **Step 2: 验证**

Run: `npm run test` → PASS；`npm run build` → 成功；`npm run dev` → 计算器输入即时计算，合计行高亮正常。

- [ ] **Step 3: Commit**

```bash
git add src/components/CalculatorView.vue
git commit -m "style(ui): 计算器视图浅色终端化"
```

---

## Task 9: 弹窗与浮层统一

**Files:**
- Modify: `src/components/FormulaPopover.vue`、`EventEditor.vue`、`EventDetailPopover.vue`、`ContextMenu.vue`、`MonthPicker.vue`、`FundFlowEditor.vue`、`ToolsMenu.vue`

> 7 个浮层共享同一外壳规范。逐个 `Read` → 应用统一外壳 + 映射表。**不改触发逻辑、定位逻辑、数据流。**

- [ ] **Step 1: 统一弹窗外壳规范**

每个浮层根容器（通常是 `fixed` 定位的最外层 `div`）改为：
```html
class="... bg-surface rounded-xl border border-line shadow-[0_18px_50px_-20px_rgba(26,34,51,0.25)]"
```
- 顶部标题（若有）加 `font-mono text-[10.5px] tracking-[0.16em] uppercase text-ink-2`
- 内部 `bg-white`→`bg-surface`、`text-neutral-*`→`text-ink-*`、`hover:bg-neutral-100`→`hover:bg-surface-2`
- 分隔线 `border-neutral-200`→`border-line-soft`
- 截断/告警保持 `text-warning-600`；删除保持 `text-danger-600`
- 输入框：`bg-surface border border-line rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/30`

- [ ] **Step 2: 逐个文件应用**

按 Step 1 规范处理 7 个文件。每个文件改完单独确认无逻辑改动（diff 只含 class/结构）。

- [ ] **Step 3: 验证（逐个浮层）**

Run: `npm run test` → PASS；`npm run build` → 成功
Run: `npm run dev`，逐项触发并核对外观一致：
- 公式浮窗：hover 月度表计算列
- 事件编辑/明细：点月度表「专项」单元格
- 右键菜单：右键月度表行
- 月份选择器：点起始/结束月份
- 公积金流水编辑器：点公积金专区单元格
- 工具菜单：点右上「更多」

Expected: 7 个浮层均为白底圆角带阴影、mono 标题、统一内边距；功能正常。

- [ ] **Step 4: Commit**

```bash
git add src/components/FormulaPopover.vue src/components/EventEditor.vue src/components/EventDetailPopover.vue src/components/ContextMenu.vue src/components/MonthPicker.vue src/components/FundFlowEditor.vue src/components/ToolsMenu.vue
git commit -m "style(ui): 7 个弹窗/浮层统一外壳规范"
```

---

## Task 10: 图标系统 + 方案标签

**Files:**
- Modify: `src/App.vue`（顶部撤销/重做/更多 emoji 替换）
- Modify: `src/components/ScenarioTabs.vue`
- Modify: 各组件内的 emoji 图标（📥🔄🧮👁 ↻ 等）

> 原则：用统一 1.5px 线宽的内联 SVG 替换功能性 emoji；装饰性 mono 符号（↶ ↷ ▾ ＋ × ⋯ ↻）保留。

- [ ] **Step 1: 建 2-3 个内联 SVG 图标**

在 `src/components/` 下不需要单独文件——直接在用到处内联 SVG。优先替换：顶部「更多 ⋯」可保留 mono `⋯`；撤销 `↶`/重做 `↷` 保留 mono 符号即可（已是统一风格）。**重点替换**：`📥`（导入/导出）、`🔄`（重置）、`🧮`（计算器）、`👁`（显隐）这类彩色 emoji，换成单色 SVG。

例（导入图标，替换 ToolsMenu 里的 📥）：
```html
<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
     stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
     class="inline-block align-middle">
  <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>
</svg>
```
> 执行时：搜索全项目 emoji（`grep -rP "[\x{1F300}-\x{1FAFF}]|[\x{2600}-\x{27BF}]" src`），逐个替换为同风格 SVG。计算器 `🧮`、重置 `🔄`、导入导出 `📥`、眼睛 `👁` 是重点。`↻`（年化分摊标记）保留。

- [ ] **Step 2: `ScenarioTabs.vue` 终端化**

`Read` 全文。pill 选中 `bg-brand-50 border-brand-200 text-brand-700`；未选 `hover:bg-surface-2`；`text-sm`→可加 `font-mono`；删除 ✕ hover 显隐保留（`opacity-0 group-hover:opacity-100 text-danger-600`）。

- [ ] **Step 3: 验证**

Run: `npm run test` → PASS；`npm run build` → 成功；`npm run dev` → 顶部/工具菜单/方案标签无彩色 emoji，统一单色线条图标；方案切换/重命名/删除正常。

- [ ] **Step 4: Commit**

```bash
git add -A src/components src/App.vue
git commit -m "style(ui): 图标系统统一（emoji→单色 SVG）；方案标签终端化"
```

---

## Task 11: 收尾——跨视图一致性巡查 + 真实数据验证

**Files:** （视巡查结果修补）

- [ ] **Step 1: 全量测试与构建**

Run: `npm run test` → Expected: 全 PASS
Run: `npm run build` → Expected: 成功，无 TS 错误，无 console 报错

- [ ] **Step 2: 用真实数据导入验证**

Run: `npm run dev`，在应用内用「更多 → 导入数据」导入：
`C:\Users\10204\Desktop\family-finance-plan-20260618.json`

按以下清单逐项核对：
- [ ] 2 个方案（买房/不买房）切换正常
- [ ] 关键指标条 4–5 格数字显示，且「最终累计」= 月度表末行累计
- [ ] 月度表：月薪/月薪2/奖金/房租/日常/旅行/育儿/红包 列显示；年度重复项（奖金/旅行）有 `↻` 标记
- [ ] 月度表负数（支出）为竹青色，非斜体
- [ ] 公积金专区：房贷月供/缴存/月冲/存款补扣/公积金余额 列显示；买房方案 202706 有提取
- [ ] 大额事件：结婚(202610)/买房(202706)/装修(202707)/家具(202710) 在专项列显示
- [ ] 年度表 2026–2031 各年汇总显示
- [ ] 图表视图：柱状图朱砂/竹青、存款靛蓝面积线、买房方案有公积金琥珀副线；按月/按年切换
- [ ] 对比视图：勾选两方案显示对比表，差额朱砂/竹青
- [ ] 计算器视图：房贷/公积金两栏实时计算
- [ ] 单元格编辑、上下键移动、列拖拽重排、右键菜单、公式浮窗、撤销重做(Ctrl+Z/Y)、月份选择器 全部可用

- [ ] **Step 3: 跨视图一致性巡查**

切遍 4 个视图 + 触发 7 个浮窗，确认：配色一致（冷调浅灰底/白面板/朱砂竹青靛蓝琥珀）、字体一致（数字等宽）、圆角阴影一致、按钮层级一致（主/次/危险）。发现不一致处修补。

- [ ] **Step 4: 首屏焦点确认**

确认首屏（表格视图）有明确视觉焦点（关键指标条），不再是「白底无焦点」。

- [ ] **Step 5: 最终 Commit**

```bash
git add -A
git commit -m "style(ui): 收尾——跨视图一致性巡查与修补"
```

---

## Self-Review（计划作者已自查）

**1. Spec 覆盖：**
- 设计 token（spec §3）→ Task 1 ✓
- 关键指标条（§5）→ Task 2 + 3 ✓
- 布局 B（§4）→ Task 3 ✓
- 表格视图 + 负数改色（§6.1）→ Task 4 + 5 ✓
- 图表（§6.2）→ Task 6 ✓
- 对比（§6.3）→ Task 7 ✓
- 计算器（§6.4）→ Task 8 ✓
- 弹窗统一（§7）→ Task 9 ✓
- 组件规范·按钮/图标（§8）→ Task 10（图标）+ 各任务（按钮分级散布在视图改造中）✓
- 改造边界（§9 不动逻辑）→ 所有任务明确「只改 class/结构」✓
- 实施策略（§10 阶段化 + 并行）→ 任务依赖见下 ✓
- 验收（§11）→ Task 11 ✓

**2. 占位符扫描：** 无 TBD/TODO；样式步骤用「映射表 + 文件路径 + 验证」给出 how；新增代码（keyMetrics/KeyMetricsBar/theme.css/uno.config）完整。

**3. 类型一致：** `computeKeyMetrics(results, fundEnabled)` 签名在 Task 2 定义、Task 3 消费，一致；`KeyMetrics` 字段名（finalCum/minCum/minMonth/totalReturn/totalExpense/fundBalance）两处一致。

**任务依赖与并行：**
- Task 1（基底）必须最先完成 ✓
- Task 2（纯函数）可与 Task 1 并行，但 Task 3 依赖两者 ✓
- Task 4–10 在 Task 1 完成后可并行（各自独立文件，无冲突）；Task 3（App 框架）建议先于 4–8，但非硬依赖 ✓
- Task 11（收尾）依赖全部完成 ✓
