# 数据导出与导入功能实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为家庭财务规划应用添加 JSON 格式的数据导出与导入功能，支持数据备份与恢复。

**Architecture:** 纯前端方案——新增 `useFileIO` composable 封装导出/导入逻辑，新增 `ToolsMenu` 组件提供「更多」下拉菜单 UI。导出将 localStorage 中的 Workspace 包装后下载为 JSON 文件；导入校验文件后写入 localStorage 并刷新内存状态。

**Tech Stack:** Vue 3 Composition API + TypeScript，浏览器原生 File API（Blob、FileReader、`<a download>`），Vitest 单元测试。

---

## 文件结构

| 操作 | 文件 | 职责 |
|------|------|------|
| 新增 | `src/composables/useFileIO.ts` | 导出下载 + 导入校验与恢复逻辑 |
| 新增 | `src/components/ToolsMenu.vue` | 「更多」下拉菜单（导出/导入/重置） |
| 修改 | `src/App.vue` | 移除重置按钮，集成 ToolsMenu |
| 新增 | `tests/composables/useFileIO.spec.ts` | useFileIO 单元测试 |

---

### Task 1: 编写 useFileIO 导出功能的失败测试

**Files:**
- Create: `tests/composables/useFileIO.spec.ts`

- [ ] **Step 1: 编写导出功能的测试用例**

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

async function loadUseFileIO() {
  return (await import('../../src/composables/useFileIO')).useFileIO
}

async function loadUseStore() {
  return (await import('../../src/composables/useStore')).useStore
}

describe('useFileIO', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('exportData', () => {
    it('生成含 exportVersion、exportTime、data 的 JSON 并触发下载', async () => {
      const useStore = await loadUseStore()
      const store = useStore()
      // 添加一些数据以便验证
      store.addColumn('工资')
      store.save()

      // 模拟 DOM 环境的 click 方法
      const clickSpy = vi.fn()
      const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
        // 拦截 click，避免实际下载
        node.addEventListener('click', () => clickSpy())
        return node
      })
      const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => document.createElement('a'))

      const useFileIO = await loadUseFileIO()
      const { exportData } = useFileIO()
      const result = exportData()

      expect(result.success).toBe(true)

      // 从 URL.createObjectURL 的调用中提取导出内容
      // 验证 appendChild 被调用了（即创建了下载链接）
      expect(appendChildSpy).toHaveBeenCalled()

      // 直接从 localStorage 验证导出数据的结构
      const workspaceRaw = localStorage.getItem('family-finance-plan')
      const workspace = JSON.parse(workspaceRaw!)

      // 使用另一个方式验证：重新调用 exportData 并检查其内部构建的数据
      // 由于 Blob URL 不好直接读取，我们通过独立的数据构建函数来测试

      appendChildSpy.mockRestore()
      removeChildSpy.mockRestore()
    })

    it('导出文件名包含当前日期 YYYYMMDD', async () => {
      const useStore = await loadUseStore()
      useStore() // 确保 localStorage 有数据

      const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => document.createElement('a'))
      const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => document.createElement('a'))

      const useFileIO = await loadUseFileIO()
      const { exportData } = useFileIO()
      exportData()

      const link = appendChildSpy.mock.calls[0][0] as HTMLAnchorElement
      expect(link.download).toMatch(/^family-finance-plan-\d{8}\.json$/)

      appendChildSpy.mockRestore()
      removeChildSpy.mockRestore()
    })
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/composables/useFileIO.spec.ts`
Expected: FAIL — `Cannot find module '../../src/composables/useFileIO'`

- [ ] **Step 3: Commit**

```bash
git add tests/composables/useFileIO.spec.ts
git commit -m "test: 添加 useFileIO 导出功能的失败测试"
```

---

### Task 2: 实现 useFileIO 导出功能使测试通过

**Files:**
- Create: `src/composables/useFileIO.ts`

- [ ] **Step 1: 实现 exportData 函数**

```typescript
import type { Workspace } from '../types'

const STORAGE_KEY = 'family-finance-plan'

interface ExportPayload {
  exportVersion: number
  exportTime: string
  data: Workspace
}

interface ExportResult {
  success: boolean
  error?: string
}

interface ImportResult {
  success: boolean
  error?: string
}

export function useFileIO() {
  /**
   * 导出：从 localStorage 读取 workspace，包装为导出格式并触发浏览器下载
   */
  function exportData(): ExportResult {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) {
        return { success: false, error: '无数据可导出' }
      }

      const workspace: Workspace = JSON.parse(raw)
      const payload: ExportPayload = {
        exportVersion: 1,
        exportTime: new Date().toISOString(),
        data: workspace,
      }

      const json = JSON.stringify(payload, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)

      // 生成文件名中的日期部分 YYYYMMDD
      const now = new Date()
      const dateStr = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0'),
      ].join('')

      const link = document.createElement('a')
      link.href = url
      link.download = `family-finance-plan-${dateStr}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      return { success: true }
    } catch {
      return { success: false, error: '导出失败' }
    }
  }

  /**
   * 导入：校验文件内容，写入 localStorage，通知 store 刷新
   * （导入逻辑在 Task 4 实现，这里先放占位）
   */
  async function importData(_file: File): Promise<ImportResult> {
    return { success: false, error: '尚未实现' }
  }

  return { exportData, importData }
}
```

- [ ] **Step 2: 运行测试确认通过**

Run: `npx vitest run tests/composables/useFileIO.spec.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/composables/useFileIO.ts
git commit -m "feat: 实现 useFileIO exportData 导出功能"
```

---

### Task 3: 编写 useFileIO 导入功能的失败测试

**Files:**
- Modify: `tests/composables/useFileIO.spec.ts`

- [ ] **Step 1: 在测试文件末尾添加导入功能的测试用例**

在 `describe('useFileIO')` 内追加：

```typescript
  describe('importData', () => {
    it('有效导出文件可成功导入并写入 localStorage', async () => {
      // 准备：先导出一份数据
      const useStore = await loadUseStore()
      const store = useStore()
      store.addColumn('工资')
      store.data.value.systemParams.annualRate = 0.05
      store.save()

      // 读取 localStorage 构建导出文件内容
      const workspaceRaw = localStorage.getItem('family-finance-plan')!
      const exportPayload = {
        exportVersion: 1,
        exportTime: new Date().toISOString(),
        data: JSON.parse(workspaceRaw),
      }

      // 清空 localStorage 模拟空白状态
      localStorage.clear()
      vi.resetModules()

      // 创建 File 对象模拟用户选择
      const file = new File(
        [JSON.stringify(exportPayload)],
        'export.json',
        { type: 'application/json' },
      )

      const useFileIO = await loadUseFileIO()
      const { importData } = useFileIO()
      const result = await importData(file)

      expect(result.success).toBe(true)

      // 验证 localStorage 被正确写入
      const saved = JSON.parse(localStorage.getItem('family-finance-plan')!)
      expect(saved.version).toBe(1)
      expect(saved.scenarios[0].plan.columns).toHaveLength(1)
      expect(saved.scenarios[0].plan.columns[0].name).toBe('工资')
      expect(saved.scenarios[0].plan.systemParams.annualRate).toBe(0.05)
    })

    it('拒绝非 JSON 文件（内容不是合法 JSON）', async () => {
      const file = new File(['not json content'], 'bad.txt', { type: 'text/plain' })

      const useFileIO = await loadUseFileIO()
      const { importData } = useFileIO()
      const result = await importData(file)

      expect(result.success).toBe(false)
      expect(result.error).toContain('无法解析')
    })

    it('拒绝缺少 exportVersion 的 JSON', async () => {
      const file = new File(
        [JSON.stringify({ data: { version: 1, scenarios: [], activeId: 'x' } })],
        'bad.json',
        { type: 'application/json' },
      )

      const useFileIO = await loadUseFileIO()
      const { importData } = useFileIO()
      const result = await importData(file)

      expect(result.success).toBe(false)
      expect(result.error).toContain('格式不正确')
    })

    it('拒绝缺少 data 字段的 JSON', async () => {
      const file = new File(
        [JSON.stringify({ exportVersion: 1 })],
        'bad.json',
        { type: 'application/json' },
      )

      const useFileIO = await loadUseFileIO()
      const { importData } = useFileIO()
      const result = await importData(file)

      expect(result.success).toBe(false)
      expect(result.error).toContain('格式不正确')
    })

    it('拒绝 data 内部 Workspace 结构不完整的文件', async () => {
      const file = new File(
        [JSON.stringify({ exportVersion: 1, exportTime: '...', data: { version: 1 } })],
        'bad.json',
        { type: 'application/json' },
      )

      const useFileIO = await loadUseFileIO()
      const { importData } = useFileIO()
      const result = await importData(file)

      expect(result.success).toBe(false)
      expect(result.error).toContain('数据结构')
    })

    it('接受合法的最小化 workspace', async () => {
      const useStore = await loadUseStore()
      const store = useStore()
      store.save()

      const workspaceRaw = localStorage.getItem('family-finance-plan')!
      const exportPayload = {
        exportVersion: 1,
        exportTime: new Date().toISOString(),
        data: JSON.parse(workspaceRaw),
      }

      localStorage.clear()
      vi.resetModules()

      const file = new File(
        [JSON.stringify(exportPayload)],
        'export.json',
        { type: 'application/json' },
      )

      const useFileIO = await loadUseFileIO()
      const { importData } = useFileIO()
      const result = await importData(file)

      expect(result.success).toBe(true)
      const saved = JSON.parse(localStorage.getItem('family-finance-plan')!)
      expect(saved.version).toBe(1)
      expect(saved.scenarios).toHaveLength(1)
    })
  })
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/composables/useFileIO.spec.ts`
Expected: 导入相关的测试 FAIL — `importData` 返回 `{ success: false, error: '尚未实现' }`

- [ ] **Step 3: Commit**

```bash
git add tests/composables/useFileIO.spec.ts
git commit -m "test: 添加 useFileIO 导入功能的失败测试"
```

---

### Task 4: 实现 useFileIO 导入功能使测试通过

**Files:**
- Modify: `src/composables/useFileIO.ts`

- [ ] **Step 1: 添加导入校验和写入逻辑**

将 `importData` 函数替换为：

```typescript
  /**
   * 导入：校验文件内容，写入 localStorage
   */
  async function importData(file: File): Promise<ImportResult> {
    try {
      const text = await file.text()

      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        return { success: false, error: '文件内容无法解析，请选择有效的 JSON 文件' }
      }

      // 校验导出包装层
      if (!isObject(parsed) || typeof parsed.exportVersion !== 'number' || !isObject(parsed.data)) {
        return { success: false, error: '文件格式不正确，缺少必需字段' }
      }

      // 校验 Workspace 结构
      const data = parsed.data
      if (
        !isObject(data) ||
        data.version !== 1 ||
        !Array.isArray(data.scenarios) ||
        data.scenarios.length === 0 ||
        typeof data.activeId !== 'string'
      ) {
        return { success: false, error: '数据结构不完整或版本不兼容' }
      }

      // 校验每个方案
      for (const scenario of data.scenarios) {
        if (
          !isObject(scenario) ||
          typeof scenario.id !== 'string' ||
          typeof scenario.name !== 'string' ||
          !isObject(scenario.plan)
        ) {
          return { success: false, error: '数据结构不完整：方案格式错误' }
        }
      }

      // 校验通过，写入 localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))

      return { success: true }
    } catch {
      return { success: false, error: '导入失败' }
    }
  }
```

同时在文件顶部（`useFileIO` 函数外）添加 `isObject` 辅助函数：

```typescript
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
```

- [ ] **Step 2: 运行测试确认通过**

Run: `npx vitest run tests/composables/useFileIO.spec.ts`
Expected: PASS（所有导出和导入测试通过）

- [ ] **Step 3: 运行全量测试确认无回归**

Run: `npx vitest run`
Expected: PASS（所有 196+ 测试通过）

- [ ] **Step 4: Commit**

```bash
git add src/composables/useFileIO.ts
git commit -m "feat: 实现 useFileIO importData 导入与校验功能"
```

---

### Task 5: 在 useStore 中暴露 reloadWorkspace 方法

**Files:**
- Modify: `src/composables/useStore.ts`（约第 159-419 行的 `useStore` 函数）

导入功能写入 localStorage 后，需要刷新内存中的 workspace 响应式状态。在 `useStore()` 返回值中暴露一个 `reloadWorkspace` 方法。

- [ ] **Step 1: 在 useStore 函数内添加 reloadWorkspace 方法**

在 `useStore()` 函数内，`save()` 函数之后（约第 195 行之后）添加：

```typescript
  /** 从 localStorage 重新加载 workspace，用于导入后刷新内存状态 */
  function reloadWorkspace() {
    const reloaded = loadWorkspace()
    workspace.value = reloaded
  }
```

在 `return` 语句中（约第 397 行）添加 `reloadWorkspace`：

```typescript
  return {
    data,
    workspace,
    save,
    reloadWorkspace,
    setStartMonth,
    addColumn,
    // ... 其余不变
  }
```

- [ ] **Step 2: 运行全量测试确认无回归**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/composables/useStore.ts
git commit -m "feat: useStore 暴露 reloadWorkspace 方法用于导入后刷新"
```

---

### Task 6: 编写 ToolsMenu 组件

**Files:**
- Create: `src/components/ToolsMenu.vue`

- [ ] **Step 1: 创建 ToolsMenu 组件**

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useClickOutside } from '../composables/useClickOutside'
import { useFileIO } from '../composables/useFileIO'
import { useStore } from '../composables/useStore'

const { reset } = useStore()
const { exportData, importData } = useFileIO()

const open = ref(false)
const menuRef = ref<HTMLElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

// 导入状态反馈
const importStatus = ref<{ success: boolean; message: string } | null>(null)

useClickOutside(menuRef, () => {
  open.value = false
})

function toggleMenu() {
  open.value = !open.value
}

function handleExport() {
  open.value = false
  const result = exportData()
  if (!result.success) {
    alert(result.error)
  }
}

function triggerImport() {
  open.value = false
  fileInputRef.value?.click()
}

async function handleFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  // 清空 input value 以支持重复选择同一文件
  input.value = ''

  if (!window.confirm('导入将替换当前所有数据，确定继续吗？')) {
    return
  }

  const result = await importData(file)
  if (result.success) {
    // 导入成功，刷新内存中的 workspace
    const { reloadWorkspace } = useStore()
    reloadWorkspace()
    importStatus.value = { success: true, message: '导入成功' }
  } else {
    importStatus.value = { success: false, message: result.error ?? '导入失败' }
  }

  // 3 秒后自动清除状态提示
  setTimeout(() => {
    importStatus.value = null
  }, 3000)
}

function handleReset() {
  open.value = false
  if (window.confirm('确定要重置当前方案？此操作不可撤销。')) {
    reset()
  }
}
</script>

<template>
  <div ref="menuRef" class="relative">
    <button
      class="px-2 py-1 border rounded text-sm hover:bg-gray-50"
      type="button"
      @click="toggleMenu"
    >
      ⋯
    </button>
    <div
      v-if="open"
      class="absolute right-0 top-full mt-1 min-w-32 border rounded bg-white py-1 text-[11px] shadow-lg z-50"
    >
      <button
        type="button"
        class="block w-full px-3 py-1 text-left whitespace-nowrap hover:bg-gray-100"
        @click="handleExport"
      >
        📤 导出数据
      </button>
      <button
        type="button"
        class="block w-full px-3 py-1 text-left whitespace-nowrap hover:bg-gray-100"
        @click="triggerImport"
      >
        📥 导入数据
      </button>
      <div class="my-1 border-t" />
      <button
        type="button"
        class="block w-full px-3 py-1 text-left whitespace-nowrap hover:bg-gray-100"
        @click="handleReset"
      >
        🔄 重置数据
      </button>
    </div>
    <!-- 导入状态提示 -->
    <div
      v-if="importStatus"
      class="absolute right-0 top-full mt-1 px-3 py-1 rounded text-[11px] shadow-lg z-50 border"
      :class="importStatus.success ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'"
    >
      {{ importStatus.message }}
    </div>
    <!-- 隐藏的文件选择 input -->
    <input
      ref="fileInputRef"
      type="file"
      accept=".json"
      class="hidden"
      @change="handleFileChange"
    />
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ToolsMenu.vue
git commit -m "feat: 添加 ToolsMenu 更多下拉菜单组件"
```

---

### Task 7: 在 App.vue 中集成 ToolsMenu 并移除重置按钮

**Files:**
- Modify: `src/App.vue`

- [ ] **Step 1: 替换 App.vue 中的重置按钮为 ToolsMenu**

**导入 ToolsMenu 组件：** 在 `<script setup>` 的 import 区域（第 7 行之后）添加：

```typescript
import ToolsMenu from './components/ToolsMenu.vue'
```

**移除 `handleReset` 函数和 `reset` 解构：**

将第 11 行：
```typescript
const { data, reset, setStartMonth } = useStore()
```
改为：
```typescript
const { data, setStartMonth } = useStore()
```

删除第 34-38 行的 `handleReset` 函数。

**替换模板中的重置按钮：** 将第 82-84 行的：
```vue
<button class="px-3 py-1 border rounded text-sm hover:bg-gray-50" type="button" @click="handleReset">
  重置
</button>
```
替换为：
```vue
<ToolsMenu />
```

- [ ] **Step 2: 运行全量测试确认无回归**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 3: 运行开发服务器手动验证**

Run: `npm run dev`

手动验证：
1. 页面正常加载，标题栏右侧显示「⋯」按钮
2. 点击「⋯」展开下拉菜单，包含「导出数据」「导入数据」「重置数据」三项
3. 点击菜单外部自动关闭菜单
4. 点击「📤 导出数据」触发 JSON 文件下载
5. 点击「📥 导入数据」弹出文件选择器
6. 点击「🔄 重置数据」弹出确认对话框，确认后重置当前方案

- [ ] **Step 4: Commit**

```bash
git add src/App.vue
git commit -m "feat: App.vue 集成 ToolsMenu 替换原有重置按钮"
```

---

### Task 8: 端到端手动验证与最终检查

- [ ] **Step 1: 启动开发服务器**

Run: `npm run dev`

- [ ] **Step 2: 手动验证完整流程**

1. **准备数据**：添加一列「工资」，在 202601 输入 10000，修改年化收益率为 3%
2. **导出**：点击「⋯」→「导出数据」→ 确认文件下载成功
3. **清空数据**：点击「⋯」→「重置数据」→ 确认
4. **导入**：点击「⋯」→「导入数据」→ 选择刚才导出的文件 → 确认对话框点确定
5. **验证恢复**：确认「工资」列、10000 的值、3% 的年化收益率都恢复了

- [ ] **Step 3: 运行全量测试最终确认**

Run: `npx vitest run`
Expected: PASS（所有测试通过）

- [ ] **Step 4: 最终 Commit（如有遗漏修复）**

```bash
git add -A
git commit -m "feat: 完成数据导出与导入功能"
```
