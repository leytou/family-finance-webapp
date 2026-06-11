import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import type { PlanData, FlowColumn, Scenario, Workspace, PlanSnapshot } from '../types'
import { getCurrentMonth, formatMonth, addMonths, normalizeMonth } from '../utils/month'
import { calculate } from './useCalculation'

const STORAGE_KEY = 'family-finance-plan'
let sharedWorkspace: Ref<Workspace> | null = null
let saveTimeout: ReturnType<typeof setTimeout> | null = null
let resetSnapshot: string | null = null

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

function createDefault(): PlanData {
  return {
    version: 2,
    systemParams: {
      startMonth: getCurrentMonth(),
      annualRate: 0.025,
      initialDeposit: 0,
    },
    columns: [],
    anchors: [],
    snapshots: [],
  }
}

function createDefaultWorkspace(): Workspace {
  const id = generateId()
  return {
    version: 1,
    scenarios: [{ id, name: '默认方案', plan: createDefault() }],
    activeId: id,
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isValidColumn(value: unknown): boolean {
  if (!isObject(value)) return false
  if (typeof value.id !== 'string' || typeof value.name !== 'string') return false
  if (!isObject(value.entries)) return false
  for (const key in value.entries) {
    const month = Number(key)
    const amount = value.entries[key]
    if (!Number.isInteger(month) || !isFiniteNumber(amount)) return false
  }
  if (value.yearlyMonths !== undefined) {
    if (!isObject(value.yearlyMonths)) return false
    for (const key in value.yearlyMonths) {
      if (!Number.isInteger(Number(key))) return false
    }
  }
  return true
}

function isValidAnchor(value: unknown): boolean {
  if (!isObject(value)) return false
  return isFiniteNumber(value.month) && isFiniteNumber(value.actualSavings)
}

function isValidSnapshot(value: unknown): boolean {
  if (!isObject(value)) return false
  if (typeof value.id !== 'string' || typeof value.name !== 'string') return false
  if (!isFiniteNumber(value.createdMonth)) return false
  if (!isObject(value.projection)) return false
  for (const key in value.projection) {
    if (!Number.isInteger(Number(key)) || !isFiniteNumber(value.projection[key])) return false
  }
  return true
}

function isValidPlanData(value: unknown): value is PlanData {
  if (!isObject(value) || !isObject(value.systemParams)) return false
  if (value.version !== 2) return false
  if ('snapshots' in value) {
    if (!Array.isArray(value.snapshots) || !value.snapshots.every(isValidSnapshot)) return false
  }
  return (
    isFiniteNumber(value.version) &&
    isFiniteNumber(value.systemParams.startMonth) &&
    isFiniteNumber(value.systemParams.annualRate) &&
    Array.isArray(value.columns) &&
    value.columns.every(isValidColumn) &&
    Array.isArray(value.anchors) &&
    value.anchors.every(isValidAnchor)
  )
}

function isValidScenario(value: unknown): value is Scenario {
  if (!isObject(value)) return false
  if (typeof value.id !== 'string') return false
  if (typeof value.name !== 'string') return false
  return isValidPlanData(value.plan)
}

function isValidWorkspace(value: unknown): value is Workspace {
  if (!isObject(value)) return false
  if (value.version !== 1) return false
  if (!Array.isArray(value.scenarios) || value.scenarios.length === 0) return false
  if (typeof value.activeId !== 'string') return false
  const ids: string[] = value.scenarios.map((s: unknown) => isObject(s) ? (s as Record<string, unknown>).id as string : '')
  if (!ids.includes(value.activeId)) return false
  return value.scenarios.every(isValidScenario)
}

function normalizeWorkspace(ws: Workspace): Workspace {
  for (const scenario of ws.scenarios) {
    if (!Array.isArray(scenario.plan.snapshots)) {
      scenario.plan.snapshots = []
    }
    // 初始存款缺失或非有限数时补 0（轻量容错，保留存量方案数据）
    if (!isFiniteNumber(scenario.plan.systemParams.initialDeposit)) {
      scenario.plan.systemParams.initialDeposit = 0
    }
  }
  return ws
}

function loadWorkspace(): Workspace {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    // 初次加载，不立即保存，等待数据变化时再保存
    return createDefaultWorkspace()
  }
  try {
    const parsed: unknown = JSON.parse(raw)
    // 已是 Workspace 格式
    if (isValidWorkspace(parsed)) return normalizeWorkspace(parsed)
    // 旧 PlanData 格式 → 迁移
    if (isValidPlanData(parsed)) {
      const id = generateId()
      const migrated: Workspace = normalizeWorkspace({
        version: 1,
        scenarios: [{ id, name: '默认方案', plan: parsed }],
        activeId: id,
      })
      // 立即保存迁移后的数据
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated))
      return migrated
    }
  } catch {
    // Fall through to recovery
  }
  // 数据损坏，移除坏数据并返回默认 Workspace，立即保存
  localStorage.removeItem(STORAGE_KEY)
  const defaultWorkspace = createDefaultWorkspace()
  localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultWorkspace))
  return defaultWorkspace
}

export function useStore() {
  if (!sharedWorkspace) {
    sharedWorkspace = ref<Workspace>(loadWorkspace())
    watch(
      sharedWorkspace,
      () => {
        const currentSnapshot = JSON.stringify(sharedWorkspace?.value)
        if (resetSnapshot === currentSnapshot) {
          resetSnapshot = null
          return
        }
        resetSnapshot = null
        if (saveTimeout) clearTimeout(saveTimeout)
        saveTimeout = setTimeout(() => {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(sharedWorkspace?.value))
          saveTimeout = null
        }, 300)
      },
      { deep: true },
    )
  }

  const workspace = sharedWorkspace

  // data 指向当前激活方案的 plan（computed 代理）
  const data: ComputedRef<PlanData> = computed(() => {
    const scenario = workspace.value.scenarios.find(s => s.id === workspace.value.activeId)
    return scenario!.plan
  })

  function save() {
    if (saveTimeout) {
      clearTimeout(saveTimeout)
      saveTimeout = null
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace.value))
  }

  // 获取当前激活方案的 plan 的辅助函数
  function getActivePlan(): PlanData {
    const scenario = workspace.value.scenarios.find(s => s.id === workspace.value.activeId)
    return scenario!.plan
  }

  /**
   * 设置起始月份（受控入口）：对原始值做规范化，
   * 合法（含进位）则写入并返回 true；非法（非 6 位整数）则忽略并返回 false。
   */
  function setStartMonth(raw: number): boolean {
    const normalized = normalizeMonth(raw)
    if (normalized === null) return false
    getActivePlan().systemParams.startMonth = normalized
    return true
  }

  // 列操作函数（作用于当前激活方案）
  function addColumn(name?: string): FlowColumn {
    const plan = getActivePlan()
    const column: FlowColumn = {
      id: generateId(),
      name: name ?? '新列',
      entries: {},
    }
    plan.columns.push(column)
    return column
  }

  function removeColumn(id: string): void {
    const plan = getActivePlan()
    plan.columns = plan.columns.filter(col => col.id !== id)
  }

  function renameColumn(id: string, name: string): void {
    const plan = getActivePlan()
    const column = plan.columns.find(col => col.id === id)
    if (column) {
      column.name = name
    }
  }

  function moveColumn(fromId: string, toId: string, side: 'before' | 'after'): void {
    if (fromId === toId) return              // 拖到自身，无操作
    const plan = getActivePlan()
    const fromIdx = plan.columns.findIndex(col => col.id === fromId)
    if (fromIdx === -1) return
    const [moved] = plan.columns.splice(fromIdx, 1)   // 先移除
    let toIdx = plan.columns.findIndex(col => col.id === toId)  // 移除后重新查找，避免索引错位
    if (toIdx === -1) {
      plan.columns.push(moved)
      return
    }
    if (side === 'after') toIdx += 1
    plan.columns.splice(toIdx, 0, moved)
  }

  function updateColumnEntry(colId: string, month: number, value: number | null): void {
    const plan = getActivePlan()
    const column = plan.columns.find(col => col.id === colId)
    if (!column) return

    if (value === null) {
      delete column.entries[month]
      // 联动清除年度标记：entry 已不存在，标记无意义且会残留
      if (column.yearlyMonths) delete column.yearlyMonths[month]
    } else {
      column.entries[month] = value
    }
  }

  // 把指定月（须存在直接编辑值）的金额复制到投影范围内所有同月，并标记为 yearly。
  // 快照式：每个年份同月是独立 entry，之后单独修改某月不影响其它年份。
  function syncYearly(colId: string, month: number): void {
    const plan = getActivePlan()
    const column = plan.columns.find(col => col.id === colId)
    if (!column) return
    const amount = column.entries[month]
    if (amount === undefined) return                 // 无值不可同步
    if (!column.yearlyMonths) column.yearlyMonths = {}
    const moy = month % 100
    const start = plan.systemParams.startMonth
    for (let i = 0; i < 60; i++) {                   // 与 calculate 的 PROJECTION_MONTHS 一致
      const m = addMonths(start, i)
      if (m % 100 === moy) {
        column.entries[m] = amount
        column.yearlyMonths[m] = true
      }
    }
  }

  function addAnchor(month: number, actualSavings: number) {
    const plan = getActivePlan()
    const existing = plan.anchors.findIndex(anchor => anchor.month === month)
    if (existing >= 0) {
      plan.anchors[existing].actualSavings = actualSavings
    } else {
      plan.anchors.push({ month, actualSavings })
    }
  }

  function removeAnchor(month: number) {
    const plan = getActivePlan()
    plan.anchors = plan.anchors.filter(anchor => anchor.month !== month)
  }

  function addSnapshot(): PlanSnapshot {
    const plan = getActivePlan()
    const results = calculate(plan)
    const projection: Record<number, number> = {}
    for (const r of results) {
      projection[r.month] = r.cumSavings
    }
    const snapshot: PlanSnapshot = {
      id: generateId(),
      name: `${formatMonth(plan.systemParams.startMonth)} 计划`,
      createdMonth: plan.systemParams.startMonth,
      projection,
    }
    plan.snapshots.push(snapshot)
    return snapshot
  }

  function removeSnapshot(id: string): void {
    const plan = getActivePlan()
    plan.snapshots = plan.snapshots.filter(s => s.id !== id)
  }

  function renameSnapshot(id: string, name: string): void {
    const plan = getActivePlan()
    const snapshot = plan.snapshots.find(s => s.id === id)
    if (snapshot) {
      snapshot.name = name
    }
  }

  // 重置当前方案（不影响其他方案）
  function reset() {
    if (saveTimeout) {
      clearTimeout(saveTimeout)
      saveTimeout = null
    }
    const defaultPlan = createDefault()
    resetSnapshot = JSON.stringify({ ...workspace.value })
    const scenario = workspace.value.scenarios.find(s => s.id === workspace.value.activeId)
    if (scenario) {
      scenario.plan = defaultPlan
    }
  }

  // 方案级操作
  function addScenario(): Scenario {
    const id = generateId()
    const scenario: Scenario = { id, name: '', plan: createDefault() }
    workspace.value.scenarios.push(scenario)
    workspace.value.activeId = id
    return scenario
  }

  function duplicateScenario(): Scenario {
    const current = workspace.value.scenarios.find(s => s.id === workspace.value.activeId)
    if (!current) throw new Error('未找到当前激活方案')
    const id = generateId()
    const scenario: Scenario = {
      id,
      name: '',
      plan: JSON.parse(JSON.stringify(current.plan)),
    }
    workspace.value.scenarios.push(scenario)
    workspace.value.activeId = id
    return scenario
  }

  function removeScenario(id: string): void {
    if (workspace.value.scenarios.length <= 1) return
    const index = workspace.value.scenarios.findIndex(s => s.id === id)
    if (index === -1) return
    workspace.value.scenarios.splice(index, 1)
    // 如果删除的是当前激活方案，切换到第一个
    if (workspace.value.activeId === id) {
      workspace.value.activeId = workspace.value.scenarios[0].id
    }
  }

  function renameScenario(id: string, name: string): void {
    const scenario = workspace.value.scenarios.find(s => s.id === id)
    if (scenario) {
      scenario.name = name
    }
  }

  function switchScenario(id: string): void {
    const exists = workspace.value.scenarios.some(s => s.id === id)
    if (exists) {
      workspace.value.activeId = id
    }
  }

  return {
    data,
    workspace,
    save,
    setStartMonth,
    addColumn,
    removeColumn,
    renameColumn,
    moveColumn,
    updateColumnEntry,
    syncYearly,
    addAnchor,
    removeAnchor,
    addSnapshot,
    removeSnapshot,
    renameSnapshot,
    reset,
    addScenario,
    duplicateScenario,
    removeScenario,
    renameScenario,
    switchScenario,
  }
}
