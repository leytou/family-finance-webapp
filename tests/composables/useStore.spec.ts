import { beforeEach, describe, expect, it, vi } from 'vitest'

async function loadUseStore() {
  return (await import('../../src/composables/useStore')).useStore
}

describe('useStore', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

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

  it('addAnchor 添加锚点并保存', async () => {
    const useStore = await loadUseStore()
    const store = useStore()

    store.addAnchor(202601, 100000)

    expect(store.data.value.anchors).toEqual([{ month: 202601, actualSavings: 100000 }])
    expect(JSON.parse(localStorage.getItem('family-finance-plan') ?? '{}').anchors).toEqual([
      { month: 202601, actualSavings: 100000 },
    ])
  })

  it('addAnchor 同月更新已有锚点而不是重复添加', async () => {
    const useStore = await loadUseStore()
    const store = useStore()

    store.addAnchor(202601, 100000)
    store.addAnchor(202601, 120000)

    expect(store.data.value.anchors).toEqual([{ month: 202601, actualSavings: 120000 }])
    expect(JSON.parse(localStorage.getItem('family-finance-plan') ?? '{}').anchors).toEqual([
      { month: 202601, actualSavings: 120000 },
    ])
  })

  it('removeAnchor 删除锚点并保存', async () => {
    const useStore = await loadUseStore()
    const store = useStore()

    store.data.value.anchors = [
      { month: 202601, actualSavings: 100000 },
      { month: 202602, actualSavings: 120000 },
    ]
    store.save()

    store.removeAnchor(202601)

    expect(store.data.value.anchors).toEqual([{ month: 202602, actualSavings: 120000 }])
    expect(JSON.parse(localStorage.getItem('family-finance-plan') ?? '{}').anchors).toEqual([
      { month: 202602, actualSavings: 120000 },
    ])
  })

  it('reset 清空数据恢复默认', async () => {
    const useStore = await loadUseStore()
    const store = useStore()

    store.data.value.systemParams.currentSavings = 999999
    store.save()
    store.reset()

    expect(store.data.value.systemParams.currentSavings).toBe(0)
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
})
