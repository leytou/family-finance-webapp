import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import type { PlanData, FlowColumn, ColumnItem, Scenario, Workspace, PlanSnapshot } from '../types'
import { getCurrentMonth, formatMonth, addMonths, normalizeMonth, monthDiff, projectionMonths } from '../utils/month'
import { calculate } from './useCalculation'

const STORAGE_KEY = 'family-finance-plan'
let sharedWorkspace: Ref<Workspace> | null = null
let saveTimeout: ReturnType<typeof setTimeout> | null = null
let resetSnapshot: string | null = null

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

function createDefault(): PlanData {
  const startMonth = getCurrentMonth()
  return {
    version: 3,
    systemParams: {
      startMonth,
      endMonth: addMonths(startMonth, 59),   // 默认 5 年期限
      annualRate: 0.025,
      initialDeposit: 0,
      fundRate: 0.015,
      fundInterestMonth: 7,
      fundInitialBalance: 0,
    },
    columns: [],
    corrections: [],
    snapshots: [],
    events: [],
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
  const col = value as Record<string, unknown>
  if (typeof col.id !== 'string' || typeof col.name !== 'string') return false
  if (col.mode !== undefined && col.mode !== 'single' && col.mode !== 'detail') return false
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
  if (col.entries !== undefined) {
    if (!isObject(col.entries)) return false
    for (const key in col.entries) {
      if (!Number.isInteger(Number(key)) || !isFiniteNumber((col.entries as Record<string, number>)[key])) return false
    }
    return true
  }
  return false
}

/** 把旧 entries 结构的列升级为 itemSets（v2→v3）。幂等：已是新结构则只补 mode，并清除可能残留的旧 entries。 */
function migrateColumn(col: Record<string, any>): void {
  if (!col.itemSets) {
    const entries = col.entries ?? {}
    const itemSets: Record<number, ColumnItem[]> = {}
    for (const key in entries) {
      itemSets[Number(key)] = [{ id: generateId(), name: '', amount: entries[key] }]
    }
    col.itemSets = itemSets
  }
  // 无条件清除残留的旧 entries：脏数据（itemSets 与 entries 并存）经 isValidColumn 放行后，此处保证干净
  delete col.entries
  if (col.mode === undefined) col.mode = 'single'
}

function isValidCorrection(value: unknown): boolean {
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

function isValidEvent(value: unknown): boolean {
  if (!isObject(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    Number.isInteger(value.month) &&
    isFiniteNumber(value.amount)
  )
}

function isValidFundWithdrawal(value: unknown): boolean {
  if (!isObject(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    Number.isInteger(value.month) &&
    isFiniteNumber(value.amount)
  )
}

function isValidFundCorrection(value: unknown): boolean {
  if (!isObject(value)) return false
  return Number.isInteger(value.month) && isFiniteNumber(value.actualBalance)
}

function isValidFund(value: unknown): boolean {
  if (!isObject(value)) return false
  if (!isValidColumn(value.mortgage)) return false
  if (!isValidColumn(value.contribution)) return false
  if (!isValidColumn(value.monthlyOffset)) return false
  if (!Array.isArray(value.withdrawals) || !value.withdrawals.every(isValidFundWithdrawal)) return false
  if (!Array.isArray(value.corrections) || !value.corrections.every(isValidFundCorrection)) return false
  return true
}

function isValidPlanData(value: unknown): value is PlanData {
  if (!isObject(value) || !isObject(value.systemParams)) return false
  if (value.version !== 2 && value.version !== 3) return false
  if ('snapshots' in value) {
    if (!Array.isArray(value.snapshots) || !value.snapshots.every(isValidSnapshot)) return false
  }
  if ('events' in value) {
    if (!Array.isArray(value.events) || !value.events.every(isValidEvent)) return false
  }
  if ('fund' in value) {
    if (value.fund !== undefined && !isValidFund(value.fund)) return false
  }
  return (
    isFiniteNumber(value.version) &&
    isFiniteNumber(value.systemParams.startMonth) &&
    isFiniteNumber(value.systemParams.annualRate) &&
    // endMonth 可选：缺失时由 normalizeWorkspace 补默认；存在时须为有限数
    (value.systemParams.endMonth === undefined || isFiniteNumber(value.systemParams.endMonth)) &&
    // fund 参数可选：缺失时由 normalizeWorkspace 补默认；存在时须为有限数
    (value.systemParams.fundRate === undefined || isFiniteNumber(value.systemParams.fundRate)) &&
    (value.systemParams.fundInterestMonth === undefined || isFiniteNumber(value.systemParams.fundInterestMonth)) &&
    Array.isArray(value.columns) &&
    value.columns.every(isValidColumn) &&
    Array.isArray(value.corrections) &&
    value.corrections.every(isValidCorrection)
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
    if (!Array.isArray(scenario.plan.events)) {
      scenario.plan.events = []
    }
    // endMonth 缺失或非法时补 startMonth + 59（默认 5 年）
    if (!isFiniteNumber(scenario.plan.systemParams.endMonth)) {
      scenario.plan.systemParams.endMonth = addMonths(scenario.plan.systemParams.startMonth, 59)
    }
    // 初始存款缺失或非有限数时补 0
    if (!isFiniteNumber(scenario.plan.systemParams.initialDeposit)) {
      scenario.plan.systemParams.initialDeposit = 0
    }
    // 公积金参数补默认（旧数据缺失时）
    if (!isFiniteNumber(scenario.plan.systemParams.fundRate)) {
      scenario.plan.systemParams.fundRate = 0.015
    }
    if (!isFiniteNumber(scenario.plan.systemParams.fundInterestMonth)) {
      scenario.plan.systemParams.fundInterestMonth = 7
    }
    if (!isFiniteNumber(scenario.plan.systemParams.fundInitialBalance)) {
      scenario.plan.systemParams.fundInitialBalance = 0
    }
    // fund 缺失保持 undefined（视为无公积金）；fund 存在则补其内部数组默认
    if (scenario.plan.fund) {
      if (!Array.isArray(scenario.plan.fund.withdrawals)) scenario.plan.fund.withdrawals = []
      if (!Array.isArray(scenario.plan.fund.corrections)) scenario.plan.fund.corrections = []
    }
    // 列与公积金三列：旧 entries 升级为 itemSets（v2→v3）
    for (const col of scenario.plan.columns) migrateColumn(col as Record<string, any>)
    if (scenario.plan.fund) {
      migrateColumn(scenario.plan.fund.mortgage as Record<string, any>)
      migrateColumn(scenario.plan.fund.contribution as Record<string, any>)
      migrateColumn(scenario.plan.fund.monthlyOffset as Record<string, any>)
    }
    scenario.plan.version = 3
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
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(sharedWorkspace?.value))
          } catch {
            // localStorage 不可用或写入失败（隐私模式 / 配额超限 / 测试环境已销毁）时静默跳过
          }
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

  /** 从 localStorage 重新加载 workspace，用于导入后刷新内存状态 */
  function reloadWorkspace() {
    const reloaded = loadWorkspace()
    workspace.value = reloaded
  }

  // 获取当前激活方案的 plan 的辅助函数
  function getActivePlan(): PlanData {
    const scenario = workspace.value.scenarios.find(s => s.id === workspace.value.activeId)
    return scenario!.plan
  }

  /**
   * 设置起始月份（受控入口）：规范化 + 与 endMonth 的一致性校验。
   * 合法（含进位、且不晚于 endMonth、期限 ≤ 360）则写入并返回 true；否则忽略并返回 false。
   */
  function setStartMonth(raw: number): boolean {
    const normalized = normalizeMonth(raw)
    if (normalized === null) return false
    const plan = getActivePlan()
    const end = Number.isFinite(plan.systemParams.endMonth) ? plan.systemParams.endMonth : addMonths(normalized, 59)
    if (normalized > end) return false
    if (monthDiff(normalized, end) + 1 > 360) return false
    plan.systemParams.startMonth = normalized
    return true
  }

  /**
   * 设置结束月份（受控入口）：规范化 + 与 startMonth 的一致性校验。
   * 合法（含进位、且不早于 startMonth、期限 ≤ 360）则写入并返回 true；否则忽略并返回 false。
   */
  function setEndMonth(raw: number): boolean {
    const normalized = normalizeMonth(raw)
    if (normalized === null) return false
    const plan = getActivePlan()
    const start = plan.systemParams.startMonth
    if (normalized < start) return false
    if (monthDiff(start, normalized) + 1 > 360) return false
    plan.systemParams.endMonth = normalized
    return true
  }

  // 列操作函数（作用于当前激活方案）
  function addColumn(name?: string): FlowColumn {
    const plan = getActivePlan()
    const column: FlowColumn = {
      id: generateId(),
      name: name ?? '新列',
      itemSets: {},
      mode: 'single',
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

  function setColumnEnabled(id: string, enabled: boolean): void {
    const plan = getActivePlan()
    const column = plan.columns.find(col => col.id === id)
    if (!column) return
    column.enabled = enabled
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
    if (!column.itemSets) column.itemSets = {}
    if (value === null) {
      delete column.itemSets[month]
      // 联动清除年度标记：entry 已不存在，标记无意义且会残留
      if (column.yearlyMonths) delete column.yearlyMonths[month]
    } else {
      column.itemSets[month] = [{ id: generateId(), name: '', amount: value }]
    }
  }

  // 整体替换某列某月的明细组：先丢弃「名称+金额」均无效的项，再写入合法项。
  // 全部无效时删除该月组（等价于清空）。供明细编辑器关闭时提交。
  function replaceColumnItems(colId: string, month: number, items: { name: string; amount: number }[]): void {
    const plan = getActivePlan()
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

  // 切换列的展示模式：single=单值内联编辑；detail=明细弹窗编辑（仅控制 UI）
  function setColumnMode(colId: string, mode: 'single' | 'detail'): void {
    const plan = getActivePlan()
    const column = plan.columns.find(col => col.id === colId)
    if (!column) return
    column.mode = mode
  }

  // 把指定月（须存在直接编辑值）的金额复制到「当前月及下方」所有同月，并标记为 yearly。
  // 不触碰上方（过去）年份，避免破坏已发生的实际数据。
  // 快照式：每个年份同月是独立 entry，之后单独修改某月不影响其它年份。
  function syncYearly(colId: string, month: number): void {
    const plan = getActivePlan()
    const column = plan.columns.find(col => col.id === colId)
    if (!column) return
    const template = column.itemSets?.[month]
    if (!template) return                              // 无手填组不可同步
    if (!column.yearlyMonths) column.yearlyMonths = {}
    const moy = month % 100
    const start = plan.systemParams.startMonth
    const end = Number.isFinite(plan.systemParams.endMonth) ? plan.systemParams.endMonth : addMonths(start, 59)
    const totalMonths = projectionMonths(start, end)
    for (let i = 0; i < totalMonths; i++) {          // 跟随 endMonth，与 calculate 一致
      const m = addMonths(start, i)
      // 仅当前月及下方（m >= month）：保护上方过去年份不被覆盖
      if (m % 100 === moy && m >= month) {
        column.itemSets[m] = template.map(it => ({ id: generateId(), name: it.name, amount: it.amount }))
        column.yearlyMonths[m] = true
      }
    }
  }

  // 整体替换某月的事件：先删该月全部，再写入「名称+金额」均有效的项。
  // 半空行（名称空 / 金额非有限数）静默丢弃。供 EventEditor 关闭时提交。
  function replaceMonthEvents(month: number, items: { name: string; amount: number }[]): void {
    const plan = getActivePlan()
    plan.events = plan.events.filter((e) => e.month !== month)
    for (const it of items) {
      const name = it.name.trim()
      if (name && Number.isFinite(it.amount)) {
        plan.events.push({ id: generateId(), name, month, amount: Math.round(it.amount) })
      }
    }
  }

  // 把源月所有专项整组搬到目标月（移动 + 合并）。
  // 不删除目标月原有事件，源月事件直接并入；from===to 无操作。
  function moveMonthEvents(fromMonth: number, toMonth: number): void {
    if (fromMonth === toMonth) return
    const plan = getActivePlan()
    for (const e of plan.events) {
      if (e.month === fromMonth) e.month = toMonth
    }
  }

  function addCorrection(month: number, actualSavings: number) {
    const plan = getActivePlan()
    const existing = plan.corrections.findIndex(correction => correction.month === month)
    if (existing >= 0) {
      plan.corrections[existing].actualSavings = actualSavings
    } else {
      plan.corrections.push({ month, actualSavings })
    }
  }

  function removeCorrection(month: number) {
    const plan = getActivePlan()
    plan.corrections = plan.corrections.filter(correction => correction.month !== month)
  }

  // —— 公积金操作 ——
  function emptyFlowColumn(name: string): FlowColumn {
    return { id: generateId(), name, itemSets: {} }
  }

  function enableFund(): void {
    const plan = getActivePlan()
    if (plan.fund) return
    plan.fund = {
      mortgage: emptyFlowColumn('房贷月供'),
      contribution: emptyFlowColumn('公积金缴存'),
      monthlyOffset: emptyFlowColumn('公积金月冲'),
      withdrawals: [],
      corrections: [],
    }
  }

  function disableFund(): void {
    const plan = getActivePlan()
    plan.fund = undefined
  }

  function updateFundEntry(
    field: 'mortgage' | 'contribution' | 'monthlyOffset',
    month: number,
    value: number | null,
  ): void {
    const plan = getActivePlan()
    if (!plan.fund) return
    const column = plan.fund[field]
    if (!column.itemSets) column.itemSets = {}
    if (value === null) {
      delete column.itemSets[month]
      if (column.yearlyMonths) delete column.yearlyMonths[month]
    } else {
      column.itemSets[month] = [{ id: generateId(), name: '', amount: value }]
    }
  }

  function syncFundYearly(field: 'mortgage' | 'contribution' | 'monthlyOffset', month: number): void {
    const plan = getActivePlan()
    if (!plan.fund) return
    const column = plan.fund[field]
    const template = column.itemSets?.[month]
    if (!template) return
    if (!column.yearlyMonths) column.yearlyMonths = {}
    const moy = month % 100
    const start = plan.systemParams.startMonth
    const end = Number.isFinite(plan.systemParams.endMonth) ? plan.systemParams.endMonth : addMonths(start, 59)
    const totalMonths = projectionMonths(start, end)
    for (let i = 0; i < totalMonths; i++) {
      const m = addMonths(start, i)
      if (m % 100 === moy && m >= month) {
        column.itemSets[m] = template.map(it => ({ id: generateId(), name: it.name, amount: it.amount }))
        column.yearlyMonths[m] = true
      }
    }
  }

  function replaceMonthWithdrawals(month: number, items: { name: string; amount: number }[]): void {
    const plan = getActivePlan()
    if (!plan.fund) return
    plan.fund.withdrawals = plan.fund.withdrawals.filter(w => w.month !== month)
    for (const it of items) {
      const name = it.name.trim()
      if (name && Number.isFinite(it.amount)) {
        plan.fund.withdrawals.push({ id: generateId(), name, month, amount: Math.round(it.amount) })
      }
    }
  }

  function addFundCorrection(month: number, actualBalance: number): void {
    const plan = getActivePlan()
    if (!plan.fund) return
    const existing = plan.fund.corrections.findIndex(a => a.month === month)
    if (existing >= 0) {
      plan.fund.corrections[existing].actualBalance = actualBalance
    } else {
      plan.fund.corrections.push({ month, actualBalance })
    }
  }

  function removeFundCorrection(month: number): void {
    const plan = getActivePlan()
    if (!plan.fund) return
    plan.fund.corrections = plan.fund.corrections.filter(a => a.month !== month)
  }

  function setFundRate(rate: number): void {
    getActivePlan().systemParams.fundRate = rate
  }

  function setFundInterestMonth(m: number): void {
    // 结息月约束 1-12：越界 clamp 到合法区间；非有限数（NaN 等）忽略
    if (!Number.isFinite(m)) return
    getActivePlan().systemParams.fundInterestMonth = Math.min(12, Math.max(1, Math.round(m)))
  }

  function setFundInitialBalance(v: number): void {
    getActivePlan().systemParams.fundInitialBalance = v
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
    reloadWorkspace,
    setStartMonth,
    setEndMonth,
    addColumn,
    removeColumn,
    renameColumn,
    setColumnEnabled,
    moveColumn,
    updateColumnEntry,
    replaceColumnItems,
    setColumnMode,
    syncYearly,
    replaceMonthEvents,
    moveMonthEvents,
    addCorrection,
    removeCorrection,
    addSnapshot,
    removeSnapshot,
    renameSnapshot,
    reset,
    addScenario,
    duplicateScenario,
    removeScenario,
    renameScenario,
    switchScenario,
    enableFund,
    disableFund,
    updateFundEntry,
    syncFundYearly,
    replaceMonthWithdrawals,
    addFundCorrection,
    removeFundCorrection,
    setFundRate,
    setFundInterestMonth,
    setFundInitialBalance,
  }
}
