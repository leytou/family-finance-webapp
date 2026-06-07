import { ref, watch, type Ref } from 'vue'
import type { PlanData, FlowColumn } from '../types'
import { getCurrentMonth } from '../utils/month'

const STORAGE_KEY = 'family-finance-plan'
let sharedData: Ref<PlanData> | null = null
let saveTimeout: ReturnType<typeof setTimeout> | null = null
let resetSnapshot: string | null = null

function createDefault(): PlanData {
  return {
    version: 2,
    systemParams: {
      startMonth: getCurrentMonth(),
      annualRate: 0.025,
    },
    columns: [],
    anchors: [],
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
  return true
}

function isValidAnchor(value: unknown): boolean {
  if (!isObject(value)) return false
  return isFiniteNumber(value.month) && isFiniteNumber(value.actualSavings)
}

function isValidPlanData(value: unknown): value is PlanData {
  if (!isObject(value) || !isObject(value.systemParams)) return false
  // 只接受 v2 格式，旧格式(v1)视为无效数据
  if (value.version !== 2) return false
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

function loadData(): PlanData {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return createDefault()
  try {
    const parsed: unknown = JSON.parse(raw)
    if (isValidPlanData(parsed)) return parsed
  } catch {
    // Fall through to recovery
  }
  localStorage.removeItem(STORAGE_KEY)
  return createDefault()
}

export function useStore() {
  if (!sharedData) {
    sharedData = ref<PlanData>(loadData())
    watch(
      sharedData,
      () => {
        const currentSnapshot = JSON.stringify(sharedData?.value)
        if (resetSnapshot === currentSnapshot) {
          resetSnapshot = null
          return
        }
        resetSnapshot = null
        if (saveTimeout) clearTimeout(saveTimeout)
        saveTimeout = setTimeout(() => {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(sharedData?.value))
          saveTimeout = null
        }, 300)
      },
      { deep: true },
    )
  }

  const data = sharedData

  function save() {
    if (saveTimeout) {
      clearTimeout(saveTimeout)
      saveTimeout = null
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data.value))
  }

  // 列操作函数
  function addColumn(name?: string): FlowColumn {
    const column: FlowColumn = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: name || '新列',
      entries: {},
    }
    data.value.columns.push(column)
    return column
  }

  function removeColumn(id: string): void {
    data.value.columns = data.value.columns.filter(col => col.id !== id)
  }

  function renameColumn(id: string, name: string): void {
    const column = data.value.columns.find(col => col.id === id)
    if (column) {
      column.name = name
    }
  }

  function updateColumnEntry(colId: string, month: number, value: number | null): void {
    const column = data.value.columns.find(col => col.id === colId)
    if (!column) return

    if (value === null) {
      // 删除 entry
      delete column.entries[month]
    } else {
      // 设置 entry
      column.entries[month] = value
    }
  }

  function addAnchor(month: number, actualSavings: number) {
    const existing = data.value.anchors.findIndex(anchor => anchor.month === month)
    if (existing >= 0) {
      data.value.anchors[existing].actualSavings = actualSavings
    } else {
      data.value.anchors.push({ month, actualSavings })
    }
  }

  function removeAnchor(month: number) {
    data.value.anchors = data.value.anchors.filter(anchor => anchor.month !== month)
  }

  function reset() {
    if (saveTimeout) {
      clearTimeout(saveTimeout)
      saveTimeout = null
    }
    const defaultData = createDefault()
    resetSnapshot = JSON.stringify(defaultData)
    data.value = defaultData
    localStorage.removeItem(STORAGE_KEY)
  }

  function exportData(): string {
    return JSON.stringify(data.value, null, 2)
  }

  return {
    data,
    save,
    addColumn,
    removeColumn,
    renameColumn,
    updateColumnEntry,
    addAnchor,
    removeAnchor,
    reset,
    exportData,
  }
}
