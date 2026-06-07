# 累计列可编辑 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将月度表累计列改为可编辑（点击即编辑），移除参数面板的月度锚点管理 UI。

**Architecture:** MonthlyTable 累计列单元格从只读 button 改为点击触发 input 的内联编辑组件。编辑确认时 emit 事件，父组件调用 useStore 的 addAnchor/removeAnchor。FormulaPopover 触发方式改为 hover。ParamPanel 删除锚点管理区块。

**Tech Stack:** Vue 3 + Composition API, Vitest, @vue/test-utils

---

### Task 1: MonthlyTable 累计列改为可编辑 + 公式弹窗改 hover

**Files:**
- Modify: `src/components/MonthlyTable.vue`
- Modify: `tests/components/MonthlyTable.spec.ts`

- [ ] **Step 1: 更新测试 — 点击累计值进入编辑态，输入新值后 emit 事件**

替换 `tests/components/MonthlyTable.spec.ts` 中的最后一个测试（鼠标离开公式按钮时关闭弹窗）并追加新测试：

```typescript
it('点击累计值进入编辑态并 emit 确认值', async () => {
  const wrapper = mount(MonthlyTable, {
    props: {
      results: [
        createResult({
          month: 202601,
          cumSavings: 100000,
        }),
      ],
    },
  })

  const cumCell = wrapper.findAll('tbody td').at(-1)!
  await cumCell.find('span').trigger('click')

  const input = cumCell.find('input')
  expect(input.exists()).toBe(true)
  expect((input.element as HTMLInputElement).value).toBe('100000')

  await input.setValue('120000')
  await input.trigger('keyup.enter')

  expect(wrapper.emitted('update-anchor')).toEqual([[202601, 120000]])
})

it('编辑累计值后清空表示移除锚点', async () => {
  const wrapper = mount(MonthlyTable, {
    props: {
      results: [
        createResult({
          month: 202601,
          cumSavings: 100000,
          isAnchor: true,
        }),
      ],
    },
  })

  const cumCell = wrapper.findAll('tbody td').at(-1)!
  await cumCell.find('span').trigger('click')

  const input = cumCell.find('input')
  await input.setValue('')
  await input.trigger('keyup.enter')

  expect(wrapper.emitted('remove-anchor')).toEqual([[202601]])
})

it('编辑累计值按 Escape 取消编辑', async () => {
  const wrapper = mount(MonthlyTable, {
    props: {
      results: [
        createResult({
          month: 202601,
          cumSavings: 100000,
        }),
      ],
    },
  })

  const cumCell = wrapper.findAll('tbody td').at(-1)!
  await cumCell.find('span').trigger('click')

  const input = cumCell.find('input')
  await input.setValue('999999')
  await input.trigger('keyup.escape')

  expect(input.exists()).toBe(false)
  expect(wrapper.emitted('update-anchor')).toBeUndefined()
})

it('hover 累计值显示公式弹窗', async () => {
  const wrapper = mount(MonthlyTable, {
    props: {
      results: [
        createResult({
          month: 202601,
          totalIncome: 12000,
          totalExpense: 3000,
          investReturn: 125,
          netSavings: 9125,
          cumSavings: 109125,
        }),
      ],
    },
  })

  const cumCell = wrapper.findAll('tbody td').at(-1)!
  await cumCell.find('span').trigger('mouseenter', { clientX: 100, clientY: 120 })

  expect(wrapper.text()).toContain('累计储蓄')
  expect(wrapper.text()).toContain('累计储蓄 = 上月累计 + 当月净储蓄(9,125)')

  await cumCell.find('span').trigger('mouseleave')
  expect(wrapper.text()).not.toContain('累计储蓄 = 上月累计')
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/components/MonthlyTable.spec.ts`
Expected: FAIL — span 不存在 / input 不存在 / emit 不存在

- [ ] **Step 3: 实现 MonthlyTable 累计列可编辑**

替换 `src/components/MonthlyTable.vue` 中累计列 `<td>`（第 139-153 行）为：

```vue
<td
  class="px-1 py-0 text-right tabular-nums font-bold whitespace-nowrap"
  :class="{ 'text-red-600': result.cumSavings < 0 }"
>
  <input
    v-if="editingMonth === result.month"
    ref="editInput"
    type="number"
    class="w-full h-full border rounded px-1 text-right text-[11px]"
    :value="editValue"
    @input="editValue = ($event.target as HTMLInputElement).value"
    @keyup.enter="confirmEdit(result.month)"
    @keyup.escape="cancelEdit"
    @blur="confirmEdit(result.month)"
  />
  <span
    v-else
    class="block w-full cursor-pointer text-right"
    :aria-label="`编辑 ${formatMonth(result.month)} 累计储蓄`"
    @click="startEdit(result)"
    @mouseenter="showFormula(result, 'cumSavings', $event)"
    @mouseleave="popover = null"
  >
    {{ formatCurrency(result.cumSavings) }}
  </span>
</td>
```

在 `<script setup>` 中添加：

```typescript
import { nextTick } from 'vue'

const emit = defineEmits<{
  'update-anchor': [month: number, value: number]
  'remove-anchor': [month: number]
}>()

const editingMonth = ref<number | null>(null)
const editValue = ref<string>('')
const editInput = ref<HTMLInputElement | null>(null)

function startEdit(result: MonthResult) {
  editingMonth.value = result.month
  editValue.value = String(result.cumSavings)
  nextTick(() => {
    editInput.value?.select()
  })
}

function confirmEdit(month: number) {
  const trimmed = editValue.value.trim()
  if (trimmed === '') {
    emit('remove-anchor', month)
  } else {
    const num = Number(trimmed)
    if (Number.isFinite(num)) {
      emit('update-anchor', month, num)
    }
  }
  editingMonth.value = null
}

function cancelEdit() {
  editingMonth.value = null
}
```

同时将理财和净储蓄列的公式按钮保持 click 触发不变（只有累计列改为 hover）。

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/components/MonthlyTable.spec.ts`
Expected: PASS

- [ ] **Step 5: 更新已有测试适配新结构**

原有测试中 `buttons` 数量从 3 变为 2（累计列不再是 button），需更新 `通过公式按钮展示弹窗并提供可访问标签` 和 `鼠标离开公式按钮时关闭弹窗` 测试：

```typescript
// 修改 '通过公式按钮展示弹窗并提供可访问标签' 测试
// buttons 现在只有 2 个（理财、净储蓄）
const buttons = wrapper.findAll('tbody button')
expect(buttons).toHaveLength(2)
expect(buttons.map((button) => button.attributes('aria-label'))).toEqual([
  '查看 2026-01 理财收益公式',
  '查看 2026-01 净储蓄公式',
])
// 移除 buttons[2] 相关的 cumSavings 公式断言
```

- [ ] **Step 6: 运行全部测试确认通过**

Run: `npx vitest run tests/components/MonthlyTable.spec.ts`
Expected: ALL PASS

- [ ] **Step 7: 提交**

```bash
git add src/components/MonthlyTable.vue tests/components/MonthlyTable.spec.ts
git commit -m "feat: 累计列支持点击编辑，公式弹窗改为 hover 触发"
```

---

### Task 2: 父组件接入编辑事件

**Files:**
- Modify: `src/App.vue`（或使用 MonthlyTable 的父组件）
- Test: `tests/App.spec.ts`

- [ ] **Step 1: 查看 App.vue 中 MonthlyTable 的使用方式**

找到 MonthlyTable 的父组件，确认如何传 results prop。

- [ ] **Step 2: 在父组件中监听 update-anchor / remove-anchor 事件**

```vue
<MonthlyTable
  :results="results"
  @update-anchor="addAnchor"
  @remove-anchor="removeAnchor"
/>
```

确保从 `useStore()` 解构出 `addAnchor` 和 `removeAnchor`。

- [ ] **Step 3: 运行全部测试**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 4: 提交**

```bash
git add src/App.vue
git commit -m "feat: App 接入累计列编辑事件调用 addAnchor/removeAnchor"
```

---

### Task 3: 移除 ParamPanel 月度锚点管理 UI

**Files:**
- Modify: `src/components/ParamPanel.vue`
- Modify: `tests/components/ParamPanel.spec.ts`

- [ ] **Step 1: 删除 ParamPanel 中锚点管理区域**

删除 `src/components/ParamPanel.vue` 第 112-160 行的 `<section>` 整块（月度锚点标题、列表、添加表单）。

同时从 `<script setup>` 中删除：
- `import { formatCurrency }` （如果没有其他用途）
- `import { formatMonth }` （如果没有其他用途）
- `const { ..., addAnchor, removeAnchor } = useStore()` 中的 `addAnchor, removeAnchor`
- `const newAnchorMonth` 和 `const newAnchorValue`
- `isValidAnchorMonth` 函数
- `doAddAnchor` 函数

- [ ] **Step 2: 删除 ParamPanel 测试中锚点相关用例**

删除 `tests/components/ParamPanel.spec.ts` 中以下测试：
- `展示、删除并新增月度锚点`
- `新增月度锚点时允许金额为 0`
- `新增月度锚点时忽略非法月份`

- [ ] **Step 3: 运行测试**

Run: `npx vitest run tests/components/ParamPanel.spec.ts`
Expected: ALL PASS

- [ ] **Step 4: 运行全部测试确认无回归**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 5: 提交**

```bash
git add src/components/ParamPanel.vue tests/components/ParamPanel.spec.ts
git commit -m "refactor: 移除 ParamPanel 月度锚点管理 UI"
```

---

### Task 4: 端到端验证

- [ ] **Step 1: 启动 dev server 在浏览器中验证**

Run: `npm run dev`

验证：
1. 点击某月累计值 → 出现 input
2. 修改值后回车 → 该行变蓝，后续月份重新计算
3. 清空值后回车 → 蓝色消失，恢复自动计算
4. hover 累计值 → 显示公式弹窗
5. ParamPanel 中不再有锚点管理区域

- [ ] **Step 2: 全部测试通过**

Run: `npx vitest run`
Expected: ALL PASS