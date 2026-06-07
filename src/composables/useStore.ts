import { ref } from 'vue'

import type { CashFlowItem, PlanData } from '../types'
import { getCurrentMonth } from '../utils/month'

const STORAGE_KEY = 'family-finance-plan'

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

export function useStore() {
  const raw = localStorage.getItem(STORAGE_KEY)
  const data = ref<PlanData>(raw ? JSON.parse(raw) : createDefault())

  function save() {
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
    save()
  }

  function removeItem(id: string) {
    data.value.items = data.value.items.filter(item => item.id !== id)
    save()
  }

  function reset() {
    data.value = createDefault()
    localStorage.removeItem(STORAGE_KEY)
  }

  return { data, save, addItem, removeItem, reset }
}
