import { ref, watch, type Ref } from 'vue'

import type { CashFlowItem, PlanData } from '../types'
import { getCurrentMonth } from '../utils/month'

const STORAGE_KEY = 'family-finance-plan'

let sharedData: Ref<PlanData> | null = null
let saveTimeout: ReturnType<typeof setTimeout> | null = null
let resetSnapshot: string | null = null

function createDefault(): PlanData {
  return {
    version: 1,
    systemParams: {
      currentSavings: 0,
      startMonth: getCurrentMonth(),
      annualRate: 0.025,
    },
    items: [],
    anchors: [],
  }
}

function loadData(): PlanData {
  const raw = localStorage.getItem(STORAGE_KEY)

  if (!raw) {
    return createDefault()
  }

  try {
    return JSON.parse(raw) as PlanData
  } catch {
    localStorage.removeItem(STORAGE_KEY)

    return createDefault()
  }
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

  function addItem(name: string, type: 'income' | 'expense') {
    const item: CashFlowItem = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name,
      type,
      segments: [],
    }

    data.value.items.push(item)
  }

  function removeItem(id: string) {
    data.value.items = data.value.items.filter(item => item.id !== id)
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

  return { data, save, addItem, removeItem, addAnchor, removeAnchor, reset, exportData }
}
