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

    expect(store.data.value.version).toBe(2)
    expect(store.data.value.columns).toEqual([])
    expect(store.data.value.anchors).toEqual([])
    expect(store.data.value.systemParams.annualRate).toBe(0.025)
    expect(store.data.value.systemParams.startMonth).toBeDefined()
  })

  it('保存后重新加载可恢复', async () => {
    let useStore = await loadUseStore()
    const store1 = useStore()

    store1.data.value.systemParams.annualRate = 0.05
    store1.save()

    vi.resetModules()
    useStore = await loadUseStore()
    const store2 = useStore()

    expect(store2.data.value.systemParams.annualRate).toBe(0.05)
  })

  it('addColumn 添加列', async () => {
    const useStore = await loadUseStore()
    const store = useStore()

    const column = store.addColumn('工资')

    expect(store.data.value.columns).toHaveLength(1)
    expect(store.data.value.columns[0]).toMatchObject({
      id: column.id,
      name: '工资',
      entries: {},
    })
    expect(column.id).toBeDefined()
    expect(column.id.length).toBeGreaterThan(0)
  })

  it('addColumn 默认名称为"新列"', async () => {
    const useStore = await loadUseStore()
    const store = useStore()

    const column = store.addColumn()

    expect(column.name).toBe('新列')
  })

  it('removeColumn 删除列', async () => {
    const useStore = await loadUseStore()
    const store = useStore()

    const col1 = store.addColumn('工资')
    const col2 = store.addColumn('房租')

    expect(store.data.value.columns).toHaveLength(2)

    store.removeColumn(col1.id)

    expect(store.data.value.columns).toHaveLength(1)
    expect(store.data.value.columns[0].id).toBe(col2.id)
  })

  it('renameColumn 重命名列', async () => {
    const useStore = await loadUseStore()
    const store = useStore()

    const col = store.addColumn('工资')
    store.renameColumn(col.id, '薪水')

    expect(store.data.value.columns[0].name).toBe('薪水')
  })

  it('updateColumnEntry 设置 entry', async () => {
    const useStore = await loadUseStore()
    const store = useStore()

    const col = store.addColumn('工资')
    store.updateColumnEntry(col.id, 202601, 10000)

    expect(store.data.value.columns[0].entries[202601]).toBe(10000)
  })

  it('updateColumnEntry 删除 entry（value 为 null）', async () => {
    const useStore = await loadUseStore()
    const store = useStore()

    const col = store.addColumn('工资')
    store.updateColumnEntry(col.id, 202601, 10000)
    expect(store.data.value.columns[0].entries[202601]).toBe(10000)

    store.updateColumnEntry(col.id, 202601, null)
    expect(store.data.value.columns[0].entries[202601]).toBeUndefined()
  })

  it('updateColumnEntry 不存在的列不抛错', async () => {
    const useStore = await loadUseStore()
    const store = useStore()

    expect(() => store.updateColumnEntry('nonexistent', 202601, 10000)).not.toThrow()
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

    store.data.value.columns = [
      { id: 'col1', name: '工资', entries: { 202601: 10000 } },
    ]
    store.save()
    store.reset()
    await flushAutoSave()

    expect(store.data.value.columns).toEqual([])
    expect(store.data.value.anchors).toEqual([])
    expect(store.data.value.systemParams.annualRate).toBe(0.025)
    expect(localStorage.getItem('family-finance-plan')).toBeNull()
  })

  it('reset 后同一轮事件中的新修改仍会自动保存', async () => {
    vi.useFakeTimers()
    const useStore = await loadUseStore()
    const store = useStore()

    store.data.value.columns = [{ id: 'col1', name: '工资', entries: {} }]
    store.save()
    store.reset()
    store.addColumn('房租')
    await flushAutoSave()

    const saved = JSON.parse(localStorage.getItem('family-finance-plan') ?? '{}')
    expect(saved.columns).toHaveLength(1)
    expect(saved.columns[0].name).toBe('房租')
  })

  it('exportData 返回反映当前数据的格式化 JSON', async () => {
    const useStore = await loadUseStore()
    const store = useStore()

    store.data.value.systemParams.annualRate = 0.05
    store.data.value.columns = [
      {
        id: 'col1',
        name: '工资',
        entries: { 202601: 10000, 202602: 12000 },
      },
    ]

    expect(store.exportData()).toBe(JSON.stringify(store.data.value, null, 2))
    expect(store.exportData()).toContain('"version": 2')
    expect(JSON.parse(store.exportData()).systemParams.annualRate).toBe(0.05)
  })

  it('localStorage 存在 malformed JSON 时不抛错并移除坏数据', async () => {
    localStorage.setItem('family-finance-plan', '{bad json')
    const useStore = await loadUseStore()

    expect(() => useStore()).not.toThrow()

    const store = useStore()
    expect(store.data.value.version).toBe(2)
    expect(store.data.value.columns).toEqual([])
    expect(store.data.value.anchors).toEqual([])
    expect(localStorage.getItem('family-finance-plan')).toBeNull()
  })

  it('localStorage 存在合法 JSON 但缺少 PlanData 必要结构时不抛错并移除坏数据', async () => {
    localStorage.setItem('family-finance-plan', JSON.stringify({ version: 2 }))
    const useStore = await loadUseStore()

    expect(() => useStore()).not.toThrow()

    const store = useStore()
    expect(store.data.value.version).toBe(2)
    expect(store.data.value.columns).toEqual([])
    expect(store.data.value.anchors).toEqual([])
    expect(localStorage.getItem('family-finance-plan')).toBeNull()
  })

  it('localStorage 存在嵌套结构损坏的 PlanData 时不抛错并移除坏数据', async () => {
    localStorage.setItem(
      'family-finance-plan',
      JSON.stringify({
        version: 2,
        systemParams: {
          startMonth: 202601,
          annualRate: 0.025,
        },
        columns: [
          {
            id: 'col1',
            name: '工资',
            // 缺少 entries
          },
        ],
        anchors: [{ month: 202601, actualSavings: 100000 }],
      }),
    )
    const useStore = await loadUseStore()

    expect(() => useStore()).not.toThrow()

    const store = useStore()
    expect(store.data.value.version).toBe(2)
    expect(store.data.value.columns).toEqual([])
    expect(store.data.value.anchors).toEqual([])
    expect(localStorage.getItem('family-finance-plan')).toBeNull()
  })

  it('多次 useStore 调用共享同一个响应式数据源', async () => {
    const useStore = await loadUseStore()
    const a = useStore()
    const b = useStore()

    a.addColumn('工资')

    expect(b.data.value.columns).toHaveLength(1)
    expect(b.data.value.columns[0]).toMatchObject({
      name: '工资',
    })
  })

  it('直接修改系统参数后不调用 save 也会在 300ms 后自动保存', async () => {
    vi.useFakeTimers()
    const useStore = await loadUseStore()
    const store = useStore()

    store.data.value.systemParams.annualRate = 0.05

    await nextTick()
    expect(localStorage.getItem('family-finance-plan')).toBeNull()

    await vi.advanceTimersByTimeAsync(299)
    expect(localStorage.getItem('family-finance-plan')).toBeNull()

    await vi.advanceTimersByTimeAsync(1)
    expect(JSON.parse(localStorage.getItem('family-finance-plan') ?? '{}').systemParams.annualRate).toBe(0.05)
  })

  it('自动保存 debounce 生效且连续修改只保存最后一次数据', async () => {
    vi.useFakeTimers()
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const useStore = await loadUseStore()
    const store = useStore()

    store.data.value.systemParams.annualRate = 0.03
    await nextTick()
    await vi.advanceTimersByTimeAsync(299)

    store.data.value.systemParams.annualRate = 0.04
    await nextTick()
    await vi.advanceTimersByTimeAsync(299)

    expect(setItem).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)

    expect(setItem).toHaveBeenCalledTimes(1)
    expect(JSON.parse(localStorage.getItem('family-finance-plan') ?? '{}').systemParams.annualRate).toBe(0.04)
  })

  it('多次 useStore 调用不会重复安装自动保存 watcher', async () => {
    vi.useFakeTimers()
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const useStore = await loadUseStore()
    const a = useStore()
    useStore()
    useStore()

    a.data.value.systemParams.annualRate = 0.06
    await flushAutoSave()

    expect(setItem).toHaveBeenCalledTimes(1)
    expect(JSON.parse(localStorage.getItem('family-finance-plan') ?? '{}').systemParams.annualRate).toBe(0.06)
  })

  it('旧格式数据（version 1）加载时返回默认值', async () => {
    localStorage.setItem(
      'family-finance-plan',
      JSON.stringify({
        version: 1,
        systemParams: {
          currentSavings: 100000,
          startMonth: 202601,
          annualRate: 0.025,
        },
        items: [
          {
            id: 'salary',
            name: '工资',
            type: 'income',
            segments: [{ amount: 10000, startMonth: 202601, endMonth: 203012 }],
          },
        ],
        anchors: [{ month: 202601, actualSavings: 100000 }],
      }),
    )

    const useStore = await loadUseStore()
    const store = useStore()

    // 应该返回默认值，因为旧格式被视为无效
    expect(store.data.value.version).toBe(2)
    expect(store.data.value.columns).toEqual([])
    expect(store.data.value.anchors).toEqual([])
    expect(localStorage.getItem('family-finance-plan')).toBeNull()
  })
})
