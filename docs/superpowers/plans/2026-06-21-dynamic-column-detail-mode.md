# 动态列明细模式 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让可拖拽的动态列（`FlowColumn`）能整体切换为"明细列"，在某月记录多笔收支、查看明细、显示合计；默认保持单值形态，切换零损失、可逆，旧数据自动迁移。

**Architecture:** 把 `FlowColumn` 的存储从"每月一个数"（`entries: Record<number, number>`）统一升级为"每月一组明细"（`itemSets: Record<number, ColumnItem[]>`），单值即"一组一笔"的特例；新增 `mode: 'single' | 'detail'` 仅控制 UI。计算层 `resolveColumnValue` 改为返回该月明细组的代数合计，下游收入/支出分流、年度汇总因只读 `amount` 正负号而无需改动。明细的编辑/查看复用专项列那套交互——抽取通用编辑器组件（默认 3 行）与通用只读明细弹窗，专项与动态列共用。切换入口挂在单元格右键菜单。

**Tech Stack:** Vue 3 (Composition API + `<script setup>`) + TypeScript + UnoCSS + Vitest（jsdom, globals）；状态 `useStore` + localStorage；计算 `useCalculation`（纯函数）。

> **Commit 约定：** 所有提交信息使用中文，并在末尾附 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`。每个 Task 末尾的 commit 命令已省略该 trailer，执行时请补上。提交只 `git add` 本 Task 涉及的文件，不要 `git add -A`（工作区可能有用户并行改动）。

> **横切改动说明：** Task 1 改 `types.ts` 后 `useStore.ts` 会编译失败、整套测试跑不起来，因此 Task 1 必须一次完成 types + 计算 + store 三处改动并跑绿后再提交，中间不提交编译不过的状态。这是类型重构的固有约束。

---

## File Structure

| 文件 | 责任 | 本计划改动 |
|---|---|---|
| `src/types.ts` | 核心类型 | 新增 `ColumnItem`；`FlowColumn.entries → itemSets` + `mode` |
| `src/composables/useCalculation.ts` | 纯函数计算 | `resolveColumnValue`/`hasColumnValue` 按组重写；新增 `resolveColumnItems` + `sumItems` |
| `src/composables/useStore.ts` | 状态 + 持久化 + 迁移 | 所有 `entries` 读写点改 `itemSets`；新增 `setColumnMode`/`replaceColumnItems`/`migrateColumn`；version 2→3 |
| `src/components/ItemEditor.vue` | 通用明细组编辑器（默认 3 行） | **新建**（取代 `EventEditor.vue`） |
| `src/components/EventEditor.vue` | 专项编辑器（旧） | **删除**（功能并入 `ItemEditor.vue`） |
| `src/components/EventDetailPopover.vue` | 只读明细弹窗 | props 泛化（`events → items` + `title`），专项与动态列复用 |
| `src/components/MonthlyTable.vue` | 月度流水表 | 动态列单元格按 `mode` 分支；明细编辑器/弹窗挂载；右键菜单加切换项 |
| `tests/composables/useCalculation.spec.ts` | 计算测试 | 数据形态 `entries→itemSets`；新增组合计/延续/`resolveColumnItems` 用例 |
| `tests/composables/useStore.spec.ts` | store 测试 | 数据形态；新增 `setColumnMode`/`replaceColumnItems`/迁移用例 |
| `tests/components/ItemEditor.spec.ts` | 编辑器测试 | **新建**（由 `EventEditor.spec.ts` 迁移 + 默认 3 行用例） |
| `tests/components/EventEditor.spec.ts` | 旧编辑器测试 | **删除** |
| `tests/components/EventDetailPopover.spec.ts` | 弹窗测试 | props 改 `items`/`title` |
| `tests/components/MonthlyTable.spec.ts` | 表格测试 | 新增明细模式交互、右键切换用例 |

---

## Task 1: 数据层升级（types + 计算 + store + 迁移）

**Files:**
- Modify: `src/types.ts:1-7`
- Modify: `src/composables/useCalculation.ts:13-81`
- Modify: `src/composables/useStore.ts`（`addColumn:315-324`、`emptyFlowColumn:428-430`、`updateColumnEntry:361-373`、`syncYearly:378-397`、`updateFundEntry:449-463`、`syncFundYearly:465-483`、`isValidColumn:52-69`、`createDefault:18`、`isValidPlanData:124`、`normalizeWorkspace:167-200`；新增 actions 与 `migrateColumn`；return 表 `620-656`）
- Modify: `tests/composables/useCalculation.spec.ts`
- Modify: `tests/composables/useStore.spec.ts`

- [ ] **Step 1: 升级类型 `src/types.ts`**

把现有 `FlowColumn`（1-7 行）替换为：

```ts
// 单笔明细（动态列专用；按月存于 FlowColumn.itemSets 一组中）
export interface ColumnItem {
  id: string
  name: string      // 可空；单值列那笔 name=''，明细列可填
  amount: number    // 元；正=收入，负=支出
}

export interface FlowColumn {
  id: string
  name: string
  itemSets: Record<number, ColumnItem[]>   // key=YYYYMM，value=该月手填明细组（单值=一组一笔）
  yearlyMonths?: Record<number, true>      // 标记月：整组只算当月、不参与往后延续
  enabled?: boolean                        // 缺省/true=启用；false=禁用（不计统计，灰显）
  mode?: 'single' | 'detail'               // 缺省/'single'=单值；'detail'=明细列（仅控制 UI）
}
```

- [ ] **Step 2: 重写计算层 `src/composables/useCalculation.ts`**

在文件顶部 import 之后、`resolveColumnValue` 之前加入两个 helper：

```ts
/** 一组明细的代数合计（正负混排求和） */
function sumItems(items: { amount: number }[] | undefined): number {
  if (!items || items.length === 0) return 0
  return items.reduce((sum, it) => sum + it.amount, 0)
}
```

把 `resolveColumnValue`（13-64 行）改为（规则不变，只是 `entries`→`itemSets`、`amount` 改为组合计）：

```ts
export function resolveColumnValue(
  column: FlowColumn,
  month: number,
): { id: string; name: string; amount: number; isEdited: boolean; enabled: boolean } {
  const enabled = column.enabled !== false

  // 规则1: 该月有手填组（含空组）→ 用其合计，标记 isEdited
  const monthKey = String(month)
  if (monthKey in column.itemSets) {
    return { id: column.id, name: column.name, amount: sumItems(column.itemSets[month]), isEdited: true, enabled }
  }

  // 规则2: 向前找最近的、未被 yearly 标记的手填月 → 沿用其整组合计
  const isYearlyKey = (k: number) => Boolean(column.yearlyMonths?.[k])
  const entryKeys = Object.keys(column.itemSets).map(Number).filter(key => key < month && !isYearlyKey(key))
  if (entryKeys.length > 0) {
    const mostRecentKey = Math.max(...entryKeys)
    return { id: column.id, name: column.name, amount: sumItems(column.itemSets[mostRecentKey]), isEdited: false, enabled }
  }

  // 规则3: 无任何手填组 → 0
  return { id: column.id, name: column.name, amount: 0, isEdited: false, enabled }
}
```

把 `hasColumnValue`（71-81 行）改为：

```ts
export function hasColumnValue(column: FlowColumn, month: number): boolean {
  if (String(month) in column.itemSets) return true
  const isYearlyKey = (k: number) => Boolean(column.yearlyMonths?.[k])
  const entryKeys = Object.keys(column.itemSets).map(Number).filter(key => key < month && !isYearlyKey(key))
  return entryKeys.length > 0
}
```

在 `hasColumnValue` 之后新增导出函数（供明细弹窗取该月生效的整组明细）：

```ts
/**
 * 解析某列在指定月「生效的整组明细」（手填组或沿用组）；无则空数组。
 * 与 resolveColumnValue 同构，但返回明细组而非合计，供只读明细弹窗使用。
 */
export function resolveColumnItems(column: FlowColumn, month: number): ColumnItem[] {
  const monthKey = String(month)
  if (monthKey in column.itemSets) return column.itemSets[month]
  const isYearlyKey = (k: number) => Boolean(column.yearlyMonths?.[k])
  const entryKeys = Object.keys(column.itemSets).map(Number).filter(key => key < month && !isYearlyKey(key))
  if (entryKeys.length > 0) return column.itemSets[Math.max(...entryKeys)]
  return []
}
```

（确认 `import type { ... ColumnItem ... } from '../types'` 已含 `ColumnItem`；若未含则补。）

- [ ] **Step 3: 重写 store 的列读写 `src/composables/useStore.ts`**

3a. `addColumn`（约 315-324 行）把 `entries: {}` 改为 `itemSets: {}`（无需显式 mode，缺省即单值）：

```ts
function addColumn(name?: string): FlowColumn {
  const column: FlowColumn = {
    id: generateId(),
    name: name ?? '新列',
    itemSets: {},
  }
  plan.columns.push(column)
  return column
}
```

3b. `emptyFlowColumn`（约 428-430 行）同样改：

```ts
function emptyFlowColumn(name: string): FlowColumn {
  return { id: generateId(), name, itemSets: {} }
}
```

3c. `updateColumnEntry`（约 361-373 行）——单值内联编辑入口，把单值存成"一笔 name='' 的组"：

```ts
function updateColumnEntry(colId: string, month: number, value: number | null): void {
  const column = plan.columns.find(col => col.id === colId)
  if (!column) return
  if (!column.itemSets) column.itemSets = {}
  if (value === null) {
    delete column.itemSets[month]
    if (column.yearlyMonths) delete column.yearlyMonths[month]
  } else {
    column.itemSets[month] = [{ id: generateId(), name: '', amount: value }]
  }
}
```

3d. 新增明细组编辑入口 `replaceColumnItems`（紧邻 `updateColumnEntry` 之后；参照 `replaceMonthEvents` 的过滤语义——名称空或金额非法的笔忽略，全空则删该月）：

```ts
function replaceColumnItems(colId: string, month: number, items: { name: string; amount: number }[]): void {
  const column = plan.columns.find(col => col.id === colId)
  if (!column) return
  if (!column.itemSets) column.itemSets = {}
  const valid = items
    .map(it => ({ name: it.name.trim(), amount: Math.round(it.amount) }))
    .filter(it => it.name !== '' && Number.isFinite(it.amount))
  if (valid.length === 0) {
    delete column.itemSets[month]
  } else {
    column.itemSets[month] = valid.map(it => ({ id: generateId(), name: it.name, amount: it.amount }))
  }
}
```

3e. 新增 `setColumnMode`（紧邻上者）：

```ts
function setColumnMode(colId: string, mode: 'single' | 'detail'): void {
  const column = plan.columns.find(col => col.id === colId)
  if (!column) return
  column.mode = mode
}
```

3f. `syncYearly`（约 378-397 行）——保留现有 `totalMonths` 循环与 `moy`/`yearlyMonths` 逻辑，仅把"读单值/写单值"换成"读模板组/写深拷贝组"：

```ts
function syncYearly(colId: string, month: number): void {
  const column = plan.columns.find(col => col.id === colId)
  if (!column) return
  const template = column.itemSets?.[month]
  if (!template) return                              // 无手填组不可同步
  if (!column.yearlyMonths) column.yearlyMonths = {}
  const moy = month % 100
  // totalMonths 沿用本函数原有计算（规划期限），保持循环边界不变
  for (let i = 0; i < totalMonths; i++) {
    const m = addMonths(plan.systemParams.startMonth, i)
    if (m % 100 === moy && m >= month) {
      column.itemSets![m] = template.map(it => ({ id: generateId(), name: it.name, amount: it.amount }))
      column.yearlyMonths[m] = true
    }
  }
}
```

> 若原 `syncYearly` 的 `totalMonths` 是来自外层闭包变量，保持原样引用即可——本步只替换循环体内读写 `entries` 的两行。执行时先读 378-397 行确认 `totalMonths` 来源，再套用上面的循环体。

3g. `updateFundEntry`（约 449-463 行）与 `syncFundYearly`（约 465-483 行）——公积金三列也是 `FlowColumn`，按 3c/3f 同构改写（`entries[month]`→单值组、`syncFundYearly`→深拷贝组）。

3h. `isValidColumn`（约 52-69 行）放宽为"接受新 `itemSets` 或旧 `entries`（迁移前）任一"：

```ts
function isValidColumn(value: unknown): boolean {
  if (!isObject(value)) return false
  const col = value as Record<string, unknown>
  if (typeof col.id !== 'string' || typeof col.name !== 'string') return false
  if (col.mode !== undefined && col.mode !== 'single' && col.mode !== 'detail') return false
  // 新格式：itemSets
  if (col.itemSets !== undefined) {
    if (!isObject(col.itemSets)) return false
    for (const key in col.itemSets) {
      if (!Number.isInteger(Number(key))) return false
      const arr = (col.itemSets as Record<string, unknown>)[key]
      if (!Array.isArray(arr)) return false
      for (const it of arr) {
        if (!isObject(it)) return false
        const item = it as Record<string, unknown>
        if (typeof item.id !== 'string' || typeof item.name !== 'string' || !isFiniteNumber(item.amount)) return false
      }
    }
    return true
  }
  // 旧格式：entries（交给 migrateColumn 转换）
  if (col.entries !== undefined) {
    if (!isObject(col.entries)) return false
    for (const key in col.entries) {
      if (!Number.isInteger(Number(key)) || !isFiniteNumber((col.entries as Record<string, number>)[key])) return false
    }
    return true
  }
  return false
}
```

3i. 新增迁移函数 `migrateColumn`（放在 `isValidColumn` 附近）：

```ts
/** 把旧 entries 结构的列升级为 itemSets（v2→v3）。幂等：已是新结构则只补 mode。 */
function migrateColumn(col: Record<string, any>): void {
  if (!col.itemSets) {
    const entries = col.entries ?? {}
    const itemSets: Record<number, ColumnItem[]> = {}
    for (const key in entries) {
      itemSets[key] = [{ id: generateId(), name: '', amount: entries[key] }]
    }
    col.itemSets = itemSets
    delete col.entries
  }
  if (col.mode === undefined) col.mode = 'single'
}
```

3j. `normalizeWorkspace`（约 167-200 行）——在现有逐字段补默认的逻辑里，对每个方案的列与公积金三列调用 `migrateColumn`，并把 plan.version 提到 3。在 normalize 末尾返回前加入：

```ts
for (const scenario of ws.scenarios) {
  for (const col of scenario.plan.columns) migrateColumn(col as Record<string, any>)
  if (scenario.plan.fund) {
    migrateColumn(scenario.plan.fund.mortgage as Record<string, any>)
    migrateColumn(scenario.plan.fund.contribution as Record<string, any>)
    migrateColumn(scenario.plan.fund.monthlyOffset as Record<string, any>)
  }
  scenario.plan.version = 3
}
```

> `ws` 是 normalizeWorkspace 内的工作对象（沿用现有变量名；执行时按 167-200 行实际命名套用）。注意 `normalizeWorkspace` 同时被"新格式直通"和"旧 PlanData 迁移"两条路径调用（loadWorkspace 211、221 行），故迁移写在这里能覆盖两种入口。

3k. version 升级：`createDefault`（约 18 行）`version: 2 → 3`；`isValidPlanData`（约 124 行）`if (value.version !== 2 && value.version !== 3) return false`。

3l. 把新增的 `setColumnMode`、`replaceColumnItems` 加入 return 表（约 620-656 行），命名与导出风格对齐现有 actions。

- [ ] **Step 4: 更新 `tests/composables/useCalculation.spec.ts`**

机械替换规则——文件中所有内联 `FlowColumn` 字面量：

```
entries: { 202601: 10000 }
```
改为：
```
itemSets: { 202601: [{ id: 'i1', name: '', amount: 10000 }] }
```

（多月份同理，每个月一个单笔组；不同列/月的 `id` 可重复使用 `'i1'`/`'i2'` 字面量，测试内不要求唯一。）

`makePlan`/`makeResult` 工厂无需改（不含 FlowColumn 字面量）。现有断言（`toEqual`/`toBe`）因合计语义不变而继续成立。

在文件末尾新增一组测试覆盖新行为：

```ts
describe('resolveColumnValue 明细组合计', () => {
  it('多笔明细取代数合计', () => {
    const column: FlowColumn = {
      id: 'col1', name: '奖金',
      itemSets: { 202601: [
        { id: 'a', name: '年终奖', amount: 8000 },
        { id: 'b', name: '红包', amount: 3000 },
      ] },
    }
    expect(resolveColumnValue(column, 202601).amount).toBe(11000)
  })

  it('正负混排按代数和归入合计', () => {
    const column: FlowColumn = {
      id: 'col1', name: '杂项',
      itemSets: { 202601: [
        { id: 'a', name: '进账', amount: 5000 },
        { id: 'b', name: '支出', amount: -2000 },
      ] },
    }
    expect(resolveColumnValue(column, 202601).amount).toBe(3000)
  })

  it('空组视为手填过：合计 0、isEdited=true', () => {
    const column: FlowColumn = { id: 'col1', name: '奖金', itemSets: { 202601: [] } }
    const r = resolveColumnValue(column, 202601)
    expect(r.amount).toBe(0)
    expect(r.isEdited).toBe(true)
  })

  it('延续整组：前月多笔，后月沿用其合计', () => {
    const column: FlowColumn = {
      id: 'col1', name: '奖金',
      itemSets: { 202601: [
        { id: 'a', name: '项目奖', amount: 5000 },
        { id: 'b', name: '加班费', amount: 3000 },
      ] },
    }
    expect(resolveColumnValue(column, 202602).amount).toBe(8000)
    expect(resolveColumnValue(column, 202602).isEdited).toBe(false)
  })

  it('yearly 月不参与延续', () => {
    const column: FlowColumn = {
      id: 'col1', name: '奖金',
      itemSets: { 202601: [{ id: 'a', name: '年度奖', amount: 9000 }] },
      yearlyMonths: { 202601: true },
    }
    expect(resolveColumnValue(column, 202602).amount).toBe(0)
  })
})

describe('resolveColumnItems', () => {
  it('返回该月生效的整组明细（手填）', () => {
    const column: FlowColumn = {
      id: 'col1', name: '奖金',
      itemSets: { 202601: [{ id: 'a', name: 'x', amount: 1 }] },
    }
    expect(resolveColumnItems(column, 202601)).toEqual([{ id: 'a', name: 'x', amount: 1 }])
  })

  it('返回沿用组（前月多笔）', () => {
    const group = [{ id: 'a', name: 'x', amount: 1 }, { id: 'b', name: 'y', amount: 2 }]
    const column: FlowColumn = { id: 'col1', name: '奖金', itemSets: { 202601: group } }
    expect(resolveColumnItems(column, 202602)).toEqual(group)
  })

  it('无任何组返回空数组', () => {
    const column: FlowColumn = { id: 'col1', name: '奖金', itemSets: {} }
    expect(resolveColumnItems(column, 202601)).toEqual([])
  })
})
```

记得把 `resolveColumnItems` 加入顶部 import。

- [ ] **Step 5: 更新 `tests/composables/useStore.spec.ts`**

机械替换规则——文件中所有内联 `FlowColumn` 字面量的 `entries:` 同 Step 4 规则转 `itemSets:`。凡通过 `store.addColumn`/`store.updateColumnEntry` 构造数据的用例**无需改**（API 签名不变，内部已走 itemSets）。凡断言 `col.entries[...]` 的，改为断言 `col.itemSets[...][0].amount`（或用 `resolveColumnValue` 间接断言）。

新增用例：

```ts
it('单值编辑写入一笔 name 为空的明细组', async () => {
  const useStore = await loadUseStore()
  const store = useStore()
  const col = store.addColumn('工资')
  store.updateColumnEntry(col.id, 202601, 10000)
  expect(col.itemSets[202601]).toEqual([{ id: expect.any(String), name: '', amount: 10000 }])
})

it('replaceColumnItems 存多笔；全空则删该月', async () => {
  const useStore = await loadUseStore()
  const store = useStore()
  const col = store.addColumn('奖金')
  store.replaceColumnItems(col.id, 202601, [{ name: '年终奖', amount: 8000 }, { name: '红包', amount: 3000 }])
  expect(col.itemSets[202601]).toHaveLength(2)
  expect(col.itemSets[202601].map(i => i.amount)).toEqual([8000, 3000])
  // 全部名称空 → 视为清空
  store.replaceColumnItems(col.id, 202601, [{ name: '', amount: 1 }])
  expect(col.itemSets[202601]).toBeUndefined()
})

it('setColumnMode 切换列模式', async () => {
  const useStore = await loadUseStore()
  const store = useStore()
  const col = store.addColumn('奖金')
  expect(col.mode).toBe('single')            // 缺省单值
  store.setColumnMode(col.id, 'detail')
  expect(col.mode).toBe('detail')
  store.setColumnMode(col.id, 'single')
  expect(col.mode).toBe('single')
})

it('旧 v2 entries 数据加载时自动迁移为 itemSets + single + version 3', async () => {
  const oldPlan = {
    version: 2,
    systemParams: { startMonth: 202601, annualRate: 0.025 },
    columns: [{ id: 'col1', name: '工资', entries: { 202601: 10000, 202602: 11000 } }],
    anchors: [], snapshots: [], events: [],
  }
  localStorage.setItem('family-finance-plan', JSON.stringify(oldPlan))

  const useStore = await loadUseStore()
  const store = useStore()
  const col = store.data.value.columns[0]
  expect(col.itemSets[202601]).toEqual([{ id: expect.any(String), name: '', amount: 10000 }])
  expect(col.itemSets[202602]).toEqual([{ id: expect.any(String), name: '', amount: 11000 }])
  expect((col as any).entries).toBeUndefined()
  expect(col.mode).toBe('single')
  expect(store.data.value.version).toBe(3)
})
```

- [ ] **Step 6: 跑全部测试，预期全绿**

Run: `npm test`
Expected: 全部 PASS。若仍有 `entries` 引用报错，按 Step 4/5 规则补齐遗漏的字面量。

- [ ] **Step 7: Commit**

```bash
git add src/types.ts src/composables/useCalculation.ts src/composables/useStore.ts \
        tests/composables/useCalculation.spec.ts tests/composables/useStore.spec.ts
git commit -m "feat(data): 动态列升级为每月一组明细，支持明细模式与旧数据迁移"
```

---

## Task 2: 抽取通用明细编辑器（默认 3 行，专项接入）

**Files:**
- Create: `src/components/ItemEditor.vue`
- Create: `tests/components/ItemEditor.spec.ts`
- Modify: `src/components/MonthlyTable.vue`（专项编辑器挂载 1113-1120 改用 `ItemEditor`）
- Delete: `src/components/EventEditor.vue`
- Delete: `tests/components/EventEditor.spec.ts`

- [ ] **Step 1: 写失败测试 `tests/components/ItemEditor.spec.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ItemEditor from '../../src/components/ItemEditor.vue'

describe('ItemEditor', () => {
  it('打开时默认至少 3 行（已有项保留、不足补空）', () => {
    const wrapper = mount(ItemEditor, {
      props: { title: '2026-01 专项', items: [{ name: '买房', amount: -500000 }], x: 0, y: 0 },
    })
    // 1 个已有 + 2 个补空 = 3 行输入框组
    const nameInputs = wrapper.findAll('input[type="text"]')
    expect(nameInputs.length).toBe(3)
  })

  it('已有项超过 3 个时全部保留', () => {
    const items = [{ name: 'a', amount: 1 }, { name: 'b', amount: 2 }, { name: 'c', amount: 3 }, { name: 'd', amount: 4 }]
    const wrapper = mount(ItemEditor, { props: { title: 't', items, x: 0, y: 0 } })
    expect(wrapper.findAll('input[type="text"]').length).toBe(4)
  })

  it('点「完成」emit save（仅含有效项）并 close', async () => {
    const wrapper = mount(ItemEditor, {
      props: { title: 't', items: [{ name: 'a', amount: 100 }], x: 0, y: 0 },
    })
    await wrapper.findAll('input[type="text"]')[0].setValue('奖金')
    const amountInput = wrapper.find('input[inputmode="numeric"]')
    await amountInput.setValue('5000')
    await wrapper.find('button[aria-label="完成"]').trigger('click')
    const save = wrapper.emitted('save')
    expect(save).toBeTruthy()
    expect(save![0][0]).toEqual([{ name: '奖金', amount: 5000 }])
    expect(wrapper.emitted('close')).toBeTruthy()
  })
})
```

- [ ] **Step 2: 跑测试，确认失败**

Run: `npx vitest run tests/components/ItemEditor.spec.ts`
Expected: FAIL（组件不存在）

- [ ] **Step 3: 实现 `src/components/ItemEditor.vue`**

（基于 `EventEditor.vue`，解耦 store：不再直接调 `store.replaceMonthEvents`，改为 `emit('save', items)`；标题用 props.title；打开默认 3 行。）

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useClickOutside } from '../composables/useClickOutside'

const props = defineProps<{
  title: string
  items: { name: string; amount: number }[]
  x: number
  y: number
}>()

const emit = defineEmits<{
  save: [items: { name: string; amount: number }[]]
  close: []
}>()

interface DraftRow { key: string; name: string; amount: string }

let draftKeySeq = 0
function nextDraftKey(): string {
  draftKeySeq += 1
  return `draft-${draftKeySeq}`
}

const INITIAL_ROWS = 3

// 打开时默认至少 INITIAL_ROWS 行：已有项保留，不足补空行（补空不触发 dirty）
const rows = ref<DraftRow[]>(
  (() => {
    const filled = props.items.map(e => ({ key: nextDraftKey(), name: e.name, amount: String(e.amount) }))
    while (filled.length < INITIAL_ROWS) filled.push({ key: nextDraftKey(), name: '', amount: '' })
    return filled
  })(),
)

const dirty = ref(false)
function markDirty() { dirty.value = true }

const rootRef = ref<HTMLElement | null>(null)

function addRow() {
  rows.value.push({ key: nextDraftKey(), name: '', amount: '' })
  markDirty()
}

function removeRow(idx: number) {
  rows.value.splice(idx, 1)
  markDirty()
}

function commit() {
  if (dirty.value) {
    const items = rows.value
      .map(r => ({ name: r.name.trim(), amount: Number(r.amount) }))
      .filter(r => r.name !== '' && Number.isFinite(r.amount))
      .map(r => ({ name: r.name, amount: Math.round(r.amount) }))
    emit('save', items)
  }
  emit('close')
}

useClickOutside(rootRef, commit)

onMounted(() => {
  rootRef.value?.focus()
})
</script>

<template>
  <div
    ref="rootRef"
    class="fixed z-50 min-w-64 rounded-xl border border-line bg-surface p-3 text-[12px] text-ink shadow-[0_18px_50px_-20px_rgba(26,34,51,0.25)]"
    :style="{ left: `${x}px`, top: `${y}px` }"
    tabindex="-1"
    @keyup.escape="commit"
  >
    <div class="mb-2 font-mono text-[10.5px] tracking-[0.16em] uppercase text-ink-2">{{ title }}</div>

    <div v-for="(row, idx) in rows" :key="row.key" class="mb-1.5 flex items-center gap-1.5">
      <input
        v-model="row.name"
        type="text"
        class="flex-1 rounded-lg border border-line bg-surface px-2 py-1 text-[12px] text-ink focus:border-brand focus:ring-2 focus:ring-brand/30"
        placeholder="名称"
        @input="markDirty"
      />
      <input
        v-model="row.amount"
        type="text"
        inputmode="numeric"
        class="w-24 rounded-lg border border-line bg-surface px-2 py-1 text-right text-[12px] text-ink focus:border-brand focus:ring-2 focus:ring-brand/30"
        placeholder="金额"
        @input="markDirty"
      />
      <button
        type="button"
        class="text-danger-600 hover:text-danger-800"
        aria-label="删除该行"
        @click="removeRow(idx)"
      >×</button>
    </div>

    <button
      type="button"
      class="mt-1 text-brand-600 hover:text-brand-700"
      aria-label="添加行"
      @click="addRow"
    >+ 添加</button>

    <div class="mt-3 flex justify-end border-t border-line-soft pt-2">
      <button
        type="button"
        class="rounded-lg border border-line bg-surface px-2 py-0.5 text-ink hover:bg-surface-2"
        aria-label="完成"
        @click="commit"
      >完成</button>
    </div>
  </div>
</template>
```

- [ ] **Step 4: 跑测试，确认通过**

Run: `npx vitest run tests/components/ItemEditor.spec.ts`
Expected: PASS

- [ ] **Step 5: 专项编辑器改用 `ItemEditor`（`MonthlyTable.vue`）**

把专项 `EventEditor` 挂载（1113-1120 行）替换为：

```vue
<ItemEditor
  v-if="eventEditor"
  :title="`${formatMonth(eventEditor.month)} 专项`"
  :items="eventInfo(eventEditor.month).events.map(e => ({ name: e.name, amount: e.amount }))"
  :x="eventEditor.x"
  :y="eventEditor.y"
  @save="(items) => store.replaceMonthEvents(eventEditor.month, items)"
  @close="closeEventEditor"
/>
```

并更新 import（删除 `EventEditor`，新增 `ItemEditor`）。

- [ ] **Step 6: 删除旧组件与旧测试**

```bash
rm src/components/EventEditor.vue tests/components/EventEditor.spec.ts
```

- [ ] **Step 7: 跑全部测试，确认专项功能仍正常**

Run: `npm test`
Expected: PASS（专项编辑行为经 ItemEditor 等价覆盖；MonthlyTable 现有专项用例不应回归）

- [ ] **Step 8: Commit**

```bash
git add src/components/ItemEditor.vue src/components/MonthlyTable.vue tests/components/ItemEditor.spec.ts
git rm src/components/EventEditor.vue tests/components/EventEditor.spec.ts
git commit -m "refactor(ui): 抽取通用明细编辑器，专项接入，打开默认 3 行"
```

---

## Task 3: 只读明细弹窗泛化（专项 + 动态列复用）

**Files:**
- Modify: `src/components/EventDetailPopover.vue`
- Modify: `src/components/MonthlyTable.vue`（专项弹窗挂载 1122-1130 传新 props）
- Modify: `tests/components/EventDetailPopover.spec.ts`

- [ ] **Step 1: 写失败测试（更新 `EventDetailPopover.spec.ts`）**

把现有用例的 props 从 `{ month, events, net, x, y }` 改为 `{ title, items, net, x, y }`，并新增一个动态列风格的用例。示例：

```ts
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import EventDetailPopover from '../../src/components/EventDetailPopover.vue'

describe('EventDetailPopover', () => {
  it('展示标题、每笔明细与净额', () => {
    const wrapper = mount(EventDetailPopover, {
      props: {
        title: '2026-01 奖金',
        items: [{ name: '年终奖', amount: 8000 }, { name: '红包', amount: 3000 }],
        net: 11000, x: 0, y: 0,
      },
    })
    const text = wrapper.text()
    expect(text).toContain('2026-01 奖金')
    expect(text).toContain('年终奖')
    expect(text).toContain('红包')
  })
})
```

（其余现有用例按同一 props 改名迁移。）

- [ ] **Step 2: 跑测试，确认失败**

Run: `npx vitest run tests/components/EventDetailPopover.spec.ts`
Expected: FAIL（props 不匹配）

- [ ] **Step 3: 泛化 `src/components/EventDetailPopover.vue`**

props 由 `{ month; events: MilestoneEvent[]; net; x; y }` 改为 `{ title: string; items: { name: string; amount: number }[]; net: number; x: number; y: number }`。模板里标题 `{{ formatMonth(month) }} 专项` 改为 `{{ title }}`；明细循环 `v-for="event in events"` 改为 `v-for="item in items"`，字段 `event.name/event.amount` 改为 `item.name/item.amount`。其余（`@mouseleave="emit('close')"`、负数斜体、净额行）不变。移除不再使用的 `formatMonth`/`MilestoneEvent` import。

- [ ] **Step 4: 专项弹窗挂载传新 props（`MonthlyTable.vue` 1122-1130）**

```vue
<EventDetailPopover
  v-if="eventPopover"
  :title="`${formatMonth(eventPopover.month)} 专项`"
  :items="eventInfo(eventPopover.month).events.map(e => ({ name: e.name, amount: e.amount }))"
  :net="eventInfo(eventPopover.month).net"
  :x="eventPopover.x"
  :y="eventPopover.y"
  @close="eventPopover = null"
/>
```

- [ ] **Step 5: 跑全部测试**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/EventDetailPopover.vue src/components/MonthlyTable.vue tests/components/EventDetailPopover.spec.ts
git commit -m "refactor(ui): 只读明细弹窗泛化为通用 items，专项与动态列可复用"
```

---

## Task 4: MonthlyTable 动态列明细模式交互

**Files:**
- Modify: `src/components/MonthlyTable.vue`（动态列 `<td>` 804-841 分支；新增 detail 编辑器/弹窗状态与挂载）
- Modify: `tests/components/MonthlyTable.spec.ts`

- [ ] **Step 1: 写失败测试（追加到 `MonthlyTable.spec.ts`）**

```ts
describe('动态列明细模式', () => {
  it('明细列点击单元格打开明细编辑器；保存写回 replaceColumnItems', async () => {
    const store = useSharedStore()
    store.reset()
    store.data.value.systemParams.startMonth = 202601
    const col = store.addColumn('奖金')
    store.setColumnMode(col.id, 'detail')
    const results = calculate(store.data.value).slice(0, 1)

    const wrapper = mount(MonthlyTable, { props: { results } })
    const cell = wrapper.find(`[aria-label="编辑 2026-01 奖金"]`)
    await cell.trigger('click')

    const editor = wrapper.findComponent({ name: 'ItemEditor' })
    expect(editor.exists()).toBe(true)
    // 填两笔并完成
    const names = editor.findAll('input[type="text"]')
    const amounts = editor.findAll('input[inputmode="numeric"]')
    await names[0].setValue('年终奖'); await amounts[0].setValue('8000')
    await names[1].setValue('红包');   await amounts[1].setValue('3000')
    await editor.find('button[aria-label="完成"]').trigger('click')

    expect(col.itemSets[202601].map(i => i.amount)).toEqual([8000, 3000])
  })

  it('明细列悬停显示只读明细弹窗', async () => {
    const store = useSharedStore()
    store.reset()
    store.data.value.systemParams.startMonth = 202601
    const col = store.addColumn('奖金')
    store.setColumnMode(col.id, 'detail')
    store.replaceColumnItems(col.id, 202601, [{ name: '年终奖', amount: 8000 }])
    const results = calculate(store.data.value).slice(0, 1)

    const wrapper = mount(MonthlyTable, { props: { results } })
    const cell = wrapper.find(`[aria-label="编辑 2026-01 奖金"]`)
    await cell.trigger('mouseenter', { clientX: 100, clientY: 100 })
    expect(wrapper.findComponent({ name: 'EventDetailPopover' }).exists()).toBe(true)
  })

  it('单值列维持内联编辑，不弹编辑器', async () => {
    const store = useSharedStore()
    store.reset()
    store.data.value.systemParams.startMonth = 202601
    store.addColumn('工资')   // 缺省 single
    const results = calculate(store.data.value).slice(0, 1)

    const wrapper = mount(MonthlyTable, { props: { results } })
    await wrapper.find('[aria-label="编辑 2026-01 工资"]').trigger('click')
    expect(wrapper.find('input[inputmode="numeric"]').exists()).toBe(true)  // 内联输入框
    expect(wrapper.findComponent({ name: 'ItemEditor' }).exists()).toBe(false)
  })
})
```

> 这组 `describe` 必须声明在文件中"纯 props 渲染"用例之后（与现有右键测试同一约束：交互用例需用静态 `useSharedStore` 与组件同单例）。`useSharedStore`/`calculate`/`MonthResult` 已在文件顶部 import，无需重复。

- [ ] **Step 2: 跑测试，确认失败**

Run: `npx vitest run tests/components/MonthlyTable.spec.ts -t "动态列明细模式"`
Expected: FAIL（尚无明细分支，点击不打开 ItemEditor）

- [ ] **Step 3: 在 `MonthlyTable.vue` 加明细交互状态与 helper**

在脚本区（专项 `eventPopover` 相关函数附近）加入：

```ts
import { resolveColumnItems } from '../composables/useCalculation'   // 补进顶部 import

function isDetailColumn(column: FlowColumn): boolean {
  return column.mode === 'detail'
}

// 动态列明细编辑器状态
const detailEditor = ref<{ columnId: string; month: number; x: number; y: number } | null>(null)
function openDetailEditor(columnId: string, month: number, event: MouseEvent) {
  detailEditor.value = { columnId, month, x: computePopoverX(event.clientX, { expectedWidth: 288 }), y: event.clientY }
}
function closeDetailEditor() { detailEditor.value = null }

// 动态列只读明细弹窗状态
const detailPopover = ref<{ columnId: string; month: number; x: number; y: number } | null>(null)
function showDetailPopover(columnId: string, month: number, event: MouseEvent) {
  const col = columns.value.find(c => c.id === columnId)
  if (col && resolveColumnItems(col, month).length > 0) {
    detailPopover.value = { columnId, month, x: computePopoverX(event.clientX), y: event.clientY + 10 }
  }
}
function hideDetailPopover() { detailPopover.value = null }
```

- [ ] **Step 4: 动态列 `<td>`（804-841 行）按 mode 分支**

把该 `<td>` 内部改为（保留外层 `<td>` 的 class 与 `@contextmenu.prevent`）：

```vue
<td
  v-for="column in columns"
  :key="`${result.month}-${column.id}`"
  class="px-0.5 py-0 text-right tabular-nums whitespace-nowrap relative"
  :class="[
    getValueClass(getColumnValue(result, column.id).amount),
    { 'bg-brand-50': getColumnValue(result, column.id).isEdited },
    { 'opacity-40': !isColumnEnabled(column) }
  ]"
  @contextmenu.prevent="openContextMenu(column.id, result.month, $event)"
>
  <!-- 明细模式：点击编辑、悬停看明细 -->
  <span
    v-if="isDetailColumn(column)"
    class="block w-full cursor-pointer"
    :aria-label="`编辑 ${formatMonth(result.month)} ${column.name}`"
    @click="openDetailEditor(column.id, result.month, $event)"
    @mouseenter="showDetailPopover(column.id, result.month, $event)"
    @mouseleave="hideDetailPopover"
  >{{ formatCurrency(getColumnValue(result, column.id).amount) }}<span
      v-if="column.yearlyMonths?.[result.month]"
      class="ml-0.5 text-brand-500"
      aria-hidden="true"
    >↻</span></span>

  <!-- 单值模式：维持原有内联编辑（原 input + span 结构原样保留） -->
  <template v-else>
    <input
      v-if="editingCell?.columnId === column.id && editingCell?.month === result.month"
      :ref="setEditCellInput"
      type="text"
      inputmode="numeric"
      class="absolute inset-0 border rounded px-1 text-right text-[11px]"
      :value="editCellValue"
      @input="editCellValue = ($event.target as HTMLInputElement).value"
      @keyup.enter="confirmEditCell"
      @keyup.escape="cancelEditCell"
      @keydown.up.prevent="moveEditCell(column.id, result.month, -1)"
      @keydown.down.prevent="moveEditCell(column.id, result.month, 1)"
      @blur="handleEditCellBlur"
    />
    <span
      v-else
      class="block w-full cursor-pointer"
      :aria-label="`编辑 ${formatMonth(result.month)} ${column.name}`"
      @click="startEditCell(column.id, result.month, getColumnValue(result, column.id).amount)"
    >{{ formatCurrency(getColumnValue(result, column.id).amount) }}<span
        v-if="column.yearlyMonths?.[result.month]"
        class="ml-0.5 text-brand-500"
        aria-hidden="true"
      >↻</span></span>
  </template>
</td>
```

（单值分支的内容与现有 804-841 行结构完全一致，只是包进 `v-else`。）

- [ ] **Step 5: 挂载动态列明细编辑器与弹窗**

在模板末尾（与专项 `ItemEditor`/`EventDetailPopover` 挂载并列）加入：

```vue
<ItemEditor
  v-if="detailEditor"
  :title="`${formatMonth(detailEditor.month)} ${columns.find(c => c.id === detailEditor!.columnId)?.name ?? ''}`"
  :items="resolveColumnItems(columns.find(c => c.id === detailEditor!.columnId)!, detailEditor.month)"
  :x="detailEditor.x"
  :y="detailEditor.y"
  @save="(items) => { store.replaceColumnItems(detailEditor!.columnId, detailEditor!.month, items) }"
  @close="closeDetailEditor"
/>

<EventDetailPopover
  v-if="detailPopover"
  :title="`${formatMonth(detailPopover.month)} ${columns.find(c => c.id === detailPopover!.columnId)?.name ?? ''}`"
  :items="resolveColumnItems(columns.find(c => c.id === detailPopover!.columnId)!, detailPopover.month)"
  :net="getColumnValue(results.find(r => r.month === detailPopover!.month)!, detailPopover.columnId).amount"
  :x="detailPopover.x"
  :y="detailPopover.y"
  @close="detailPopover = null"
/>
```

> 模板内 `detailEditor!`/`detailPopover!` 的非空断言在各自 `v-if` 守卫内安全。若 Vue 模板 TS 校验报错，可改为先在脚本里取 `const activeDetailColumn = computed(() => columns.value.find(c => c.id === detailEditor.value?.columnId))` 再在模板引用，消除内联断言。

- [ ] **Step 6: 跑测试，确认通过**

Run: `npx vitest run tests/components/MonthlyTable.spec.ts -t "动态列明细模式"`
Expected: PASS

- [ ] **Step 7: 跑全部测试，确认无回归**

Run: `npm test`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/components/MonthlyTable.vue tests/components/MonthlyTable.spec.ts
git commit -m "feat(ui): 动态列明细模式支持点开编辑与悬停查看明细"
```

---

## Task 5: 右键菜单加"切换明细/单值"项

**Files:**
- Modify: `src/components/MonthlyTable.vue`（`contextMenuItems` 计算属性 408-446）
- Modify: `tests/components/MonthlyTable.spec.ts`

- [ ] **Step 1: 写失败测试（追加到 `MonthlyTable.spec.ts`）**

```ts
describe('右键切换明细/单值', () => {
  it('动态列右键菜单含「切换为明细列」，点击后列变 detail', async () => {
    const store = useSharedStore()
    store.reset()
    store.data.value.systemParams.startMonth = 202601
    const col = store.addColumn('奖金')
    const results = calculate(store.data.value).slice(0, 1)

    const wrapper = mount(MonthlyTable, { props: { results } })
    await wrapper.find('[aria-label="编辑 2026-01 奖金"]').trigger('contextmenu')

    const item = wrapper.findComponent({ name: 'ContextMenu' })
      .findAll('[role="menuitem"]').find(i => i.text() === '切换为明细列')!
    await item.trigger('click')

    expect(col.mode).toBe('detail')
  })

  it('明细列右键菜单显示「切回单值」，点击后变 single', async () => {
    const store = useSharedStore()
    store.reset()
    store.data.value.systemParams.startMonth = 202601
    const col = store.addColumn('奖金')
    store.setColumnMode(col.id, 'detail')
    const results = calculate(store.data.value).slice(0, 1)

    const wrapper = mount(MonthlyTable, { props: { results } })
    await wrapper.find('[aria-label="编辑 2026-01 奖金"]').trigger('contextmenu')

    const item = wrapper.findComponent({ name: 'ContextMenu' })
      .findAll('[role="menuitem"]').find(i => i.text() === '切回单值')!
    await item.trigger('click')

    expect(col.mode).toBe('single')
  })
})
```

- [ ] **Step 2: 跑测试，确认失败**

Run: `npx vitest run tests/components/MonthlyTable.spec.ts -t "右键切换明细"`
Expected: FAIL（菜单无该项）

- [ ] **Step 3: 在 `contextMenuItems`（408-446 行）`return items` 之前插入切换项**

```ts
// 切换明细/单值（仅真实动态列；余额、公积金专区列不切换）
if (!isBalanceColumn && !isFundColumn) {
  const col = columns.value.find(c => c.id === ctx.columnId)
  if (col) {
    items.push({
      label: col.mode === 'detail' ? '切回单值' : '切换为明细列',
      onClick: () => store.setColumnMode(ctx.columnId, col.mode === 'detail' ? 'single' : 'detail'),
    })
  }
}
return items
```

> `isBalanceColumn`/`isFundColumn`/`ctx` 沿用本计算属性内现有变量（408-446 行已定义）；`columns` 是组件内的 computed（`store.data.value.columns`，见 23 行），在计算属性中取 `.value`。

- [ ] **Step 4: 跑测试，确认通过**

Run: `npx vitest run tests/components/MonthlyTable.spec.ts -t "右键切换明细"`
Expected: PASS

- [ ] **Step 5: 跑全部测试**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/MonthlyTable.vue tests/components/MonthlyTable.spec.ts
git commit -m "feat(ui): 动态列右键菜单支持切换明细/单值模式"
```

---

## 完成判据

- 所有 `npm test` 通过。
- 动态列右键可切换明细/单值，来回切换数据零损失（明细笔保留在 `itemSets`）。
- 明细列点击可多笔编辑、悬停可看明细、合计与正负分流正确。
- 单值列行为与现状一致。
- 旧 localStorage 数据（v2 entries）首次加载自动迁移为 itemSets，金额/延续/年度项不变。
- 专项列功能（编辑、明细、合计）经通用组件等价保留，编辑器打开默认 3 行。
