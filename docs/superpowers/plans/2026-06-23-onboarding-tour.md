# 教程引导（Onboarding Tour）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为家庭财务规划应用加入聚光灯式教程引导——首次自动播放「快速入门」，顶部「教程」入口提供分主题菜单（公积金/多方案对比/储蓄目标核对/重看全部），基于 driver.js 实现。

**Architecture:** 新增 `useTour` composable（已看标记 + 播放控制）与 `tours.ts`（主题步骤数据），新增 `TourMenu` 组件（教程按钮 + 菜单）。在 App 挂载时检查本地「已看过」标记决定是否自动播放。给现有界面元素加 `data-tour` 锚点供 driver.js 定位。纯讲解式 Tour，不修改业务状态。

**Tech Stack:** Vue 3 (Composition API + `<script setup>`)、TypeScript、UnoCSS、driver.js（新增依赖）、Vitest + @vue/test-utils。

**设计依据：** `docs/superpowers/specs/2026-06-23-onboarding-tour-design.md`

---

## 文件结构

- Create: `src/data/tours.ts` —— 主题步骤数据（element 选择器 + 气泡文案）+ 菜单元数据
- Create: `src/composables/useTour.ts` —— 「已看过」标记读写 + `playTour(topic)` 播放控制
- Create: `src/components/TourMenu.vue` —— 顶部「教程」按钮 + 主题下拉菜单
- Create: `src/styles/tour.css` —— driver.js 气泡样式覆盖（贴合项目配色）
- Create: `tests/composables/useTour.spec.ts`
- Create: `tests/components/TourMenu.spec.ts`
- Modify: `package.json` —— 新增 `driver.js` 依赖
- Modify: `src/main.ts` —— 引入 driver.js CSS 与 tour.css
- Modify: `src/App.vue` —— 挂载 TourMenu、`onMounted` 自动播放、为参数行/视图按钮/表格容器加 `data-tour`
- Modify: `src/components/KeyMetricsBar.vue` —— 根元素加 `data-tour="metrics"`
- Modify: `src/components/MonthlyTable.vue` —— 「存款」列表头加 `data-tour="balance-col"`
- Modify: `src/components/ScenarioTabs.vue` —— 根元素加 `data-tour="scenario-tabs"`

**`data-tour` 锚点清单（全部主题步骤依赖这些）：**

| 锚点 id | 所在文件 | 指向 |
|---|---|---|
| `param-month` | App.vue | 参数行「起始月份」分组 |
| `param-rate` | App.vue | 参数行「年化收益率/初始存款」分组 |
| `fund-toggle` | App.vue | 公积金开关（已有 `data-testid="fund-enable-toggle"`） |
| `view-chart` | App.vue | 顶部「图表」视图按钮 |
| `view-compare` | App.vue | 顶部「对比」视图按钮 |
| `annual-table` | App.vue | 「01 年度汇总」容器 |
| `monthly-table` | App.vue | 「02 月度流水」容器 |
| `metrics` | KeyMetricsBar.vue | 关键指标条根元素 |
| `balance-col` | MonthlyTable.vue | 月度表「存款」列表头 |
| `scenario-tabs` | ScenarioTabs.vue | 方案标签根元素 |

---

## Task 1: 安装 driver.js 依赖

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 安装 driver.js**

Run:
```bash
npm install driver.js
```
Expected: `added N packages`，`package.json` 的 `dependencies` 出现 `"driver.js": "^1.x.x"`。

- [ ] **Step 2: 验证可导入**

Run:
```bash
node -e "import('driver.js').then(m => console.log(typeof m.driver))"
```
Expected: 输出 `function`。

- [ ] **Step 3: 提交**

```bash
git add package.json package-lock.json
git commit -m "chore: 新增 driver.js 教程引导依赖"
```

---

## Task 2: 主题步骤数据 `tours.ts`（TDD）

**Files:**
- Create: `src/data/tours.ts`
- Test: `tests/data/tours.spec.ts`

- [ ] **Step 1: 写失败测试——主题数据结构完整**

Create `tests/data/tours.spec.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { TOURS, TOUR_TOPICS, buildAllSteps, type TourTopic } from '../../src/data/tours'

const REQUIRED_TOPICS: TourTopic[] = ['quickstart', 'fund', 'compare', 'anchor']

describe('tours 数据', () => {
  it('四个主题均存在且每步含 element 与 popover', () => {
    for (const key of REQUIRED_TOPICS) {
      const def = TOURS[key]
      expect(def).toBeDefined()
      expect(def.label.length).toBeGreaterThan(0)
      expect(def.steps.length).toBeGreaterThan(0)
      for (const step of def.steps) {
        expect(typeof step.element).toBe('string')
        expect(step.element).toContain('[data-tour=')
        expect(step.popover).toBeDefined()
        expect((step.popover as any).title.length).toBeGreaterThan(0)
        expect((step.popover as any).description.length).toBeGreaterThan(0)
      }
    }
  })

  it('快速入门正好 5 步', () => {
    expect(TOURS.quickstart.steps).toHaveLength(5)
  })

  it('TOUR_TOPICS 菜单含 4 主题 + 重看全部', () => {
    const keys = TOUR_TOPICS.map(t => t.key)
    expect(keys).toEqual(['quickstart', 'fund', 'compare', 'anchor', 'all'])
  })

  it('buildAllSteps 串联全部主题步骤', () => {
    const all = buildAllSteps()
    const sum = REQUIRED_TOPICS.reduce((n, k) => n + TOURS[k].steps.length, 0)
    expect(all).toHaveLength(sum)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/data/tours.spec.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现 `src/data/tours.ts`**

Create `src/data/tours.ts`:
```ts
import type { DriveStep } from 'driver.js'

// 教程主题标识
export type TourTopic = 'quickstart' | 'fund' | 'compare' | 'anchor' | 'all'

export interface TourDef {
  key: Exclude<TourTopic, 'all'>
  label: string
  steps: DriveStep[]
}

// 用 data-tour 锚点生成选择器
const el = (id: string): string => `[data-tour='${id}']`

export const TOURS: Record<Exclude<TourTopic, 'all'>, TourDef> = {
  quickstart: {
    key: 'quickstart',
    label: '🚀 快速入门',
    steps: [
      { element: el('param-month'), popover: { title: '第 1 步 · 规划期限', description: '先在这里设置从哪个月开始、规划到哪个月结束。' } },
      { element: el('param-rate'), popover: { title: '第 2 步 · 收益率与本金', description: '设置年化收益率（投资回报）和现在手头的初始存款。' } },
      { element: el('monthly-table'), popover: { title: '第 3 步 · 填收支（核心）', description: '在月度流水里添加收入 / 支出项、逐月填金额——规划数据都从这里来。' } },
      { element: el('metrics'), popover: { title: '第 4 步 · 看结果', description: '填的数字会实时反映在这里：指标条看整体，下方年度汇总看每年。' } },
      { element: el('view-chart'), popover: { title: '第 5 步 · 看趋势', description: '点「图表」切换到趋势图，看储蓄如何随时间增长。' } },
    ],
  },
  fund: {
    key: 'fund',
    label: '🏠 公积金专区',
    // 公积金子参数仅在开关开启后渲染，故全部指向始终存在的开关元素，文案分段讲解
    steps: [
      { element: el('fund-toggle'), popover: { title: '开启公积金', description: '勾选这个开关启用公积金；未开启时下方参数不会显示。' } },
      { element: el('fund-toggle'), popover: { title: '缴存与结息', description: '开启后可在此设置年利率、结息月份、初始余额。' } },
      { element: el('fund-toggle'), popover: { title: '月冲与提取', description: '在月度流水表的公积金列点单元格，可编辑缴存 / 月冲 / 提取。' } },
    ],
  },
  compare: {
    key: 'compare',
    label: '📊 多方案对比',
    steps: [
      { element: el('scenario-tabs'), popover: { title: '建多套方案', description: '点方案标签的「+」新建方案（如「买房」「不买房」），也可复制现有方案。' } },
      { element: el('view-compare'), popover: { title: '并排对比', description: '切到「对比」视图，把多套方案的结果并排比较。' } },
    ],
  },
  anchor: {
    key: 'anchor',
    label: '🎯 储蓄目标核对',
    steps: [
      { element: el('balance-col'), popover: { title: '设储蓄目标', description: '在月度流水的「存款」列点某个月，可设置该月的预期储蓄额（锚点）。' } },
      { element: el('balance-col'), popover: { title: '看是否达标', description: '设了锚点的月份会高亮，并显示实际存款与目标的偏差。' } },
    ],
  },
}

// 菜单元数据：4 主题 + 重看全部
export const TOUR_TOPICS: { key: TourTopic; label: string }[] = [
  { key: 'quickstart', label: TOURS.quickstart.label },
  { key: 'fund', label: TOURS.fund.label },
  { key: 'compare', label: TOURS.compare.label },
  { key: 'anchor', label: TOURS.anchor.label },
  { key: 'all', label: '🔁 重看全部' },
]

// 「重看全部」= 串联四个主题步骤
export function buildAllSteps(): DriveStep[] {
  return [
    ...TOURS.quickstart.steps,
    ...TOURS.fund.steps,
    ...TOURS.compare.steps,
    ...TOURS.anchor.steps,
  ]
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run tests/data/tours.spec.ts`
Expected: PASS（4 个用例全过）。

- [ ] **Step 5: 类型检查**

Run: `npx vue-tsc --noEmit`
Expected: 无错误（driver.js v1 自带类型）。

- [ ] **Step 6: 提交**

```bash
git add src/data/tours.ts tests/data/tours.spec.ts
git commit -m "feat(tour): 教程主题步骤数据与菜单元数据"
```

---

## Task 3: 播放控制 `useTour.ts`（TDD）

**Files:**
- Create: `src/composables/useTour.ts`
- Test: `tests/composables/useTour.spec.ts`

- [ ] **Step 1: 写失败测试**

Create `tests/composables/useTour.spec.ts`:
```ts
import { enableAutoUnmount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

enableAutoUnmount(afterEach)

// mock driver.js：捕获传入配置，暴露 drive 与 onDestroyed
const driveMock = vi.fn()
const driverMock = vi.fn(() => ({ drive: driveMock }))
vi.mock('driver.js', () => ({ driver: driverMock }))

const TOUR_SEEN_KEY = 'family-finance-tour-seen'

async function loadUseTour() {
  const mod = await import('../../src/composables/useTour')
  return mod
}

describe('useTour', () => {
  beforeEach(() => {
    localStorage.clear()
    driverMock.mockClear()
    driveMock.mockClear()
  })

  it('未看过时 isTourSeen 为 false，标记后为 true', async () => {
    const { isTourSeen, markTourSeen } = await loadUseTour()
    expect(isTourSeen()).toBe(false)
    markTourSeen()
    expect(isTourSeen()).toBe(true)
    expect(localStorage.getItem(TOUR_SEEN_KEY)).toBe('1')
  })

  it('已看过标记独立于方案数据 key', async () => {
    const { markTourSeen } = await loadUseTour()
    markTourSeen()
    // 方案数据 key 不应被污染
    expect(localStorage.getItem('family-finance-plan')).toBeNull()
  })

  it('playTour 用对应主题 steps 调用 driver 并 drive', async () => {
    const { playTour } = await loadUseTour()
    const { TOURS } = await import('../../src/data/tours')
    playTour('compare')
    expect(driverMock).toHaveBeenCalledTimes(1)
    const opts = driverMock.mock.calls[0][0]
    expect(opts.steps).toBe(TOURS.compare.steps)
    expect(driveMock).toHaveBeenCalledTimes(1)
  })

  it('playTour("all") 用串联步骤', async () => {
    const { playTour } = await loadUseTour()
    const { buildAllSteps } = await import('../../src/data/tours')
    playTour('all')
    const opts = driverMock.mock.calls[0][0]
    expect(opts.steps).toHaveLength(buildAllSteps().length)
  })

  it('markSeenOnDone=false（默认）时结束不写标记', async () => {
    const { playTour, isTourSeen } = await loadUseTour()
    playTour('quickstart')
    const opts = driverMock.mock.calls[0][0]
    opts.onDestroyed()
    expect(isTourSeen()).toBe(false)
  })

  it('markSeenOnDone=true 时结束写标记', async () => {
    const { playTour, isTourSeen } = await loadUseTour()
    playTour('quickstart', { markSeenOnDone: true })
    const opts = driverMock.mock.calls[0][0]
    opts.onDestroyed()
    expect(isTourSeen()).toBe(true)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/composables/useTour.spec.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现 `src/composables/useTour.ts`**

Create `src/composables/useTour.ts`:
```ts
import { driver } from 'driver.js'
import { TOURS, buildAllSteps, type TourTopic } from '../data/tours'

// 「已看过」标记 key：独立于方案数据，仅控制首次是否自动播
const TOUR_SEEN_KEY = 'family-finance-tour-seen'

/** 是否已看过首次引导 */
export function isTourSeen(): boolean {
  return localStorage.getItem(TOUR_SEEN_KEY) === '1'
}

/** 标记已看过（首次引导看毕 / 跳过后写入） */
export function markTourSeen(): void {
  localStorage.setItem(TOUR_SEEN_KEY, '1')
}

export interface PlayOptions {
  // 结束时是否写入「已看过」标记；仅首次自动播放传 true
  markSeenOnDone?: boolean
}

/**
 * 播放某个主题的教程。
 * - 纯讲解式：只高亮 + 气泡，不修改任何业务状态。
 * - 手动播放（默认）不改变「已看过」标记；首次自动播放传 markSeenOnDone。
 */
export function playTour(topic: TourTopic, opts: PlayOptions = {}): void {
  const steps = topic === 'all' ? buildAllSteps() : TOURS[topic].steps
  const driverObj = driver({
    showProgress: topic !== 'all',
    steps,
    popoverClass: 'fp-tour-popover',
    onDestroyed: () => {
      if (opts.markSeenOnDone) markTourSeen()
    },
  })
  driverObj.drive()
}

// re-export 菜单元数据：TourMenu 单从本模块取用，测试也只 mock 本模块即可
export { TOUR_TOPICS } from '../data/tours'
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run tests/composables/useTour.spec.ts`
Expected: PASS（6 个用例全过）。

- [ ] **Step 5: 类型检查**

Run: `npx vue-tsc --noEmit`
Expected: 无错误。

- [ ] **Step 6: 提交**

```bash
git add src/composables/useTour.ts tests/composables/useTour.spec.ts
git commit -m "feat(tour): useTour 播放控制与已看标记"
```

---

## Task 4: `TourMenu.vue` 教程按钮 + 菜单（TDD）

**Files:**
- Create: `src/components/TourMenu.vue`
- Test: `tests/components/TourMenu.spec.ts`

- [ ] **Step 1: 写失败测试**

Create `tests/components/TourMenu.spec.ts`:
```ts
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

enableAutoUnmount(afterEach)

const playTourMock = vi.fn()
vi.mock('../../src/composables/useTour', () => ({
  playTour: (...args: unknown[]) => playTourMock(...args),
  TOUR_TOPICS: [
    { key: 'quickstart', label: '🚀 快速入门' },
    { key: 'all', label: '🔁 重看全部' },
  ],
}))

async function loadTourMenu() {
  return (await import('../../src/components/TourMenu.vue')).default
}

describe('TourMenu', () => {
  beforeEach(() => {
    playTourMock.mockClear()
    localStorage.clear()
  })

  it('渲染「教程」触发按钮，初始菜单不显示', async () => {
    const TourMenu = await loadTourMenu()
    const wrapper = mount(TourMenu)
    const trigger = wrapper.findAll('button').find(b => b.text().includes('教程'))
    expect(trigger).toBeDefined()
    // 菜单项默认不渲染
    expect(wrapper.text()).not.toContain('快速入门')
  })

  it('点击触发按钮展开主题菜单', async () => {
    const TourMenu = await loadTourMenu()
    const wrapper = mount(TourMenu)
    const trigger = wrapper.findAll('button').find(b => b.text().includes('教程'))!
    await trigger.trigger('click')
    expect(wrapper.text()).toContain('快速入门')
    expect(wrapper.text()).toContain('重看全部')
  })

  it('点击某主题调用 playTour 并收起菜单', async () => {
    const TourMenu = await loadTourMenu()
    const wrapper = mount(TourMenu)
    await wrapper.findAll('button').find(b => b.text().includes('教程'))!.trigger('click')
    const item = wrapper.findAll('button').find(b => b.text().includes('快速入门'))!
    await item.trigger('click')
    expect(playTourMock).toHaveBeenCalledWith('quickstart')
    expect(wrapper.text()).not.toContain('重看全部')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/components/TourMenu.spec.ts`
Expected: FAIL（组件不存在）。

- [ ] **Step 3: 实现 `src/components/TourMenu.vue`**

Create `src/components/TourMenu.vue`:
```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useClickOutside } from '../composables/useClickOutside'
import { playTour, TOUR_TOPICS } from '../composables/useTour'

const open = ref(false)
const menuRef = ref<HTMLElement | null>(null)

useClickOutside(menuRef, () => {
  open.value = false
})

function toggle() {
  open.value = !open.value
}

function choose(key: typeof TOUR_TOPICS[number]['key']) {
  open.value = false
  playTour(key)
}
</script>

<template>
  <div ref="menuRef" class="relative">
    <button
      class="px-3 py-1 border rounded text-sm font-mono hover:bg-surface-2"
      type="button"
      @click="toggle"
    >
      教程
    </button>
    <div
      v-if="open"
      data-testid="tour-menu"
      class="absolute right-0 top-full mt-1 min-w-40 overflow-hidden rounded-xl border border-line bg-surface py-1 text-[12px] text-ink shadow-[0_18px_50px_-20px_rgba(26,34,51,0.25)] z-50"
    >
      <button
        v-for="topic in TOUR_TOPICS"
        :key="topic.key"
        type="button"
        class="block w-full px-3 py-1.5 text-left whitespace-nowrap text-ink-2 hover:bg-surface-2"
        @click="choose(topic.key)"
      >
        {{ topic.label }}
      </button>
    </div>
  </div>
</template>
```

> 说明：`useClickOutside` 已存在于 `src/composables/useClickOutside.ts`（`ToolsMenu.vue` 同款用法）。菜单结构与样式参照 `ToolsMenu.vue`。

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run tests/components/TourMenu.spec.ts`
Expected: PASS（3 个用例全过）。

- [ ] **Step 5: 类型检查**

Run: `npx vue-tsc --noEmit`
Expected: 无错误。

- [ ] **Step 6: 提交**

```bash
git add src/components/TourMenu.vue tests/components/TourMenu.spec.ts
git commit -m "feat(tour): TourMenu 教程按钮与主题菜单"
```

---

## Task 5: 为界面元素加 `data-tour` 锚点

**Files:**
- Modify: `src/App.vue`
- Modify: `src/components/KeyMetricsBar.vue`
- Modify: `src/components/MonthlyTable.vue`
- Modify: `src/components/ScenarioTabs.vue`

本任务无逻辑，仅加属性。用类型检查 + 已有测试保证不破坏。

- [ ] **Step 1: App.vue —— 参数行分组锚点**

在 `src/App.vue` 参数行内，给下列包裹元素加 `data-tour` 属性（保持现有 class 不变，仅追加属性）：

- 「起始月份」分组 `<div class="flex items-center gap-2">`（含 `<label for="start-month">` 那个）→ 追加 `data-tour="param-month"`
- 「年化收益率」分组 `<div class="flex items-center gap-2">`（含 `step="0.001"` input 那个）→ 追加 `data-tour="param-rate"`
- 公积金 `<label ... class="...flex items-center gap-1">`（含 `data-testid="fund-enable-toggle"` checkbox）→ 追加 `data-tour="fund-toggle"`

示例（起始月份分组，加属性前）：
```vue
<div class="flex items-center gap-2">
  <label for="start-month" class="text-[11px] whitespace-nowrap font-mono">起始月份</label>
  <MonthPicker v-model="startMonth" input-id="start-month" />
</div>
```
改为：
```vue
<div class="flex items-center gap-2" data-tour="param-month">
  <label for="start-month" class="text-[11px] whitespace-nowrap font-mono">起始月份</label>
  <MonthPicker v-model="startMonth" input-id="start-month" />
</div>
```

- [ ] **Step 2: App.vue —— 视图按钮锚点**

给「图表」按钮（class 含 `activeView === 'chart'` 的那个）追加 `data-tour="view-chart"`；给「对比」按钮追加 `data-tour="view-compare"`。

- [ ] **Step 3: App.vue —— 表格容器锚点**

给「01 年度汇总」容器 `<div class="border-b border-line">`（包 `<AnnualTable>`）追加 `data-tour="annual-table"`；给「02 月度流水」容器 `<div>`（包 `<MonthlyTable>`）追加 `data-tour="monthly-table"`。

- [ ] **Step 4: KeyMetricsBar.vue —— 指标条根元素**

`src/components/KeyMetricsBar.vue` 根 `<div class="grid border-b border-line bg-surface" ...>` 追加 `data-tour="metrics"`：
```vue
<div data-tour="metrics" class="grid border-b border-line bg-surface"
     :style="{ gridTemplateColumns: `repeat(${cells.length}, 1fr)` }">
```

- [ ] **Step 5: MonthlyTable.vue —— 存款列表头锚点**

`src/components/MonthlyTable.vue` 中表头「存款」`<th>`（约 835 行，文本「存款」）追加 `data-tour="balance-col"`：
```vue
<th data-tour="balance-col" class="px-0.5 py-0 text-right tabular-nums font-mono font-semibold whitespace-nowrap">存款</th>
```

- [ ] **Step 6: ScenarioTabs.vue —— 方案标签根元素**

`src/components/ScenarioTabs.vue` 模板根元素追加 `data-tour="scenario-tabs"`（读文件确认根标签，通常是 `<div ...>` 或带 `v-for` 的容器外层）。

- [ ] **Step 7: 类型检查 + 全量测试**

Run: `npx vue-tsc --noEmit && npx vitest run`
Expected: 无错误、全部已有测试通过（仅加属性，不应破坏行为）。

- [ ] **Step 8: 提交**

```bash
git add src/App.vue src/components/KeyMetricsBar.vue src/components/MonthlyTable.vue src/components/ScenarioTabs.vue
git commit -m "feat(tour): 为界面元素加 data-tour 锚点"
```

---

## Task 6: App.vue 集成——挂载 TourMenu + 首次自动播放（TDD）

**Files:**
- Modify: `src/App.vue`
- Test: `tests/App.spec.ts`（追加用例）

- [ ] **Step 1: 追加失败测试**

先在 `globalStubs` 对象新增 `TourMenu: true`（避免 TourMenu 真实渲染依赖）。

再在现有 `beforeEach` 的 `localStorage.clear()` 之后追加一行，**预设「已看过」**——否则现有所有用例挂载 App 时 `onMounted` 会触发真实 driver 在 jsdom 里报错：
```ts
    localStorage.setItem('family-finance-tour-seen', '1')
```

在 `describe('App', ...)` 内追加两个用例（用 `vi.doMock` + 动态 `import`，配合 `vi.resetModules()` 绕开预设标记）：
```ts
  it('未看过时挂载后自动播放快速入门', async () => {
    vi.resetModules()
    const playTour = vi.fn()
    vi.doMock('../src/composables/useTour', () => ({
      playTour, isTourSeen: () => false, markTourSeen: () => {},
    }))
    const App = (await import('../src/App.vue')).default
    mount(App, { global: { stubs: globalStubs } })
    await nextTick()
    expect(playTour).toHaveBeenCalledWith('quickstart', { markSeenOnDone: true })
    vi.doUnmock('../src/composables/useTour')
  })

  it('已看过时不自动播放', async () => {
    vi.resetModules()
    const playTour = vi.fn()
    vi.doMock('../src/composables/useTour', () => ({
      playTour, isTourSeen: () => true, markTourSeen: () => {},
    }))
    const App = (await import('../src/App.vue')).default
    mount(App, { global: { stubs: globalStubs } })
    await nextTick()
    expect(playTour).not.toHaveBeenCalled()
    vi.doUnmock('../src/composables/useTour')
  })
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/App.spec.ts`
Expected: FAIL（TourMenu 未挂载 / 未自动播放）。

- [ ] **Step 3: 实现——挂载 TourMenu + onMounted 自动播放**

在 `src/App.vue` `<script setup>` 顶部 import 区追加：
```ts
import TourMenu from './components/TourMenu.vue'
import { isTourSeen, playTour } from './composables/useTour'
```

在 `onMounted` 处注册首次自动播放（与现有 keydown 监听合并到同一 `onMounted`）。把现有：
```ts
onMounted(() => window.addEventListener('keydown', onKeydown))
```
改为：
```ts
onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  // 首次访问（未看过引导）自动播放「快速入门」；看毕/跳过后写入标记
  if (!isTourSeen()) playTour('quickstart', { markSeenOnDone: true })
})
```

在模板顶部按钮区（「更多」`<ToolsMenu />` 旁）挂载 `<TourMenu />`。找到 `<ToolsMenu />` 所在位置（约 203 行），在其前或后并列加：
```vue
<TourMenu />
```
建议放在「撤销/重做」与「更多」之间的分隔线之后、`<ToolsMenu />` 之前，与现有按钮风格一致。

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run tests/App.spec.ts`
Expected: PASS（含两个新用例）。

- [ ] **Step 5: 类型检查 + 全量测试**

Run: `npx vue-tsc --noEmit && npx vitest run`
Expected: 无错误、全绿。

- [ ] **Step 6: 提交**

```bash
git add src/App.vue tests/App.spec.ts
git commit -m "feat(tour): 挂载教程入口并首次自动播放快速入门"
```

---

## Task 7: 引入 driver.js 样式 + 气泡定制

**Files:**
- Create: `src/styles/tour.css`
- Modify: `src/main.ts`

- [ ] **Step 1: 创建气泡样式覆盖**

Create `src/styles/tour.css`:
```css
/* driver.js 教程气泡 · 贴合浅色金融终端风格 */
.fp-tour-popover {
  background: #ffffff;
  color: #1a2233;
  font-family: var(--font-sans);
  border: 1px solid #e5e3df;
  border-radius: 10px;
  box-shadow: 0 18px 50px -20px rgba(26, 34, 51, 0.25);
}
.fp-tour-popover .driver-popover-title {
  font-family: var(--font-mono);
  font-weight: 700;
  font-size: 13px;
  color: #1a2233;
}
.fp-tour-popover .driver-popover-description {
  font-size: 13px;
  line-height: 1.6;
  color: #4a5568;
}
.fp-tour-popover .driver-popover-progress-text {
  font-family: var(--font-mono);
  font-size: 11px;
  color: #94a3b8;
}
.fp-tour-popover .driver-popover-close-btn {
  color: #94a3b8;
}
.fp-tour-popover .driver-popover-prev-btn {
  background: #f3f5fa;
  color: #1a2233;
  border: 1px solid #cbd5e1;
  text-shadow: none;
  font-family: var(--font-mono);
  font-size: 12px;
}
.fp-tour-popover .driver-popover-next-btn {
  background: #1a2233;
  color: #ffffff;
  border: none;
  text-shadow: none;
  font-family: var(--font-mono);
  font-size: 12px;
}
.fp-tour-popover .driver-popover-next-btn:hover {
  background: #2d3a52;
}
/* 高亮框描边用墨色，取代默认蓝 */
.driver-popover-highlight {
  box-shadow: 0 0 0 3px #1a2233, 0 0 0 5px rgba(26, 34, 51, 0.15);
}
```

> 若 driver.js 实际渲染的 class 名与上述不符（版本差异），用浏览器 DevTools 选中气泡元素核对真实 class 后微调选择器；结构不变。

- [ ] **Step 2: 在入口引入样式**

修改 `src/main.ts`，在 `import './styles/theme.css'` 之后追加两行：
```ts
import '@unocss/reset/tailwind.css'
import 'virtual:uno.css'
import './styles/theme.css'
import 'driver.js/dist/driver.css'   // driver.js 基础样式
import './styles/tour.css'            // 项目气泡样式覆盖
import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')
```

- [ ] **Step 3: 构建验证**

Run: `npm run build`
Expected: 构建成功（`vue-tsc -b` 严格类型检查通过，`vite build` 产出 dist）。

- [ ] **Step 4: 提交**

```bash
git add src/styles/tour.css src/main.ts
git commit -m "feat(tour): 引入 driver.js 样式并定制气泡外观"
```

---

## Task 8: 端到端验证与收尾

**Files:** 无（验证任务）

- [ ] **Step 1: 全量测试**

Run: `npm test`
Expected: 全部测试通过（含新增 useTour / TourMenu / tours / App 新用例）。

- [ ] **Step 2: 构建验证**

Run: `npm run build`
Expected: 成功，无类型错误。

- [ ] **Step 3: 浏览器手动验证**

Run: `npm run dev`，在浏览器打开（先在 DevTools 清掉 `localStorage` 的 `family-finance-tour-seen`）：
- 打开应用应自动播放「快速入门」5 步；点「跳过」后刷新不再自动播。
- 点顶部「教程」→ 菜单出现 5 项 → 分别点「公积金专区」「多方案对比」「储蓄目标核对」「重看全部」，确认聚光灯高亮与气泡正常、样式贴合。
- 确认气泡按钮可「上一步/下一步/跳过」，点遮罩可退出。

- [ ] **Step 4: 收尾提交（如有遗留改动）**

```bash
git status
# 若有未提交的微调：
git add -p
git commit -m "test(tour): 端到端验证微调"
```

---

## Self-Review 自审结果

**Spec 覆盖：**
- 首次自动播「快速入门」+ 已看过标记 → Task 3、Task 6 ✓
- 顶部「教程」入口分主题菜单 → Task 4 ✓
- 聚光灯 Tour + 上一步/下一步/跳过 → driver.js 内置，Task 3 ✓
- 四主题 + 重看全部 → Task 2 ✓
- 纯讲解 → useTour 不改业务状态 ✓
- 老用户升级也看一次（标记不存在即播）→ Task 6 `isTourSeen()` ✓
- driver.js 选型 + 样式贴合 → Task 1、Task 7 ✓
- data-tour 锚点 → Task 5 ✓
- 公积金主题开关前置（指向常驻开关元素）→ Task 2 fund 主题注释 ✓

**占位符：** 无 TBD/TODO；每个代码步骤含完整代码。

**类型一致性：** `TourTopic` / `TourDef` / `playTour(topic, opts)` 在 Task 2/3/4/6 用法一致；`data-tour` 锚点 id 在 Task 2（tours.ts 引用）与 Task 5（元素定义）逐一对应。
