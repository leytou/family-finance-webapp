# 撤销 / 重做功能设计

## 概述

为家庭财务规划应用添加工作区级别的撤销（Undo）/重做（Redo）能力。核心动机见 `docs/2026-06-12-功能补充与完善建议.md` 第 3 条：财务数据误删风险高（如右键「清除下方编辑值」可一次清掉几十个手填值），而目前零 Undo。本设计让任何数据修改都能回退，包括删除列、清空编辑值、修改系统参数等。

## 关键决策（已与用户确认）

| 决策点 | 选择 |
|--------|------|
| 历史范围 | **全局统一历史栈**——整个工作区一份快照序列，含 `activeId`。撤销时若目标快照的激活方案与当前不同，整体替换 `workspace` 后自然「跳转」到改动发生的那份计划 |
| 撤销粒度 | **合并连续编辑为一步**——500ms 防抖捕获，同一输入框连按数键只算一个撤销步 |
| 历史持久化 | **仅内存**——刷新/关闭页面后清空（数据本身仍由 localStorage 保存，不会丢失） |
| 实现方案 | **方案 A：快照法（Memento）**——见下 |

## 方案选择

**方案 A：快照法（Memento）**——在已有的 `watch(sharedWorkspace, {deep})` 模式上挂一个防抖快照捕获，每次状态变化后 500ms 内无新变化，就把整个工作区 `JSON.stringify` 成一份快照压入历史栈；撤销/重做 = 取出某份快照 `JSON.parse` 后整体替换 `workspace`。

选择理由：
- **覆盖一切修改**：store 函数（`addColumn`/`updateColumnEntry`/`syncYearly`/`reset`…）**和**绕过 store 的直接 v-model（年化收益率 `@input`、初始存款 `v-model.number`）**统一**进栈，零遗漏。
- **几乎零改动现有代码**：项目本就在每次变化时序列化整个工作区（存盘 watcher），这是其自然延伸。
- 合并粒度天然由防抖实现，无需逐 mutation 特判。
- 状态体量小（通常 < 50KB），50 步 ≈ 2.5MB 常驻内存（非持久化），完全可接受。

被否决的方案：
- **命令模式（Command）**：要把十几个 store mutation 全部重构成可逆命令，还要改 header 里绕过 store 的 `@input`/`v-model`，改动面大、易漏、风险高，对个人财务工具严重过度设计。
- **差量补丁（Immer patches / JSON diff）**：省内存但需引入依赖或自写 diff，而内存在此量级根本不是瓶颈，YAGNI。

## 架构与组件结构

### 新增文件

| 文件 | 职责 |
|------|------|
| `src/composables/useHistory.ts` | 撤销/重做的全部状态与逻辑（单一职责，与 `useStore` 解耦） |
| `tests/composables/useHistory.spec.ts` | 历史栈单元测试 |

### 修改文件

| 文件 | 改动 |
|------|------|
| `src/App.vue` | 引入 `useHistory`，加全局键盘监听 + 撤销/重做按钮；调整重置确认文案 |
| `src/composables/useStore.ts` | `handleReset` 对应的确认文案（在 App.vue）；`reset()` 本身当普通编辑即可，无需改动 |

`useStore.ts` **核心逻辑不动**——这是方案 A 的核心优势。

## 核心数据模型：三段式快照栈

`useHistory` 持有模块级单例状态（与 `useStore` 的 `sharedWorkspace` 同构，都是模块单例）：

```typescript
const past: Ref<string[]>   = ref([])   // 可撤销的旧状态快照（栈顶 = 最近）
const future: Ref<string[]> = ref([])   // 可重做的状态快照（redo 用）
let   lastSnapshot: string              // 上一次「落盘」的检查点快照（= 当前状态的基准）
```

用 `Ref<string[]>` 而非普通数组，是为了让 `canUndo`/`canRedo`（computed）能响应 `past`/`future` 长度变化，驱动按钮 disabled 态。

### 关键洞察：不需要 suppress 标志

`capture()` 本身有 `if (current === lastSnapshot) return` 的相等守卫。而 undo/redo 时会把 `lastSnapshot` 设成「即将恢复的状态」，于是恢复触发的 watch 最终捕获时 `current === lastSnapshot`，自动跳过。这与项目已有的 `resetSnapshot` 守卫思路一致，且与 Vue 的异步 flush 时序无关——**无竞态**。

## 数据流

### ① 捕获（防抖 500ms，实现「合并连续编辑」）

`useHistory` 在 `workspace` 上挂一个 `{deep:true}` 的 watch（独立于 `useStore` 的存盘 watch，两个 deep watch 共存无冲突）：

```
workspace 变化
  → watch 触发（若非恢复引发的）
  → 清除旧 capture 定时器
  → 500ms 内无新变化 → 执行 capture()

capture():
  current = JSON.stringify(workspace.value)
  if (current === lastSnapshot) return       // 无变化或恢复引发，跳过
  past.push(lastSnapshot)                     // 把「上一个检查点」压入可撤销栈
  if (past.length > MAX_HISTORY) past.shift() // 超限丢弃最旧（FIFO）
  lastSnapshot = current                      // 更新检查点
  future.length = 0                           // 新编辑作废重做栈
```

### ② 撤销

```
undo():
  flushPendingCapture()                  // 先把未落盘的编辑捕获，避免丢失
  if (past.value 为空) return             // 空栈 no-op
  prev = past.value.pop()
  future.value.push(lastSnapshot)        // 当前状态存入重做栈
  lastSnapshot = prev                     // 检查点 = 即将恢复的状态（让相等守卫生效）
  workspace.value = JSON.parse(prev)     // 整体替换，含 activeId → 自动跳转方案
```

### ③ 重做（对称）

```
redo():
  if (future.value 为空) return
  next = future.value.pop()
  past.value.push(lastSnapshot)
  lastSnapshot = next
  workspace.value = JSON.parse(next)
```

### ④ 初始化

`useHistory` 首次调用时 `lastSnapshot = JSON.stringify(workspace.value)`（加载态作为基线），`past`/`future` 为空。→ 首次编辑后，可一直 undo 回「刚加载时的样子」。

### ⑤ 存盘协调

恢复 `workspace.value` 会触发 `useStore` 既有的存盘 watch（300ms 防抖），把恢复后的状态写入 localStorage——这正是期望行为（屏上状态 = 持久化状态）。`resetSnapshot` 守卫不干扰（undo/redo 期间它为 null）。

### 暴露的 API

```typescript
function useHistory() {
  return {
    undo: () => void,
    redo: () => void,
    canUndo: ComputedRef<boolean>,   // past.value.length > 0，驱动按钮 disabled
    canRedo: ComputedRef<boolean>,   // future.value.length > 0
    resetHistory: (workspaceJson: string) => void,  // 导入钩子，见边界行为 ②
  }
}
```

## 边界行为

### ① 重置（`reset()`）——可撤销

把 `reset()` 当成普通编辑：捕获重置前状态进历史栈，执行重置。用户后悔了能 Ctrl+Z 找回。

- `App.vue` 的 `handleReset` 确认文案由 `「确定要重置当前方案？此操作不可撤销。」` 改为 `「确定要重置当前方案？」`（删掉「不可撤销」，保留二次确认，因重置仍是破坏性操作）。
- `reset()` 里现有的 `resetSnapshot` 守卫保留（只影响存盘去重，不影响历史）。

### ② 导入数据——清空历史（预留钩子）

导入会整体替换工作区。导入后历史从新数据起步：`resetHistory(workspaceJson)` 把 `lastSnapshot` 重置为导入态、`past`/`future` 清空。

- 导入功能（`feat-data-export-import` worktree）尚未合入 master，本期**不实现导入**，只在 `useHistory` 暴露 `resetHistory()` 钩子，供将来 `useFileIO` 导入成功后调用。

### ③ 多方案自动跳转（由架构保证）

每条快照含 `activeId`，恢复时整体替换 `workspace.value`，激活方案自然切到「改动发生的那份计划」。切换方案本身也改 `activeId`，会进历史——符合「全局统一历史栈」语义。

### ④ 输入框聚焦时按 Ctrl+Z——先失焦提交再撤销

单元格/列头/header 输入框都是失焦提交。快捷键处理器先 `document.activeElement?.blur()`（触发 `confirmEditCell` 等提交），再 `undo()`/`redo()`。进行中的编辑不丢失，且作为一步进入历史。

### ⑤ 其他既定行为

- **历史上限 50 步**：超限丢弃最旧（FIFO）。50 × ~50KB ≈ 2.5MB 常驻内存，可接受。
- **新编辑作废重做栈**：undo 几步后若做了新编辑，`future` 清空（标准行为）。
- **空栈 no-op**：`past` 空时 undo、`future` 空时 redo 都直接返回。

## UI 与交互

### 键盘快捷键

全局 `keydown` 监听（挂在 `App.vue` 的 `onMounted`/`onUnmounted`，让 `useHistory` 保持纯逻辑、不碰 DOM）：

| 快捷键 | 动作 |
|--------|------|
| `Ctrl+Z` / `⌘+Z` | 撤销 |
| `Ctrl+Shift+Z` / `⌘+Shift+Z` / `Ctrl+Y` | 重做 |

处理逻辑：
1. 命中快捷键 → `preventDefault()`（拦截浏览器原生 input 撤销，用工作区级撤销）。
2. 先 `document.activeElement?.blur()`（进行中编辑失焦提交），再 `undo()`/`redo()`。
3. 无修饰键或其它组合 → 放行，不影响正常输入。

### 按钮（header 工具栏）

在 header 右侧工具区加一组**始终可见**的撤销/重做按钮（高频操作不藏菜单）：

```
… 起始月份 | 年化收益率 | 初始存款 | [↶撤销] [↷重做] | 重置 | 对比
```

- `↶撤销` 按钮：`disabled` 绑定 `!canUndo`，禁用时置灰、`cursor-not-allowed`。
- `↷重做` 按钮：`disabled` 绑定 `!canRedo`，同上。
- 两者 `title` 标注快捷键（`撤销 (Ctrl+Z)` / `重做 (Ctrl+Shift+Z)`）。
- 点击同样先 blur 再 undo/redo（与快捷键一致）。
- 样式沿用现有 `重置`/`对比` 按钮 class（`px-3 py-1 border rounded text-sm hover:bg-gray-50` + `disabled:` 变体）。

**关于「⋯ 更多」菜单**：进行中的 `feat-data-export-import` 会把 `重置/导出/导入` 收进「⋯」下拉。本期撤销/重做按钮**保持顶栏显式**，不进菜单；将来若 header 过挤再讨论是否并入。两条 feature 不冲突。

## 错误处理

| 场景 | 处理方式 |
|------|---------|
| `JSON.parse` 恢复失败 | 理论上不会发生（快照均来自 `JSON.stringify` 的合法产物）；若极端情况下抛错，交由调用方 try/catch，历史栈保持不变，不影响当前数据 |
| undo/redo 触发的存盘 | 由既有 300ms 防抖存盘处理，屏上状态自动落盘 |
| 刷新页面 | 历史栈清空（仅内存设计）；数据本身已存 localStorage，不会丢失 |

## 测试策略

### 单元测试 `tests/composables/useHistory.spec.ts`（核心）

沿用 `useStore.spec.ts` 的隔离方式：`vi.resetModules()` + 动态 `import()` 重置模块单例、`localStorage.clear()`、`vi.useFakeTimers()`。新增 `flushCapture()` helper：`await vi.advanceTimersByTimeAsync(500)` 驱动 500ms 捕获防抖。

**捕获与合并**
1. 单次编辑 → 500ms 后 `past.value.length === 1`
2. 连续快速编辑同一字段（间隔 < 500ms）→ 合并为 **1** 步
3. 间隔 > 500ms 的两次编辑 → **2** 步

**撤销/重做**
4. 改 `annualRate` → undo → 值还原
5. 连续多步 undo 逐级回退
6. redo 恢复
7. undo 后做**新编辑** → `future` 清空、redo 变 no-op
8. `past` 空 → undo no-op、不抛错
9. `future` 空 → redo no-op
10. 可一直 undo 回「加载基线态」

**多方案跳转（核心诉求）**
11. 编辑方案 A → `switchScenario(B)` → undo → 断言 `workspace.activeId === 'A'`（撤销了那次切换，整体替换含 activeId，实现「跳回 A」）

**边界**
12. 编辑 > 50 次（每次间隔 > 500ms）→ `past.value.length` 恒 ≤ 50，最旧被丢弃，仍可 undo
13. `resetHistory(json)`（导入钩子）→ past/future 清空、`lastSnapshot === json`

### 集成测试（轻量，可选）

在 `App.spec.ts` 增一例：挂载 App → 模拟 `Ctrl+Z` keydown → 断言状态回退。验证快捷键 + DOM 接线；按钮的 disabled 态用 `@vue/test-utils` 断言 `canUndo=false` 时按钮 `disabled`。

### 手动验证清单

- 单元测试全绿（`npm run test`）
- 输入框连打 → 一次 undo 回退
- 删除列 → undo 找回
- `clearEditedBelow` 清几十格 → undo 全恢复
- 切换方案后 undo 自动跳回原方案
- 重置后 undo 找回（验证「可撤销」）
