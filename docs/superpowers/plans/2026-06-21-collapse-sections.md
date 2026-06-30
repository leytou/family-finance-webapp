# 折叠区块功能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给参数、指标、年度汇总、月度流水四个区块加独立的折叠/展开能力，折叠状态持久化到独立 localStorage，刷新后保持，首次默认全部展开。

**Architecture:** 新增两个独立单元——通用组件 `CollapsibleSection.vue`（折叠头按钮 + `v-show` 内容 + `v-model`）和 composable `useUiPrefs.ts`（四个区块的布尔状态 + localStorage 读写 + 容错）；`App.vue` 用组件包裹四个区块并接入 composable。状态用独立 key `family-finance-ui-prefs`，与财务数据 `family-finance-plan` 完全分离，不参与导出/导入。

**Tech Stack:** Vue 3 (Composition API + `<script setup>`) + TypeScript + UnoCSS + Vitest + @vue/test-utils

参考设计文档：`docs/superpowers/specs/2026-06-21-collapse-sections-design.md`

---

## File Structure

- Create: `src/composables/useUiPrefs.ts` — 四区块折叠状态 + localStorage 持久化（独立 key，容错读取）
- Create: `src/components/CollapsibleSection.vue` — 通用折叠头组件（标题 + 箭头 + `v-show` 内容槽 + `v-model`）
- Create: `tests/composables/useUiPrefs.spec.ts`
- Create: `tests/components/CollapsibleSection.spec.ts`
- Modify: `src/App.vue` — 四个区块用 `CollapsibleSection` 包裹并接入 `useUiPrefs`
- Modify: `tests/App.spec.ts` — 修复受现有布局断言影响的 2 个测试 + 新增 4 个折叠行为测试

---

## Task 1: useUiPrefs composable（状态持久化，无 UI 依赖，先做）

**Files:**
- Create: `src/composables/useUiPrefs.ts`
- Test: `tests/composables/useUiPrefs.spec.ts`

- [ ] **Step 1: 写失败测试**

创建 `tests/composables/useUiPrefs.spec.ts`：

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

async function loadUseUiPrefs() {
  return (await import('../../src/composables/useUiPrefs')).useUiPrefs
}

describe('useUiPrefs', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  it('初次加载四个区块默认展开', async () => {
    const useUiPrefs = await loadUseUiPrefs()
    const prefs = useUiPrefs()
    expect(prefs.params.value).toBe(false)
    expect(prefs.metrics.value).toBe(false)
    expect(prefs.annual.value).toBe(false)
    expect(prefs.monthly.value).toBe(false)
  })

  it('设置收起后写入 localStorage 独立 key', async () => {
    const useUiPrefs = await loadUseUiPrefs()
    const prefs = useUiPrefs()
    prefs.annual.value = true
    const raw = localStorage.getItem('family-finance-ui-prefs')
    expect(raw).toBeTruthy()
    expect(JSON.parse(raw!).collapsed.annual).toBe(true)
  })

  it('收起后重新加载保持状态', async () => {
    let useUiPrefs = await loadUseUiPrefs()
    useUiPrefs().metrics.value = true
    vi.resetModules()
    useUiPrefs = await loadUseUiPrefs()
    const prefs = useUiPrefs()
    expect(prefs.metrics.value).toBe(true)
    expect(prefs.params.value).toBe(false)
  })

  it('localStorage 损坏时回退默认全展开', async () => {
    localStorage.setItem('family-finance-ui-prefs', '{not json')
    const useUiPrefs = await loadUseUiPrefs()
    const prefs = useUiPrefs()
    expect(prefs.params.value).toBe(false)
    expect(prefs.annual.value).toBe(false)
  })

  it('部分字段缺失时，缺失字段回退展开', async () => {
    localStorage.setItem(
      'family-finance-ui-prefs',
      JSON.stringify({ version: 1, collapsed: { annual: true } }),
    )
    const useUiPrefs = await loadUseUiPrefs()
    const prefs = useUiPrefs()
    expect(prefs.annual.value).toBe(true)
    expect(prefs.monthly.value).toBe(false)
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run tests/composables/useUiPrefs.spec.ts`
Expected: FAIL —— 模块 `../../src/composables/useUiPrefs` 不存在。

- [ ] **Step 3: 实现 composable**

创建 `src/composables/useUiPrefs.ts`：

```ts
import { computed, ref, type WritableComputedRef } from 'vue'

const STORAGE_KEY = 'family-finance-ui-prefs'

export type SectionKey = 'params' | 'metrics' | 'annual' | 'monthly'

interface CollapsedState {
  params: boolean
  metrics: boolean
  annual: boolean
  monthly: boolean
}

function defaultCollapsed(): CollapsedState {
  return { params: false, metrics: false, annual: false, monthly: false }
}

// 容错读取：解析失败或缺字段时，对应项回退 false（展开）
function load(): CollapsedState {
  const base = defaultCollapsed()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return base
    const parsed = JSON.parse(raw) as { collapsed?: Partial<CollapsedState> }
    const c = parsed?.collapsed ?? {}
    return {
      params: typeof c.params === 'boolean' ? c.params : false,
      metrics: typeof c.metrics === 'boolean' ? c.metrics : false,
      annual: typeof c.annual === 'boolean' ? c.annual : false,
      monthly: typeof c.monthly === 'boolean' ? c.monthly : false,
    }
  } catch {
    return base
  }
}

function save(state: CollapsedState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, collapsed: state }))
}

// 模块级单例：与 useStore 同样的模式，整页共享同一份折叠状态
let sharedCollapsed: ReturnType<typeof ref<CollapsedState>> | null = null

export function useUiPrefs(): Record<SectionKey, WritableComputedRef<boolean>> {
  if (!sharedCollapsed) {
    sharedCollapsed = ref(load())
  }
  const state = sharedCollapsed
  // 每个区块一个可写 computed：读共享 state，写时同步落盘
  const make = (key: SectionKey): WritableComputedRef<boolean> =>
    computed({
      get: () => state.value[key],
      set: (v: boolean) => {
        state.value = { ...state.value, [key]: v }
        save(state.value)
      },
    })
  return {
    params: make('params'),
    metrics: make('metrics'),
    annual: make('annual'),
    monthly: make('monthly'),
  }
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run tests/composables/useUiPrefs.spec.ts`
Expected: PASS（5 tests）。

- [ ] **Step 5: 提交**

```bash
git add src/composables/useUiPrefs.ts tests/composables/useUiPrefs.spec.ts
git commit -m "feat: 新增 useUiPrefs 折叠状态持久化

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: CollapsibleSection 通用组件

**Files:**
- Create: `src/components/CollapsibleSection.vue`
- Test: `tests/components/CollapsibleSection.spec.ts`

- [ ] **Step 1: 写失败测试**

创建 `tests/components/CollapsibleSection.spec.ts`：

```ts
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import CollapsibleSection from '../../src/components/CollapsibleSection.vue'

enableAutoUnmount(afterEach)

function mountSection(props: Record<string, unknown>) {
  return mount(CollapsibleSection, {
    props,
    slots: { default: '<div data-testid="content">内容</div>' },
  })
}

describe('CollapsibleSection', () => {
  it('展开时显示标题与内容', () => {
    const wrapper = mountSection({ collapsed: false, title: '参数' })
    expect(wrapper.text()).toContain('参数')
    expect(wrapper.find('[data-testid="content"]').isVisible()).toBe(true)
  })

  it('收起时隐藏内容但保留 DOM（v-show）', () => {
    const wrapper = mountSection({ collapsed: true, title: '参数' })
    expect(wrapper.find('[data-testid="content"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="content"]').isVisible()).toBe(false)
  })

  it('点击折叠头切换并 emit update:collapsed', async () => {
    const wrapper = mountSection({ collapsed: false, title: '参数' })
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('update:collapsed')).toEqual([[true]])
  })

  it('折叠头 aria-expanded 反映展开状态', () => {
    const open = mountSection({ collapsed: false, title: '参数' })
    expect(open.get('button').attributes('aria-expanded')).toBe('true')
    const closed = mountSection({ collapsed: true, title: '参数' })
    expect(closed.get('button').attributes('aria-expanded')).toBe('false')
  })

  it('展开时箭头朝下 ▾，收起时朝右 ▸', () => {
    const open = mountSection({ collapsed: false, title: '参数' })
    expect(open.get('[data-testid="collapse-arrow"]').text()).toBe('▾')
    const closed = mountSection({ collapsed: true, title: '参数' })
    expect(closed.get('[data-testid="collapse-arrow"]').text()).toBe('▸')
  })

  it('传入 index 渲染序号', () => {
    const wrapper = mountSection({ collapsed: false, title: '年度汇总', index: '01' })
    expect(wrapper.get('[data-testid="collapse-index"]').text()).toBe('01')
  })

  it('未传 index 时不渲染序号节点', () => {
    const wrapper = mountSection({ collapsed: false, title: '参数' })
    expect(wrapper.find('[data-testid="collapse-index"]').exists()).toBe(false)
  })

  it('sticky 为真时折叠头带 sticky 类', () => {
    const wrapper = mountSection({ collapsed: false, title: '月度流水', sticky: true })
    expect(wrapper.get('button').classes()).toContain('sticky')
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run tests/components/CollapsibleSection.spec.ts`
Expected: FAIL —— 组件文件不存在，import 报错。

- [ ] **Step 3: 实现组件**

创建 `src/components/CollapsibleSection.vue`：

```vue
<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  collapsed: boolean
  title: string
  index?: string
  sticky?: boolean
}>(), {
  index: undefined,
  sticky: false,
})

const emit = defineEmits<{
  'update:collapsed': [value: boolean]
}>()

function toggle() {
  emit('update:collapsed', !props.collapsed)
}

// 折叠头样式与现有「01 年度汇总」标题条一致；四个区块复用，保证入口统一
const headerClass = computed(() => [
  'font-mono text-[10.5px] tracking-[0.18em] uppercase text-ink-2 px-4 py-1.5 flex items-center gap-2 bg-surface w-full text-left hover:bg-surface-2',
  props.sticky ? 'sticky top-0 z-1' : '',
])
</script>

<template>
  <div>
    <button
      type="button"
      data-testid="collapse-header"
      :class="headerClass"
      :aria-expanded="!collapsed"
      @click="toggle"
    >
      <span data-testid="collapse-arrow" aria-hidden="true">{{ collapsed ? '▸' : '▾' }}</span>
      <span v-if="index" data-testid="collapse-index" class="text-brand-600 font-bold">{{ index }}</span>
      {{ title }}
    </button>
    <!-- v-show 保留 DOM：避免展开后输入框重新挂载导致失焦/丢值 -->
    <div v-show="!collapsed">
      <slot />
    </div>
  </div>
</template>
```

说明：根元素是单个 `<div>` 且无内建 class，调用方透传的 class（如 `flex-none max-h-[35%] overflow-auto`）会自动 fallthrough 到该根 div，由其承担布局容器角色。

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run tests/components/CollapsibleSection.spec.ts`
Expected: PASS（8 tests）。

- [ ] **Step 5: 提交**

```bash
git add src/components/CollapsibleSection.vue tests/components/CollapsibleSection.spec.ts
git commit -m "feat: 新增 CollapsibleSection 通用折叠组件

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: App.vue 接入四个折叠区块 + 同步测试

**Files:**
- Modify: `src/App.vue`
- Modify: `tests/App.spec.ts`

> 注意：本仓库工作区可能有用户并行编辑的未提交文件，提交时只 `git add` 本任务触及的文件（`src/App.vue`、`tests/App.spec.ts`），不要整片 `git add .`。

- [ ] **Step 1: 在 App.spec.ts 新增折叠行为测试（会失败）**

在 `tests/App.spec.ts` 的 `describe('App', () => { ... })` 内追加以下 4 个用例：

```ts
  it('四个区块默认展开（四个折叠头 aria-expanded=true）', async () => {
    const App = await loadApp()
    const wrapper = mount(App, { global: { stubs: globalStubs } })
    const headers = wrapper.findAll('[data-testid="collapse-header"]')
    expect(headers).toHaveLength(4)
    headers.forEach(h => expect(h.attributes('aria-expanded')).toBe('true'))
  })

  it('点击参数折叠头收起，隐藏参数输入与公积金开关', async () => {
    const App = await loadApp()
    const wrapper = mount(App, { global: { stubs: globalStubs } })
    const rateInput = () => wrapper.findAll('input').find(i => i.attributes('step') === '0.001')
    expect(rateInput()?.isVisible()).toBe(true)
    expect(wrapper.find('[data-testid="fund-enable-toggle"]').isVisible()).toBe(true)

    const paramHeader = wrapper.findAll('[data-testid="collapse-header"]').find(b => b.text().includes('参数'))!
    await paramHeader.trigger('click')

    expect(rateInput()?.isVisible()).toBe(false)
    expect(wrapper.find('[data-testid="fund-enable-toggle"]').isVisible()).toBe(false)
  })

  it('收起年度汇总后，月度流水容器仍为 flex-1（撑满）', async () => {
    const App = await loadApp()
    const wrapper = mount(App, { global: { stubs: globalStubs } })
    const annualHeader = wrapper.findAll('[data-testid="collapse-header"]').find(b => b.text().includes('年度汇总'))!
    await annualHeader.trigger('click')
    const main = wrapper.get('main')
    const divs = main.findAll(':scope > div')
    expect(divs[1].classes()).toContain('flex-1')
  })

  it('收起参数后重新挂载仍保持收起（持久化）', async () => {
    let App = await loadApp()
    let wrapper = mount(App, { global: { stubs: globalStubs } })
    const paramHeader = wrapper.findAll('[data-testid="collapse-header"]').find(b => b.text().includes('参数'))!
    await paramHeader.trigger('click')

    vi.resetModules()
    App = await loadApp()
    wrapper = mount(App, { global: { stubs: globalStubs } })
    const paramH = wrapper.findAll('[data-testid="collapse-header"]').find(b => b.text().includes('参数'))!
    expect(paramH.attributes('aria-expanded')).toBe('false')
  })
```

- [ ] **Step 2: 运行测试，确认新增用例失败**

Run: `npx vitest run tests/App.spec.ts`
Expected: 上述 4 个新用例 FAIL（找不到 `collapse-header`）；同时旧用例 `整体布局结构正确` 与 `第二行操作层含「参数」行标签` 也会失败（见 Step 4 修复）。

- [ ] **Step 3: 改造 App.vue**

**3a. 在 `<script setup>` 顶部 import 区追加（紧邻其它组件 import）：**

```ts
import CollapsibleSection from './components/CollapsibleSection.vue'
import { useUiPrefs } from './composables/useUiPrefs'
```

**3b. 在 `useHistory()` 解构之后（`const results = computed(...)` 附近）加一行：**

```ts
const prefs = useUiPrefs()
```

**3c. 参数行改为 CollapsibleSection 包裹**——把这一段：

```html
      <div v-if="activeView !== 'calculator'" data-testid="param-row" class="min-h-8 flex items-center gap-4 px-4 py-0.5 bg-surface-2 border-t">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <span data-testid="param-row-label" class="text-[10px] uppercase tracking-wide font-mono text-ink-3 border-r pr-3">参数</span>
```

替换为（注意：删掉了原来的 `param-row-label` 那个 `<span>`，因为折叠头已带「参数」标题）：

```html
      <CollapsibleSection
        v-if="activeView !== 'calculator'"
        v-model="prefs.params"
        title="参数"
        data-testid="param-row"
      >
        <div class="min-h-8 flex items-center gap-4 px-4 py-0.5 bg-surface-2 border-t">
          <div class="flex flex-wrap items-center gap-x-3 gap-y-0.5">
```

并把这处 `param-row` 原来的闭合 `</div></div>`（参数输入区结尾）替换为多一层闭合：

把这段结尾：

```html
          </div>
        </div>
      </div>
      <!-- 关键指标条：计算器/对比视图不显示 -->
```

改为：

```html
          </div>
        </div>
      </CollapsibleSection>
      <!-- 关键指标条：计算器/对比视图不显示 -->
```

**3d. 指标条改为 CollapsibleSection 包裹**——把：

```html
      <KeyMetricsBar
        v-if="activeView !== 'calculator' && activeView !== 'comparison'"
        :results="keyMetricsProps.results"
        :fund-enabled="keyMetricsProps.fundEnabled"
        :initial-deposit="keyMetricsProps.initialDeposit"
      />
```

替换为：

```html
      <CollapsibleSection
        v-if="activeView !== 'calculator' && activeView !== 'comparison'"
        v-model="prefs.metrics"
        title="指标"
      >
        <KeyMetricsBar
          :results="keyMetricsProps.results"
          :fund-enabled="keyMetricsProps.fundEnabled"
          :initial-deposit="keyMetricsProps.initialDeposit"
        />
      </CollapsibleSection>
```

**3e. 年度汇总区改为 CollapsibleSection**——把：

```html
        <div class="flex-none max-h-[35%] overflow-auto border-b border-line">
          <div class="font-mono text-[10.5px] tracking-[0.18em] uppercase text-ink-2 px-4 py-1.5 flex items-center gap-2 bg-surface">
            <span class="text-brand-600 font-bold">01</span> 年度汇总
          </div>
          <AnnualTable :results="results" />
        </div>
```

替换为：

```html
        <CollapsibleSection
          v-model="prefs.annual"
          title="年度汇总"
          index="01"
          class="flex-none max-h-[35%] overflow-auto border-b border-line"
        >
          <AnnualTable :results="results" />
        </CollapsibleSection>
```

**3f. 月度流水区改为 CollapsibleSection**——把：

```html
        <div class="flex-1 overflow-auto">
          <div class="font-mono text-[10.5px] tracking-[0.18em] uppercase text-ink-2 px-4 py-1.5 flex items-center gap-2 bg-surface sticky top-0 z-1">
            <span class="text-brand-600 font-bold">02</span> 月度流水
          </div>
          <MonthlyTable :results="results" />
        </div>
```

替换为：

```html
        <CollapsibleSection
          v-model="prefs.monthly"
          title="月度流水"
          index="02"
          sticky
          class="flex-1 overflow-auto"
        >
          <MonthlyTable :results="results" />
        </CollapsibleSection>
```

- [ ] **Step 4: 修复 App.spec.ts 中受影响的 2 个旧用例**

**4a.** 把 `整体布局结构正确（导航/参数/指标条）` 用例整体替换为（不再依赖参数行 `min-h-8/bg-surface-2` 与指标条 `grid` 这两个 class，因为它们已移入折叠组件内部；改为校验三段结构与折叠头存在）：

```ts
  it('整体布局结构正确（导航/参数/指标条）', async () => {
    const App = await loadApp()
    const wrapper = mount(App, { global: { stubs: globalStubs } })

    expect(wrapper.get('.h-screen').classes()).toContain('flex-col')

    const header = wrapper.get('header')
    expect(header.classes()).toContain('border-b')

    // header 三段：导航行、参数折叠区、指标折叠区
    const rows = header.findAll(':scope > div')
    expect(rows).toHaveLength(3)
    expect(rows[0].classes()).toContain('h-12')

    const headers = wrapper.findAll('[data-testid="collapse-header"]')
    expect(headers.find(b => b.text().includes('参数'))).toBeDefined()
    expect(headers.find(b => b.text().includes('指标'))).toBeDefined()

    const main = wrapper.get('main')
    expect(main.classes()).toContain('flex-1')
    expect(main.classes()).toContain('flex-col')
  })
```

**4b.** 把 `第二行操作层含「参数」行标签` 用例整体替换为（`param-row-label` 已移除，改校验折叠头标题）：

```ts
  it('参数折叠头含「参数」标题', async () => {
    const App = await loadApp()
    const wrapper = mount(App, { global: { stubs: globalStubs } })

    const headers = wrapper.findAll('[data-testid="collapse-header"]')
    const paramHeader = headers.find(b => b.text().includes('参数'))
    expect(paramHeader).toBeDefined()
    expect(paramHeader!.text()).toContain('参数')
  })
```

- [ ] **Step 5: 运行 App.spec.ts，确认全部通过**

Run: `npx vitest run tests/App.spec.ts`
Expected: PASS（原有用例 + 4 个新增用例全部通过）。

若 `渲染两个表格区域（非对比模式）` 仍通过：年度汇总/月度流水的 `max-h-[35%]/border-b/flex-1` class 经 fallthrough 仍在 main 的两个直接子 div 上，断言无需改动。

- [ ] **Step 6: 提交**

```bash
git add src/App.vue tests/App.spec.ts
git commit -m "feat: 参数/指标/年度汇总/月度流水四区块接入折叠

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: 全量回归 + 类型检查 + 人工验证

**Files:** 无新增/修改（验证为主）

- [ ] **Step 1: 跑全部单测**

Run: `npm run test`
Expected: 全部测试通过，无失败。

- [ ] **Step 2: 类型检查 + 生产构建**

Run: `npm run build`
Expected: `vue-tsc` 类型检查通过、`vite build` 成功，无报错。

- [ ] **Step 3: 人工验证（启动开发服务器）**

Run: `npm run dev`，在浏览器打开本地地址，逐项确认：
1. 四个区块顶部各有一条带箭头的标题（参数/指标/01 年度汇总/02 月度流水），默认全展开、箭头朝下。
2. 点「参数」标题 → 参数输入行（含公积金开关）整行隐藏，箭头变朝右；再点恢复。
3. 点「指标」标题 → 指标条隐藏；再点恢复。
4. 点「01 年度汇总」标题 → 年度汇总隐藏，月度流水自动撑满剩余高度。
5. 点「02 月度流水」标题 → 月度流水隐藏，年度汇总保持原高度。
6. 收起任一区块后刷新页面 → 保持收起状态。
7. 切到「图表」视图再切回「表格」→ 折叠状态保持。
8. 导出方案数据 → 确认导出内容不含折叠状态（折叠状态存于独立 key）。

- [ ] **Step 4: 若 Step 1-2 发现问题则修复并提交；否则无新增提交**

```bash
git status   # 确认工作区干净（本任务的提交已在 Task 3 完成）
```

---

## Self-Review（已对照 spec 核对）

- **Spec 覆盖**：四区块独立折叠→Task 3；状态记住 + 首次全展开 + 容错→Task 1；统一折叠入口→Task 2 组件复用；不进导出→独立 `family-finance-ui-prefs` key；无动画→箭头瞬切、无 transition；公积金随参数隐藏→Task 3 测试覆盖；收起年度汇总月度流水撑满→Task 3 测试覆盖。
- **占位扫描**：无 TBD/TODO，每个步骤含完整代码与命令。
- **类型一致**：`useUiPrefs` 返回 `Record<SectionKey, WritableComputedRef<boolean>>`，字段 `params/metrics/annual/monthly`；App 模板用 `prefs.params/metrics/annual/monthly`；`CollapsibleSection` props `collapsed/title/index?/sticky?` 与 App 传参、测试断言一致；testid `collapse-header/collapse-arrow/collapse-index` 在组件与测试中一致。
