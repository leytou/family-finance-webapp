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
    expect(JSON.parse(localStorage.getItem('family-finance-plan') ?? '{}').scenarios[0].plan.anchors).toEqual([
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
    expect(JSON.parse(localStorage.getItem('family-finance-plan') ?? '{}').scenarios[0].plan.anchors).toEqual([
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
    expect(JSON.parse(localStorage.getItem('family-finance-plan') ?? '{}').scenarios[0].plan.anchors).toEqual([
      { month: 202602, actualSavings: 120000 },
    ])
  })

  it('reset 仅重置当前方案恢复默认', async () => {
    vi.useFakeTimers()
    const useStore = await loadUseStore()
    const store = useStore()

    store.data.value.columns = [
      { id: 'col1', name: '工资', entries: { 202601: 10000 } },
    ]
    store.save()
    store.reset()
    await flushAutoSave()

    // 当前方案被重置
    expect(store.data.value.columns).toEqual([])
    expect(store.data.value.anchors).toEqual([])
    expect(store.data.value.systemParams.annualRate).toBe(0.025)
    // Workspace 仍存在于 localStorage
    const saved = JSON.parse(localStorage.getItem('family-finance-plan') ?? '{}')
    expect(saved.version).toBe(1)
    expect(saved.scenarios).toHaveLength(1)
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
    expect(saved.scenarios[0].plan.columns).toHaveLength(1)
    expect(saved.scenarios[0].plan.columns[0].name).toBe('房租')
  })


  it('localStorage 存在 malformed JSON 时不抛错并移除坏数据', async () => {
    localStorage.setItem('family-finance-plan', '{bad json')
    const useStore = await loadUseStore()

    expect(() => useStore()).not.toThrow()

    const store = useStore()
    expect(store.data.value.version).toBe(2)
    expect(store.data.value.columns).toEqual([])
    expect(store.data.value.anchors).toEqual([])
    const saved = JSON.parse(localStorage.getItem('family-finance-plan') ?? '{}')
    expect(saved.version).toBe(1)
    expect(saved.scenarios).toHaveLength(1)
  })

  it('localStorage 存在合法 JSON 但缺少 PlanData 必要结构时不抛错并移除坏数据', async () => {
    localStorage.setItem('family-finance-plan', JSON.stringify({ version: 2 }))
    const useStore = await loadUseStore()

    expect(() => useStore()).not.toThrow()

    const store = useStore()
    expect(store.data.value.version).toBe(2)
    expect(store.data.value.columns).toEqual([])
    expect(store.data.value.anchors).toEqual([])
    const saved = JSON.parse(localStorage.getItem('family-finance-plan') ?? '{}')
    expect(saved.version).toBe(1)
    expect(saved.scenarios).toHaveLength(1)
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
    const saved = JSON.parse(localStorage.getItem('family-finance-plan') ?? '{}')
    expect(saved.version).toBe(1)
    expect(saved.scenarios).toHaveLength(1)
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
    expect(JSON.parse(localStorage.getItem('family-finance-plan') ?? '{}').scenarios[0].plan.systemParams.annualRate).toBe(0.05)
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
    expect(JSON.parse(localStorage.getItem('family-finance-plan') ?? '{}').scenarios[0].plan.systemParams.annualRate).toBe(0.04)
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
    expect(JSON.parse(localStorage.getItem('family-finance-plan') ?? '{}').scenarios[0].plan.systemParams.annualRate).toBe(0.06)
  })

  it('旧格式数据（version 1）加载时返回默认 Workspace', async () => {
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

    // 旧格式被视为无效，返回默认 Workspace
    expect(store.data.value.version).toBe(2)
    expect(store.data.value.columns).toEqual([])
    expect(store.data.value.anchors).toEqual([])
  })

  it('旧 PlanData 格式自动迁移为 Workspace 默认方案', async () => {
    const oldPlan = {
      version: 2,
      systemParams: { startMonth: 202601, annualRate: 0.025 },
      columns: [{ id: 'col1', name: '工资', entries: { 202601: 10000 } }],
      anchors: [{ month: 202601, actualSavings: 50000 }],
    }
    localStorage.setItem('family-finance-plan', JSON.stringify(oldPlan))

    const useStore = await loadUseStore()
    const store = useStore()

    // data 仍可正常访问（指向迁移后的默认方案 plan）
    expect(store.data.value.columns).toHaveLength(1)
    expect(store.data.value.columns[0].name).toBe('工资')
    expect(store.data.value.columns[0].entries[202601]).toBe(10000)
    expect(store.data.value.anchors).toEqual([{ month: 202601, actualSavings: 50000 }])
    expect(store.data.value.systemParams.startMonth).toBe(202601)

    // workspace 结构正确
    expect(store.workspace.value.version).toBe(1)
    expect(store.workspace.value.scenarios).toHaveLength(1)
    expect(store.workspace.value.scenarios[0].name).toBe('默认方案')
    expect(store.workspace.value.activeId).toBe(store.workspace.value.scenarios[0].id)

    // 已写回为 Workspace 格式
    const saved = JSON.parse(localStorage.getItem('family-finance-plan') ?? '{}')
    expect(saved.version).toBe(1)
    expect(saved.scenarios).toHaveLength(1)
    expect(saved.scenarios[0].name).toBe('默认方案')
  })

  it('初次加载创建包含默认方案的 Workspace', async () => {
    const useStore = await loadUseStore()
    const store = useStore()

    expect(store.workspace.value.version).toBe(1)
    expect(store.workspace.value.scenarios).toHaveLength(1)
    expect(store.workspace.value.scenarios[0].name).toBe('默认方案')
    expect(store.workspace.value.activeId).toBe(store.workspace.value.scenarios[0].id)
    // 默认方案的 plan 是空白 plan
    expect(store.data.value.columns).toEqual([])
    expect(store.data.value.anchors).toEqual([])
  })

  it('加载已有的 Workspace 格式数据', async () => {
    const workspace = {
      version: 1,
      scenarios: [
        { id: 's1', name: '买房方案', plan: { version: 2, systemParams: { startMonth: 202601, annualRate: 0.03 }, columns: [], anchors: [] } },
        { id: 's2', name: '租房方案', plan: { version: 2, systemParams: { startMonth: 202601, annualRate: 0.025 }, columns: [], anchors: [] } },
      ],
      activeId: 's2',
    }
    localStorage.setItem('family-finance-plan', JSON.stringify(workspace))

    const useStore = await loadUseStore()
    const store = useStore()

    // data 指向 activeId = s2 的 plan
    expect(store.data.value.systemParams.annualRate).toBe(0.025)
    expect(store.workspace.value.scenarios).toHaveLength(2)
    expect(store.workspace.value.activeId).toBe('s2')
  })

  it('Workspace 中 activeId 无效时返回默认 Workspace', async () => {
    const badWorkspace = {
      version: 1,
      scenarios: [
        { id: 's1', name: '方案A', plan: { version: 2, systemParams: { startMonth: 202601, annualRate: 0.025 }, columns: [], anchors: [] } },
      ],
      activeId: 'nonexistent',
    }
    localStorage.setItem('family-finance-plan', JSON.stringify(badWorkspace))

    const useStore = await loadUseStore()
    const store = useStore()

    // 应返回默认 Workspace
    expect(store.workspace.value.scenarios).toHaveLength(1)
    expect(store.workspace.value.scenarios[0].name).toBe('默认方案')
  })

  describe('方案操作', () => {
    it('addScenario 创建空白方案并激活', async () => {
      const useStore = await loadUseStore()
      const store = useStore()

      expect(store.workspace.value.scenarios).toHaveLength(1)
      const newScenario = store.addScenario()
      await nextTick()

      expect(store.workspace.value.scenarios).toHaveLength(2)
      expect(store.workspace.value.activeId).toBe(newScenario.id)
      expect(newScenario.name).toBe('')
      expect(newScenario.plan.columns).toEqual([])
      expect(newScenario.plan.anchors).toEqual([])
      // data 指向新方案（通过 activeId 找到的 scenario.plan）
      expect(store.data.value).toEqual(newScenario.plan)
      // systemParams 也相同
      expect(store.data.value.systemParams.startMonth).toBe(newScenario.plan.systemParams.startMonth)
      expect(store.data.value.systemParams.annualRate).toBe(newScenario.plan.systemParams.annualRate)
    })

    it('duplicateScenario 深拷贝当前方案并激活', async () => {
      const useStore = await loadUseStore()
      const store = useStore()

      // 在当前方案中添加数据
      const col = store.addColumn('工资')
      store.updateColumnEntry(col.id, 202601, 10000)
      store.addAnchor(202601, 50000)

      const originalId = store.workspace.value.activeId
      const duplicated = store.duplicateScenario()

      expect(store.workspace.value.scenarios).toHaveLength(2)
      expect(store.workspace.value.activeId).toBe(duplicated.id)
      expect(duplicated.id).not.toBe(originalId)
      expect(duplicated.name).toBe('')
      // 深拷贝：数据相同但不是同一引用
      expect(duplicated.plan.columns).toHaveLength(1)
      expect(duplicated.plan.columns[0].name).toBe('工资')
      expect(duplicated.plan.columns[0].entries[202601]).toBe(10000)
      expect(duplicated.plan.anchors).toEqual([{ month: 202601, actualSavings: 50000 }])
      // 修改新方案不影响原方案
      store.renameColumn(duplicated.plan.columns[0].id, '薪水')
      const original = store.workspace.value.scenarios.find((s) => s.id === originalId)!
      expect(original.plan.columns[0].name).toBe('工资')
    })

    it('removeScenario 删除指定方案，若删当前则切换到第一个', async () => {
      const useStore = await loadUseStore()
      const store = useStore()

      const s1 = store.addScenario()
      const s2 = store.addScenario()
      // activeId 是 s2 的 id
      store.removeScenario(s2.id)

      expect(store.workspace.value.scenarios).toHaveLength(2)
      // 删的是当前方案，自动切换到第一个
      expect(store.workspace.value.activeId).toBe(store.workspace.value.scenarios[0].id)
    })

    it('removeScenario 删除非当前方案不影响 activeId', async () => {
      const useStore = await loadUseStore()
      const store = useStore()

      const s1 = store.addScenario()
      const s2 = store.addScenario()
      // activeId 是 s2 的 id，删除 s1 不影响
      store.removeScenario(s1.id)

      expect(store.workspace.value.activeId).toBe(s2.id)
      expect(store.workspace.value.scenarios).toHaveLength(2)
    })

    it('removeScenario 仅剩一个方案时禁止删除', async () => {
      const useStore = await loadUseStore()
      const store = useStore()

      const onlyId = store.workspace.value.scenarios[0].id
      store.removeScenario(onlyId)

      // 不应删除
      expect(store.workspace.value.scenarios).toHaveLength(1)
      expect(store.workspace.value.scenarios[0].id).toBe(onlyId)
    })

    it('renameScenario 重命名指定方案', async () => {
      const useStore = await loadUseStore()
      const store = useStore()

      const id = store.workspace.value.scenarios[0].id
      store.renameScenario(id, '买房方案')

      expect(store.workspace.value.scenarios[0].name).toBe('买房方案')
    })

    it('switchScenario 切换激活方案', async () => {
      const useStore = await loadUseStore()
      const store = useStore()

      store.renameScenario(store.workspace.value.scenarios[0].id, '方案A')
      const s2 = store.addScenario()
      await nextTick()
      store.renameScenario(s2.id, '方案B')

      // 当前是方案B
      expect(store.workspace.value.activeId).toBe(s2.id)
      expect(store.data.value).toEqual(s2.plan)
      expect(store.data.value.systemParams.startMonth).toBe(s2.plan.systemParams.startMonth)

      // 切换到方案A
      store.switchScenario(store.workspace.value.scenarios[0].id)
      await nextTick()
      expect(store.workspace.value.activeId).toBe(store.workspace.value.scenarios[0].id)
      expect(store.data.value).toEqual(store.workspace.value.scenarios[0].plan)
      expect(store.data.value.systemParams.startMonth).toBe(store.workspace.value.scenarios[0].plan.systemParams.startMonth)
    })

    it('switchScenario 无效 id 不切换', async () => {
      const useStore = await loadUseStore()
      const store = useStore()

      const originalId = store.workspace.value.activeId
      store.switchScenario('nonexistent')
      expect(store.workspace.value.activeId).toBe(originalId)
    })
  })
})
