import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

async function loadUseStore() {
  return (await import('../../src/composables/useStore')).useStore
}

describe('useStore', () => {
  beforeEach(() => {
    vi.useRealTimers()
    localStorage.clear()
    vi.resetModules()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  async function flushAutoSave(ms = 300) {
    await nextTick()
    await vi.advanceTimersByTimeAsync(ms)
  }

  it('初次加载返回默认数据', async () => {
    const useStore = await loadUseStore()
    const store = useStore()

    expect(store.data.value.version).toBe(1)
    expect(store.data.value.items).toEqual([])
    expect(store.data.value.anchors).toEqual([])
    expect(store.data.value.systemParams.annualRate).toBe(0.025)
  })

  it('保存后重新加载可恢复', async () => {
    let useStore = await loadUseStore()
    const store1 = useStore()

    store1.data.value.systemParams.currentSavings = 500000
    store1.save()

    vi.resetModules()
    useStore = await loadUseStore()
    const store2 = useStore()

    expect(store2.data.value.systemParams.currentSavings).toBe(500000)
  })

  it('addItem 添加现金流项目', async () => {
    const useStore = await loadUseStore()
    const store = useStore()

    store.addItem('工资', 'income')

    expect(store.data.value.items).toHaveLength(1)
    expect(store.data.value.items[0]).toMatchObject({
      name: '工资',
      type: 'income',
    })
  })

  it('removeItem 删除项目', async () => {
    const useStore = await loadUseStore()
    const store = useStore()

    store.addItem('工资', 'income')
    const id = store.data.value.items[0].id
    store.removeItem(id)

    expect(store.data.value.items).toHaveLength(0)
  })

  it('addAnchor 添加锚点并自动保存', async () => {
    vi.useFakeTimers()
    const useStore = await loadUseStore()
    const store = useStore()

    store.addAnchor(202601, 100000)
    await flushAutoSave()

    expect(store.data.value.anchors).toEqual([{ month: 202601, actualSavings: 100000 }])
    expect(JSON.parse(localStorage.getItem('family-finance-plan') ?? '{}').anchors).toEqual([
      { month: 202601, actualSavings: 100000 },
    ])
  })

  it('addAnchor 同月更新已有锚点而不是重复添加并自动保存', async () => {
    vi.useFakeTimers()
    const useStore = await loadUseStore()
    const store = useStore()

    store.addAnchor(202601, 100000)
    store.addAnchor(202601, 120000)
    await flushAutoSave()

    expect(store.data.value.anchors).toEqual([{ month: 202601, actualSavings: 120000 }])
    expect(JSON.parse(localStorage.getItem('family-finance-plan') ?? '{}').anchors).toEqual([
      { month: 202601, actualSavings: 120000 },
    ])
  })

  it('removeAnchor 删除锚点并自动保存', async () => {
    vi.useFakeTimers()
    const useStore = await loadUseStore()
    const store = useStore()

    store.data.value.anchors = [
      { month: 202601, actualSavings: 100000 },
      { month: 202602, actualSavings: 120000 },
    ]
    store.save()

    store.removeAnchor(202601)
    await flushAutoSave()

    expect(store.data.value.anchors).toEqual([{ month: 202602, actualSavings: 120000 }])
    expect(JSON.parse(localStorage.getItem('family-finance-plan') ?? '{}').anchors).toEqual([
      { month: 202602, actualSavings: 120000 },
    ])
  })

  it('reset 清空数据恢复默认', async () => {
    vi.useFakeTimers()
    const useStore = await loadUseStore()
    const store = useStore()

    store.data.value.systemParams.currentSavings = 999999
    store.save()
    store.reset()
    await flushAutoSave()

    expect(store.data.value.systemParams.currentSavings).toBe(0)
    expect(localStorage.getItem('family-finance-plan')).toBeNull()
  })

  it('reset 后同一轮事件中的新修改仍会自动保存', async () => {
    vi.useFakeTimers()
    const useStore = await loadUseStore()
    const store = useStore()

    store.data.value.systemParams.currentSavings = 999999
    store.save()
    store.reset()
    store.data.value.systemParams.currentSavings = 123456
    await flushAutoSave()

    expect(JSON.parse(localStorage.getItem('family-finance-plan') ?? '{}').systemParams.currentSavings).toBe(
      123456,
    )
  })

  it('exportData 返回反映当前数据的格式化 JSON', async () => {
    const useStore = await loadUseStore()
    const store = useStore()

    store.data.value.systemParams.currentSavings = 123456
    store.data.value.items = [
      {
        id: 'salary',
        name: '工资',
        type: 'income',
        segments: [{ amount: 10000, startMonth: 202601, endMonth: 202612 }],
      },
    ]

    expect(store.exportData()).toBe(JSON.stringify(store.data.value, null, 2))
    expect(store.exportData()).toContain('\n  "version": 1,')
    expect(JSON.parse(store.exportData()).systemParams.currentSavings).toBe(123456)
  })

  it('localStorage 存在 malformed JSON 时不抛错并移除坏数据', async () => {
    localStorage.setItem('family-finance-plan', '{bad json')
    const useStore = await loadUseStore()

    expect(() => useStore()).not.toThrow()

    const store = useStore()
    expect(store.data.value.version).toBe(1)
    expect(store.data.value.items).toEqual([])
    expect(store.data.value.anchors).toEqual([])
    expect(store.data.value.systemParams.currentSavings).toBe(0)
    expect(localStorage.getItem('family-finance-plan')).toBeNull()
  })

  it('localStorage 存在合法 JSON 但缺少 PlanData 必要结构时不抛错并移除坏数据', async () => {
    localStorage.setItem('family-finance-plan', JSON.stringify({ version: 1 }))
    const useStore = await loadUseStore()

    expect(() => useStore()).not.toThrow()

    const store = useStore()
    expect(store.data.value.version).toBe(1)
    expect(store.data.value.items).toEqual([])
    expect(store.data.value.anchors).toEqual([])
    expect(store.data.value.systemParams.currentSavings).toBe(0)
    expect(localStorage.getItem('family-finance-plan')).toBeNull()
  })

  it('localStorage 存在嵌套结构损坏的 PlanData 时不抛错并移除坏数据', async () => {
    localStorage.setItem(
      'family-finance-plan',
      JSON.stringify({
        version: 1,
        systemParams: {
          currentSavings: 100000,
          startMonth: '202601',
          annualRate: 0.025,
        },
        items: [
          {
            id: 'salary',
            name: '工资',
            type: 'income',
          },
        ],
        anchors: [{ month: 202601, actualSavings: 100000 }],
      }),
    )
    const useStore = await loadUseStore()

    expect(() => useStore()).not.toThrow()

    const store = useStore()
    expect(store.data.value.version).toBe(1)
    expect(store.data.value.items).toEqual([])
    expect(store.data.value.anchors).toEqual([])
    expect(store.data.value.systemParams.currentSavings).toBe(0)
    expect(localStorage.getItem('family-finance-plan')).toBeNull()
  })

  it('多次 useStore 调用共享同一个响应式数据源', async () => {
    const useStore = await loadUseStore()
    const a = useStore()
    const b = useStore()

    a.addItem('工资', 'income')

    expect(b.data.value.items).toHaveLength(1)
    expect(b.data.value.items[0]).toMatchObject({
      name: '工资',
      type: 'income',
    })
  })

  it('直接修改系统参数后不调用 save 也会在 300ms 后自动保存', async () => {
    vi.useFakeTimers()
    const useStore = await loadUseStore()
    const store = useStore()

    store.data.value.systemParams.currentSavings = 500000

    await nextTick()
    expect(localStorage.getItem('family-finance-plan')).toBeNull()

    await vi.advanceTimersByTimeAsync(299)
    expect(localStorage.getItem('family-finance-plan')).toBeNull()

    await vi.advanceTimersByTimeAsync(1)
    expect(JSON.parse(localStorage.getItem('family-finance-plan') ?? '{}').systemParams.currentSavings).toBe(
      500000,
    )
  })

  it('自动保存 debounce 生效且连续修改只保存最后一次数据', async () => {
    vi.useFakeTimers()
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const useStore = await loadUseStore()
    const store = useStore()

    store.data.value.systemParams.currentSavings = 100000
    await nextTick()
    await vi.advanceTimersByTimeAsync(299)

    store.data.value.systemParams.currentSavings = 200000
    await nextTick()
    await vi.advanceTimersByTimeAsync(299)

    expect(setItem).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)

    expect(setItem).toHaveBeenCalledTimes(1)
    expect(JSON.parse(localStorage.getItem('family-finance-plan') ?? '{}').systemParams.currentSavings).toBe(
      200000,
    )
  })

  it('多次 useStore 调用不会重复安装自动保存 watcher', async () => {
    vi.useFakeTimers()
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const useStore = await loadUseStore()
    const a = useStore()
    useStore()
    useStore()

    a.data.value.systemParams.currentSavings = 300000
    await flushAutoSave()

    expect(setItem).toHaveBeenCalledTimes(1)
    expect(JSON.parse(localStorage.getItem('family-finance-plan') ?? '{}').systemParams.currentSavings).toBe(
      300000,
    )
  })
})
