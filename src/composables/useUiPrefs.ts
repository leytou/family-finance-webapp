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

// 容错读取：逐字段校验，避免单个脏值（null/字符串等）连累丢弃其它已保存的偏好；整体解析失败则全部回退展开
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

// 折叠状态低频（每次点击单次写），有意不做防抖；与 useStore 财务数据的防抖落盘不同
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
