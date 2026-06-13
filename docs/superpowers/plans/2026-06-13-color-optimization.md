# 配色优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将应用配色从 Tailwind 默认 `green/red/blue-600` + 散落硬编码，收敛为一套「清爽专业·靛蓝·中式红绿」语义色板（4 角色别名），并统一图表与表格的语义色来源。

**Architecture:** 在 `uno.config.ts` 的 `theme.colors` 增加语义别名（`brand/positive/negative/success/danger/neutral`），值引用 indigo/red/green/slate 标准色阶；各组件把直写 class 换成语义别名；图表十六进制与 scoped 样式改用与别名同源的色值；中式语义（红正绿负）贯彻到差额/图表。纯视觉改动，不动结构/逻辑。

**Tech Stack:** Vue 3 + TypeScript、UnoCSS (presetUno)、ECharts、Vitest。

**测试策略（重要）：** 本任务无可测的业务逻辑变化（`getValueClass` 只做负数斜体、不着色；金额单元格不上色）。验证手段 = `npm run build` 通过 + 更新后的现有测试全绿 + dev server 视觉走查。**不新增颜色单测**（对 class/色值写断言脆弱且无价值）。现有测试已对部分 class 断言（`bg-blue-100`/`bg-gray-50`/`text-green-600` 等），收敛后须同步更新这些断言。

---

## File Structure

| 文件 | 责任 | 改动类型 |
|---|---|---|
| `uno.config.ts` | 语义色别名定义（token 层） | 改 |
| `src/App.vue` | 顶层底色/文字、头部按钮 hover/激活 | 改 |
| `src/components/MonthlyTable.vue` | `getDiffClass` 中式反转、class 收敛、scoped hover/拖拽线 | 改 |
| `src/components/AnnualTable.vue` | class 收敛、scoped hover | 改 |
| `src/components/ComparisonView.vue` | diff 中式反转、class 收敛 | 改 |
| `src/utils/financeChart.ts` | `COLOR_*` 反转 + 轴/网格中性色 | 改 |
| `src/components/FinanceChart.vue` | 粒度切换激活态收敛 | 改 |
| `src/components/ScenarioTabs.vue` | 激活/链接/删除 class 收敛 | 改 |
| `src/components/MonthPicker.vue` | 当前月/ hover 收敛 | 改 |
| `src/components/ToolsMenu.vue` | hover 收敛、success/danger 保留 | 改 |
| `src/components/ContextMenu.vue` | hover/disabled 收敛 | 改 |
| `src/components/EventEditor.vue` | 链接/删除/空态收敛 | 改 |
| `src/components/EventDetailPopover.vue` | 次要文字收敛 | 改 |
| `src/components/FormulaPopover.vue` | 次要文字收敛 | 改 |
| `tests/components/*.spec.ts` | 同步更新 class 断言 | 改 |

---

## Task 1: 建立语义色别名（token 层）

**Files:**
- Modify: `uno.config.ts`

- [ ] **Step 1: 替换 `uno.config.ts` 全文为语义别名定义**

```ts
import { defineConfig, presetUno } from 'unocss'

// 语义色阶：值取自 Tailwind 默认调色板（与 presetUno 内置一致），便于核对
const indigo = {
  50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc',
  400: '#818cf8', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca',
  800: '#3730a3', 900: '#312e81',
}
const red = {
  50: '#fef2f2', 100: '#fee2e2', 200: '#fecaca', 300: '#fca5a5',
  400: '#f87171', 500: '#ef4444', 600: '#dc2626', 700: '#b91c1c',
  800: '#991b1b', 900: '#7f1d1d',
}
const green = {
  50: '#f0fdf4', 100: '#dcfce7', 200: '#bbf7d0', 300: '#86efac',
  400: '#4ade80', 500: '#22c55e', 600: '#16a34a', 700: '#15803d',
  800: '#166534', 900: '#14532d',
}
const slate = {
  50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1',
  400: '#94a3b8', 500: '#64748b', 600: '#475569', 700: '#334155',
  800: '#1e293b', 900: '#0f172a',
}

export default defineConfig({
  presets: [presetUno()],
  theme: {
    colors: {
      brand: indigo,      // 主色·交互：链接 / 激活 / 累计折线 / 锚点 / 拖拽线
      positive: red,      // 中式正向：收入 / 差额增长 / 图表收入
      negative: green,    // 中式负向：支出 / 差额下降 / 图表支出
      success: green,     // 操作成功（固定，不随中西式变）
      danger: red,        // 操作失败 / 删除（固定）
      neutral: slate,     // 中性：底 / 文字 / 边框 / 表头 / hover
    },
  },
})
```

> 切换中西式只需交换 `positive`/`negative` 的映射对象（`positive: green, negative: red`）。

- [ ] **Step 2: 验证别名可被解析（构建通过）**

Run: `npm run build`
Expected: 构建成功，无 UnoCSS 报错。

- [ ] **Step 3: Commit**

```bash
git add uno.config.ts
git commit -m "feat: uno.config 新增 brand/positive/negative/success/danger/neutral 语义色别名"
```

---

## Task 2: 全局底色 + App.vue 头部按钮收敛

**Files:**
- Modify: `src/App.vue`

- [ ] **Step 1: 顶层容器加白底 + 深色文字**

old: `<div class="h-screen flex flex-col px-8">`
new: `<div class="h-screen flex flex-col px-8 bg-white text-neutral-900">`

- [ ] **Step 2: 撤销/重做按钮 hover**

old (两处，撤销 `:102`、重做 `:113`): `:class="canUndo ? 'hover:bg-gray-50' : ''"` / `:class="canRedo ? 'hover:bg-gray-50' : ''"`
new: `'hover:bg-neutral-50'` / `'hover:bg-neutral-50'`

- [ ] **Step 3: 图表/对比按钮激活态与 hover**

old (图表 `:123`): `activeView === 'chart' ? 'bg-blue-100 border-blue-300' : 'hover:bg-gray-50'`
new: `activeView === 'chart' ? 'bg-brand-50 border-brand-200' : 'hover:bg-neutral-50'`

old (对比 `:131`): `activeView === 'comparison' ? 'bg-blue-100 border-blue-300' : 'hover:bg-gray-50'`
new: `activeView === 'comparison' ? 'bg-brand-50 border-brand-200' : 'hover:bg-neutral-50'`

- [ ] **Step 4: 验证**

Run: `npm run build && npx vitest run tests/App.spec.ts`
Expected: 构建成功；App.spec 全绿（该测试不校验颜色）。

- [ ] **Step 5: Commit**

```bash
git add src/App.vue
git commit -m "style: App 全局加白底/深色文字，头部按钮配色收敛为语义别名"
```

---

## Task 3: MonthlyTable 中式反转 + class 收敛

**Files:**
- Modify: `src/components/MonthlyTable.vue`
- Modify: `tests/components/MonthlyTable.spec.ts`

- [ ] **Step 1: `getDiffClass` 中式反转（红正绿负）**

old (`:96-101`):
```ts
function getDiffClass(diff: number | null): string {
  if (diff === null) return ''
  if (diff > 0) return 'text-green-600'
  if (diff < 0) return 'text-red-600'
  return 'text-gray-500'
}
```
new:
```ts
function getDiffClass(diff: number | null): string {
  if (diff === null) return ''
  if (diff > 0) return 'text-positive-600'   // 实际>预计：存得更多（中式正向=红）
  if (diff < 0) return 'text-negative-600'   // 实际<预计：存得更少（中式负向=绿）
  return 'text-neutral-500'
}
```

> `getValueClass`（`:440-443`，负数斜体）**不改**——金额单元格不上色。

- [ ] **Step 2: template 内 class 收敛（逐处 old → new）**

| 行 | old | new |
|---|---|---|
| `:449` | `bg-gray-50 text-[12px]` | `bg-neutral-50 text-[12px]` |
| `:450` | `text-gray-500` | `text-neutral-500` |
| `:474` | `text-blue-600 hover:text-blue-800` | `text-brand-600 hover:text-brand-700` |
| `:475` | `text-red-600 hover:text-red-800` | `text-danger-600 hover:text-danger-800` |
| `:490` | `bg-gray-50`（thead sticky） | `bg-neutral-50` |
| `:529` | `text-gray-400` … `hover:text-gray-700` | `text-neutral-400` … `hover:text-neutral-600` |
| `:536` | `line-through text-gray-400` | `line-through text-neutral-400` |
| `:545` | `text-red-600` … `hover:text-red-800` | `text-danger-600` … `hover:text-danger-800` |
| `:558` | `text-blue-600 hover:text-blue-800` | `text-brand-600 hover:text-brand-700` |
| `:570` | `border-l border-gray-300` | `border-l border-neutral-300` |
| `:585` | `border-b-2 border-gray-400` | `border-b-2 border-neutral-400` |
| `:596` | `'bg-blue-100'`（isEdited 标记） | `'bg-brand-50'` |
| `:623` | `text-blue-500`（年度重复标记 ↻） | `text-brand-500` |
| `:648` | `border-l border-gray-300` | `border-l border-neutral-300` |
| `:718` | `'bg-blue-100'`（isAnchor 锚点） | `'bg-brand-50'` |
| `:735` | `text-gray-600` | `text-neutral-600` |
| `:740` | `text-gray-300` | `text-neutral-300` |

- [ ] **Step 3: `<style scoped>` 替换为中性色**

old (`:810-829`):
```css
.drag-line-left { box-shadow: -2px 0 0 0 #3b82f6; }
.drag-line-right { box-shadow: 2px 0 0 0 #3b82f6; }
tbody tr:nth-child(even) { background-color: rgb(107 114 128 / 0.04); }
tbody tr:hover { background-color: #f0fdf4; }
tbody tr:hover td { background-color: #f0fdf4; }
```
new:
```css
/* 拖拽插入线：用 box-shadow 不占布局空间，避免列宽跳动；主色 indigo-600 */
.drag-line-left { box-shadow: -2px 0 0 0 #4f46e5; }
.drag-line-right { box-shadow: 2px 0 0 0 #4f46e5; }
/* 隔行斑马纹：偶数行极淡灰（slate-500 4%） */
tbody tr:nth-child(even) { background-color: rgb(100 116 139 / 0.04); }
/* 行 hover：整行变中性浅灰（slate-100），特异性高于斑马纹故能覆盖 */
tbody tr:hover { background-color: #f1f5f9; }
tbody tr:hover td { background-color: #f1f5f9; }
```

- [ ] **Step 4: 更新 `MonthlyTable.spec.ts` 的 class 断言**

| 行 | old | new |
|---|---|---|
| `:173` | `expect(cumCell.classes()).toContain('bg-blue-100')` | `toContain('bg-brand-50')` |
| `:178` | `expect(secondCumCell.classes()).not.toContain('bg-blue-100')` | `not.toContain('bg-brand-50')` |
| `:181` | `expect(rows[0].classes()).not.toContain('bg-blue-50')` | `not.toContain('bg-brand-50')` |
| `:182` | `expect(rows[1].classes()).not.toContain('bg-blue-50')` | `not.toContain('bg-brand-50')` |
| `:389` | `expect(thead.classes()).toContain('bg-gray-50')` | `toContain('bg-neutral-50')` |

- [ ] **Step 5: 验证**

Run: `npm run build && npx vitest run tests/components/MonthlyTable.spec.ts`
Expected: 构建成功；MonthlyTable.spec 全绿。

- [ ] **Step 6: Commit**

```bash
git add src/components/MonthlyTable.vue tests/components/MonthlyTable.spec.ts
git commit -m "style: MonthlyTable 中式红绿反转差额，配色收敛为语义别名"
```

---

## Task 4: AnnualTable class 收敛

**Files:**
- Modify: `src/components/AnnualTable.vue`
- Modify: `tests/components/AnnualTable.spec.ts`

- [ ] **Step 1: template class 收敛**

| 行 | old | new |
|---|---|---|
| `:116` | `bg-gray-50`（thead sticky） | `bg-neutral-50` |
| `:179` | `bg-gray-50`（年末汇总行） | `bg-neutral-50` |

- [ ] **Step 2: `<style scoped>` 替换为中性色**

old (`:196-207`):
```css
tbody tr:nth-child(even):not(:last-child) { background-color: rgb(107 114 128 / 0.04); }
tbody tr:hover { background-color: #f0fdf4; }
tbody tr:hover td { background-color: #f0fdf4; }
```
new:
```css
tbody tr:nth-child(even):not(:last-child) { background-color: rgb(100 116 139 / 0.04); }
tbody tr:hover { background-color: #f1f5f9; }
tbody tr:hover td { background-color: #f1f5f9; }
```

- [ ] **Step 3: 更新 `AnnualTable.spec.ts` 的 class 断言**

| 行 | old | new |
|---|---|---|
| `:126` | `toContain('bg-gray-50')`（年末存款行） | `toContain('bg-neutral-50')` |
| `:205` | `expect.arrayContaining(['sticky', 'top-0', 'bg-gray-50'])` | `expect.arrayContaining(['sticky', 'top-0', 'bg-neutral-50'])` |

- [ ] **Step 4: 验证**

Run: `npm run build && npx vitest run tests/components/AnnualTable.spec.ts`
Expected: 构建成功；AnnualTable.spec 全绿。

- [ ] **Step 5: Commit**

```bash
git add src/components/AnnualTable.vue tests/components/AnnualTable.spec.ts
git commit -m "style: AnnualTable 配色收敛为语义别名"
```

---

## Task 5: ComparisonView 中式反转 + 收敛

**Files:**
- Modify: `src/components/ComparisonView.vue`
- Modify: `tests/components/ComparisonView.spec.ts`

- [ ] **Step 1: diff 着色中式反转**

old (`:43`): `class: diff > 0 ? 'text-green-600' : 'text-red-600',`
new: `class: diff > 0 ? 'text-positive-600' : 'text-negative-600',`

- [ ] **Step 2: 其余 class 收敛**

| 行 | old | new |
|---|---|---|
| `:74` | `hover:bg-gray-50` | `hover:bg-neutral-50` |
| `:101` | `bg-gray-50`（指标 th） | `bg-neutral-50` |
| `:105` | `bg-gray-50`（方案 th） | `bg-neutral-50` |
| `:115` | `hover:bg-gray-50` | `hover:bg-neutral-50` |
| `:136` | `text-gray-500` | `text-neutral-500` |

- [ ] **Step 3: 更新 `ComparisonView.spec.ts` 的 class 断言**

old (`:122`): `const diffSpan = diffCell.find('span.text-green-600')`
new: `const diffSpan = diffCell.find('span.text-positive-600')`

> 该断言对应的差额为 +180000（正向），中式下为红=`positive-600`，语义正确。

- [ ] **Step 4: 验证**

Run: `npm run build && npx vitest run tests/components/ComparisonView.spec.ts`
Expected: 构建成功；ComparisonView.spec 全绿。

- [ ] **Step 5: Commit**

```bash
git add src/components/ComparisonView.vue tests/components/ComparisonView.spec.ts
git commit -m "style: ComparisonView 差额中式反转，配色收敛为语义别名"
```

---

## Task 6: 图表配色反转 + 中性轴

**Files:**
- Modify: `src/utils/financeChart.ts`
- Modify: `src/components/FinanceChart.vue`

- [ ] **Step 1: `COLOR_*` 中式反转 + 新增中性轴/网格常量**

old (`:33-36`):
```ts
// 配色：收入绿 / 支出红 / 累计储蓄蓝
const COLOR_INCOME = '#16a34a'
const COLOR_EXPENSE = '#dc2626'
const COLOR_CUM = '#2563eb'
```
new:
```ts
// 配色（中式：收入红 / 支出绿 / 累计储蓄靛蓝），与表格语义同源
const COLOR_INCOME = '#dc2626'
const COLOR_EXPENSE = '#15803d'
const COLOR_CUM = '#4f46e5'
// 中性轴/网格（slate-300 / slate-200），与表格中性一致
const COLOR_AXIS = '#cbd5e1'
const COLOR_GRID = '#e2e8f0'
```

- [ ] **Step 2: 扩展 `ChartOption` 类型，支持轴/网格样式**

old (`:24-31`):
```ts
export interface ChartOption {
  tooltip: { trigger: string }
  legend: { data: string[] }
  grid: { left: string; right: string; bottom: string; containLabel: boolean }
  xAxis: { type: string; data: string[] }
  yAxis: { type: string; alignTicks: boolean }[]
  series: ChartSeries[]
}
```
new:
```ts
export interface ChartOption {
  tooltip: { trigger: string }
  legend: { data: string[] }
  grid: { left: string; right: string; bottom: string; containLabel: boolean }
  xAxis: { type: string; data: string[]; axisLine?: { lineStyle: { color: string } } }
  yAxis: { type: string; alignTicks: boolean; splitLine?: { lineStyle: { color: string } } }[]
  series: ChartSeries[]
}
```

- [ ] **Step 3: `buildChartOption` 注入轴/网格色**

old (`:74-78`):
```ts
    xAxis: { type: 'category', data: data.categories },
    yAxis: [
      { type: 'value', alignTicks: true },
      { type: 'value', alignTicks: true },
    ],
```
new:
```ts
    xAxis: { type: 'category', data: data.categories, axisLine: { lineStyle: { color: COLOR_AXIS } } },
    yAxis: [
      { type: 'value', alignTicks: true, splitLine: { lineStyle: { color: COLOR_GRID } } },
      { type: 'value', alignTicks: true, splitLine: { lineStyle: { color: COLOR_GRID } } },
    ],
```

- [ ] **Step 4: FinanceChart.vue 粒度切换激活态收敛**

old (`:57`): `:class="granularity === 'month' ? 'bg-blue-100' : 'hover:bg-gray-50'"`
new: `:class="granularity === 'month' ? 'bg-brand-50' : 'hover:bg-neutral-50'"`

old (`:65`): `:class="granularity === 'year' ? 'bg-blue-100' : 'hover:bg-gray-50'"`
new: `:class="granularity === 'year' ? 'bg-brand-50' : 'hover:bg-neutral-50'"`

- [ ] **Step 5: 验证**

Run: `npm run build && npx vitest run tests/utils/financeChart.spec.ts tests/components/FinanceChart.spec.ts`
Expected: 构建成功；图表测试全绿。
> 若 `financeChart.spec.ts` 对 option 做了**严格 toEqual 匹配**（而非字段断言），新增的 `axisLine`/`splitLine` 可能让其失败——届时补上对应字段即可。grep 结果显示该测试未引用颜色，预期不受影响。

- [ ] **Step 6: Commit**

```bash
git add src/utils/financeChart.ts src/components/FinanceChart.vue
git commit -m "style: 图表配色中式反转，轴/网格改用 slate 中性色"
```

---

## Task 7: 其余组件 class 收敛

**Files:**
- Modify: `src/components/ScenarioTabs.vue`、`tests/components/ScenarioTabs.spec.ts`
- Modify: `src/components/MonthPicker.vue`、`tests/components/MonthPicker.spec.ts`
- Modify: `src/components/ToolsMenu.vue`
- Modify: `src/components/ContextMenu.vue`
- Modify: `src/components/EventEditor.vue`
- Modify: `src/components/EventDetailPopover.vue`
- Modify: `src/components/FormulaPopover.vue`、`tests/components/FormulaPopover.spec.ts`

- [ ] **Step 1: ScenarioTabs.vue**

| 行 | old | new |
|---|---|---|
| `:78` | `scenario.id === activeId ? 'bg-blue-100 border-blue-300' : 'hover:bg-gray-50'` | `… 'bg-brand-50 border-brand-200' : 'hover:bg-neutral-50'` |
| `:109` | `text-red-600 … hover:text-red-800` | `text-danger-600 … hover:text-danger-800` |
| `:121` | `text-blue-600 hover:text-blue-800` | `text-brand-600 hover:text-brand-700` |
| `:130` | `text-blue-600 hover:text-blue-800` | `text-brand-600 hover:text-brand-700` |

`ScenarioTabs.spec.ts:40`: `toContain('bg-blue-100')` → `toContain('bg-brand-50')`

- [ ] **Step 2: MonthPicker.vue**

| 行 | old | new |
|---|---|---|
| `:128` | `hover:bg-gray-100` | `hover:bg-neutral-100` |
| `:129` | `isCurrentMonth(m) ? 'bg-blue-100' : ''` | `isCurrentMonth(m) ? 'bg-brand-50' : ''` |

`MonthPicker.spec.ts:56`: `toContain('bg-blue-100')` → `toContain('bg-brand-50')`

- [ ] **Step 3: ToolsMenu.vue（success/error 保留为 success/danger 别名，语义不变）**

| 行 | old | new |
|---|---|---|
| `:81` | `hover:bg-gray-50` | `hover:bg-neutral-50` |
| `:93` | `hover:bg-gray-100` | `hover:bg-neutral-100` |
| `:100` | `hover:bg-gray-100` | `hover:bg-neutral-100` |
| `:108` | `hover:bg-gray-100` | `hover:bg-neutral-100` |
| `:118` | `importStatus.success ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'` | `importStatus.success ? 'bg-success-50 text-success-700 border-success-200' : 'bg-danger-50 text-danger-700 border-danger-200'` |

- [ ] **Step 4: ContextMenu.vue**

old (`:52`): `… hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:bg-transparent`
new: `… hover:bg-neutral-100 disabled:cursor-not-allowed disabled:text-neutral-400 disabled:hover:bg-transparent`

- [ ] **Step 5: EventEditor.vue**

| 行 | old | new |
|---|---|---|
| `:79` | `text-gray-400` | `text-neutral-400` |
| `:99` | `text-red-600 hover:text-red-800` | `text-danger-600 hover:text-danger-800` |
| `:107` | `text-blue-600 hover:text-blue-800` | `text-brand-600 hover:text-brand-700` |
| `:115` | `hover:bg-gray-50` | `hover:bg-neutral-50` |

- [ ] **Step 6: EventDetailPopover.vue**

old (`:27`): `text-gray-700`
new: `text-neutral-700`

- [ ] **Step 7: FormulaPopover.vue**

old (`:50`): `text-gray-700`
new: `text-neutral-700`

`FormulaPopover.spec.ts:28`: `wrapper.findAll('.text-gray-700')` → `wrapper.findAll('.text-neutral-700')`

- [ ] **Step 8: 验证**

Run: `npm run build && npx vitest run tests/components/ScenarioTabs.spec.ts tests/components/MonthPicker.spec.ts tests/components/FormulaPopover.spec.ts tests/components/ContextMenu.spec.ts tests/components/EventEditor.spec.ts tests/components/EventDetailPopover.spec.ts`
Expected: 构建成功；以上测试全绿。

- [ ] **Step 9: Commit**

```bash
git add src/components/ScenarioTabs.vue src/components/MonthPicker.vue src/components/ToolsMenu.vue src/components/ContextMenu.vue src/components/EventEditor.vue src/components/EventDetailPopover.vue src/components/FormulaPopover.vue tests/components/ScenarioTabs.spec.ts tests/components/MonthPicker.spec.ts tests/components/FormulaPopover.spec.ts
git commit -m "style: ScenarioTabs/MonthPicker/ToolsMenu 等组件配色收敛为语义别名"
```

---

## Task 8: 全局验收

**Files:** 无（仅校验）

- [ ] **Step 1: 确认无残留直写语义色 class**

Run:
```bash
grep -rEn "(bg|text|border|from|to|via|fill|stroke|ring|divide|outline)-(red|green|blue|gray)-[0-9]{2,3}" src
```
Expected: 无输出（所有语义色已收敛为 `brand/positive/negative/success/danger/neutral` 别名）。
> 注：scoped `<style>` 与 ECharts option 中的十六进制色值（如 `#4f46e5`、`#f1f5f9`、`#dc2626`）是允许的——它们与别名同源，CSS/option 无法用 UnoCSS class。

- [ ] **Step 2: 全量构建 + 测试**

Run: `npm run build && npm run test`
Expected: 构建成功；全部测试通过。
> 若 `npm run test` 是 watch 模式，改用 `npx vitest run`。

- [ ] **Step 3: 视觉走查（dev server）**

Run: `npm run dev`
人眼核对：
1. 收入（图表柱）=红、支出=绿、累计折线=靛蓝；
2. 快照对比差额：正=红、负=绿；
3. 激活态（图表/对比/方案 tab/月份/锚点/编辑标记）=靛蓝淡底；
4. 表头/分区=slate-50、行 hover=中性浅灰（非绿）；
5. 导入成功=绿、失败=红；
6. 整体靛蓝 + 冷灰，无刺眼饱和色。

- [ ] **Step 4: 收尾 commit（如有遗留改动）**

```bash
git add -A
git commit -m "chore: 配色优化收尾"
```
> 若前面各 Task 已提交干净，此步可跳过。

---

## Self-Review 结论

- **Spec coverage**：spec §3（4 角色）、§4（薄 token/图表/全局底/scoped）、§5（组件落点）、§8（验收）均由 Task 1–8 覆盖。
- **补充修订**：实现研究阶段发现两点 spec 未尽事宜，已在本计划体现——(a) `getValueClass` 不着色、金额单元格保持中性（Task 3 Step 1 备注）；(b) 测试确有 class 断言、须同步更新（Task 3–7 各含测试更新步骤）。spec §7 的"测试不校验颜色"需相应修正为"测试校验 class，已纳入更新"。
- **Placeholder scan**：无 TBD/TODO；所有改动均为具体 old→new。
- **Type consistency**：`ChartOption` 的 `axisLine`/`splitLine` 在类型扩展（Task 6 Step 2）与使用（Step 3）中一致；别名命名 `brand/positive/negative/success/danger/neutral` 全计划统一。
