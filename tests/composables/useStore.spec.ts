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

  it('updateColumnEntry 删除 entry 时联动清除 yearlyMonths 标记', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.data.value.systemParams.startMonth = 202601
    const col = store.addColumn('年终奖')
    store.updateColumnEntry(col.id, 202612, 50000)
    store.syncYearly(col.id, 202612)
    const column = store.data.value.columns[0]
    expect(column.yearlyMonths?.[202612]).toBe(true)

    store.updateColumnEntry(col.id, 202612, null)
    expect(column.entries[202612]).toBeUndefined()
    expect(column.yearlyMonths?.[202612]).toBeUndefined()
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

  it('默认方案的 plan 含空 snapshots 数组', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    expect(store.data.value.snapshots).toEqual([])
  })

  it('加载缺少 snapshots 字段的存量 Workspace 时补为空数组且不清空数据', async () => {
    localStorage.setItem(
      'family-finance-plan',
      JSON.stringify({
        version: 1,
        activeId: 'sc1',
        scenarios: [
          {
            id: 'sc1',
            name: '默认方案',
            plan: {
              version: 2,
              systemParams: { startMonth: 202601, annualRate: 0.025 },
              columns: [],
              anchors: [{ month: 202601, actualSavings: 100000 }],
              // 注意：故意不含 snapshots
            },
          },
        ],
      }),
    )
    const useStore = await loadUseStore()
    const store = useStore()
    expect(store.data.value.anchors).toEqual([{ month: 202601, actualSavings: 100000 }])
    expect(store.data.value.snapshots).toEqual([])
  })

  it('addSnapshot 收录各月累计储蓄并按 createdMonth 命名', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.data.value.systemParams.startMonth = 202601
    store.data.value.systemParams.annualRate = 0
    store.addColumn('工资')
    const colId = store.data.value.columns[0].id
    store.updateColumnEntry(colId, 202601, 5000)

    const snap = store.addSnapshot()

    expect(store.data.value.snapshots).toHaveLength(1)
    expect(snap.name).toBe('2026-01 计划')
    expect(snap.createdMonth).toBe(202601)
    expect(snap.projection[202601]).toBe(5000)
    expect(snap.projection[202602]).toBe(10000)
  })

  it('removeSnapshot 删除指定快照', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    const snap = store.addSnapshot()
    store.removeSnapshot(snap.id)
    expect(store.data.value.snapshots).toEqual([])
  })

  it('renameSnapshot 重命名指定快照', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    const snap = store.addSnapshot()
    store.renameSnapshot(snap.id, '买房前基线')
    expect(store.data.value.snapshots[0].name).toBe('买房前基线')
  })

  it('reset 清空当前方案的 snapshots', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.addSnapshot()
    store.reset()
    expect(store.data.value.snapshots).toEqual([])
  })

  it('默认方案的初始存款为 0', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    expect(store.data.value.systemParams.initialDeposit).toBe(0)
  })

  it('加载缺少 initialDeposit 的存量数据时补 0 且不清空数据', async () => {
    localStorage.setItem(
      'family-finance-plan',
      JSON.stringify({
        version: 1,
        activeId: 'sc1',
        scenarios: [
          {
            id: 'sc1',
            name: '默认方案',
            plan: {
              version: 2,
              systemParams: { startMonth: 202601, annualRate: 0.025 },
              columns: [],
              anchors: [{ month: 202601, actualSavings: 100000 }],
            },
          },
        ],
      }),
    )
    const useStore = await loadUseStore()
    const store = useStore()
    expect(store.data.value.systemParams.initialDeposit).toBe(0)
    expect(store.data.value.anchors).toEqual([{ month: 202601, actualSavings: 100000 }])
  })

  describe('syncYearly', () => {
    it('从当前月起向下写入所有年份同月并标记 yearly（源头为最早同月时覆盖全部）', async () => {
      const useStore = await loadUseStore()
      const store = useStore()
      store.data.value.systemParams.startMonth = 202601
      const col = store.addColumn('年终奖')
      store.updateColumnEntry(col.id, 202612, 50000)

      store.syncYearly(col.id, 202612)

      const column = store.data.value.columns[0]
      // 投影范围 202601..203012 内所有 12 月
      expect(column.entries[202612]).toBe(50000)
      expect(column.entries[202712]).toBe(50000)
      expect(column.entries[202812]).toBe(50000)
      expect(column.entries[202912]).toBe(50000)
      expect(column.entries[203012]).toBe(50000)
      expect(column.yearlyMonths?.[202612]).toBe(true)
      expect(column.yearlyMonths?.[202712]).toBe(true)
      expect(column.yearlyMonths?.[203012]).toBe(true)
    })

    it('对无值的月不操作', async () => {
      const useStore = await loadUseStore()
      const store = useStore()
      store.data.value.systemParams.startMonth = 202601
      const col = store.addColumn('年终奖')
      // 202612 没有 entry
      store.syncYearly(col.id, 202612)
      const column = store.data.value.columns[0]
      expect(column.entries[202612]).toBeUndefined()
      expect(column.yearlyMonths).toBeUndefined()
    })

    it('不存在的列不抛错', async () => {
      const useStore = await loadUseStore()
      const store = useStore()
      expect(() => store.syncYearly('nonexistent', 202612)).not.toThrow()
    })

    it('直接修改某月 entry 不影响其它年份同月（快照语义）', async () => {
      const useStore = await loadUseStore()
      const store = useStore()
      store.data.value.systemParams.startMonth = 202601
      const col = store.addColumn('年终奖')
      store.updateColumnEntry(col.id, 202612, 50000)
      store.syncYearly(col.id, 202612)

      // 单独改 202712，其它年份不变
      store.updateColumnEntry(col.id, 202712, 70000)
      const column = store.data.value.columns[0]
      expect(column.entries[202612]).toBe(50000)
      expect(column.entries[202712]).toBe(70000)
      expect(column.entries[202812]).toBe(50000)
    })

    it('只同步到当前月及下方年份同月，不破坏过去（上方）年份', async () => {
      const useStore = await loadUseStore()
      const store = useStore()
      store.data.value.systemParams.startMonth = 202601
      const col = store.addColumn('年终奖')
      // 过去年份已有不同实际值
      store.updateColumnEntry(col.id, 202612, 50000)
      store.updateColumnEntry(col.id, 202712, 60000)
      // 在 202812 填值并同步
      store.updateColumnEntry(col.id, 202812, 70000)
      store.syncYearly(col.id, 202812)

      const column = store.data.value.columns[0]
      // 上方（过去）年份保持原值、未被标记
      expect(column.entries[202612]).toBe(50000)
      expect(column.entries[202712]).toBe(60000)
      expect(column.yearlyMonths?.[202612]).toBeUndefined()
      expect(column.yearlyMonths?.[202712]).toBeUndefined()
      // 当前月及下方年份被写入 70000 并标记
      expect(column.entries[202812]).toBe(70000)
      expect(column.entries[202912]).toBe(70000)
      expect(column.entries[203012]).toBe(70000)
      expect(column.yearlyMonths?.[202812]).toBe(true)
      expect(column.yearlyMonths?.[202912]).toBe(true)
      expect(column.yearlyMonths?.[203012]).toBe(true)
    })
  })

  describe('moveColumn', () => {
    it('side=before 将列插到目标列前', async () => {
      const useStore = await loadUseStore()
      const store = useStore()
      const a = store.addColumn('A')
      const b = store.addColumn('B')
      const c = store.addColumn('C')

      store.moveColumn(c.id, a.id, 'before')

      expect(store.data.value.columns.map(col => col.id)).toEqual([c.id, a.id, b.id])
    })

    it('side=after 将列插到目标列后', async () => {
      const useStore = await loadUseStore()
      const store = useStore()
      const a = store.addColumn('A')
      const b = store.addColumn('B')
      const c = store.addColumn('C')

      store.moveColumn(a.id, c.id, 'after')

      expect(store.data.value.columns.map(col => col.id)).toEqual([b.id, c.id, a.id])
    })

    it('fromId 等于 toId 时无变化', async () => {
      const useStore = await loadUseStore()
      const store = useStore()
      const a = store.addColumn('A')
      const b = store.addColumn('B')

      store.moveColumn(a.id, a.id, 'before')

      expect(store.data.value.columns.map(col => col.id)).toEqual([a.id, b.id])
    })

    it('不存在的 fromId 无变化', async () => {
      const useStore = await loadUseStore()
      const store = useStore()
      const a = store.addColumn('A')

      store.moveColumn('不存在', a.id, 'before')

      expect(store.data.value.columns.map(col => col.id)).toEqual([a.id])
    })

    it('重排后列数据(名称、条目)完整跟随', async () => {
      const useStore = await loadUseStore()
      const store = useStore()
      const a = store.addColumn('工资')
      store.updateColumnEntry(a.id, 202601, 5000)
      const b = store.addColumn('房租')

      store.moveColumn(b.id, a.id, 'before')

      const moved = store.data.value.columns.find(col => col.id === a.id)
      expect(moved?.name).toBe('工资')
      expect(moved?.entries[202601]).toBe(5000)
    })

    it('保存后重新加载顺序保留', async () => {
      let useStore = await loadUseStore()
      const store1 = useStore()
      store1.addColumn('A')
      store1.addColumn('B')
      const c = store1.addColumn('C')
      store1.moveColumn(c.id, store1.data.value.columns[0]!.id, 'before')
      store1.save()

      vi.resetModules()
      useStore = await loadUseStore()
      const store2 = useStore()

      expect(store2.data.value.columns.map(col => col.name)).toEqual(['C', 'A', 'B'])
    })
  })

  describe('setStartMonth', () => {
    it('合法月份写入并返回 true', async () => {
      const useStore = await loadUseStore()
      const store = useStore()

      expect(store.setStartMonth(202603)).toBe(true)
      expect(store.data.value.systemParams.startMonth).toBe(202603)
    })

    it('越界月份进位后写入规范化值', async () => {
      const useStore = await loadUseStore()
      const store = useStore()

      expect(store.setStartMonth(202613)).toBe(true)
      expect(store.data.value.systemParams.startMonth).toBe(202701)
    })

    it('0 月进位为上年 12 月', async () => {
      const useStore = await loadUseStore()
      const store = useStore()

      expect(store.setStartMonth(202600)).toBe(true)
      expect(store.data.value.systemParams.startMonth).toBe(202512)
    })

    it('位数不足返回 false 且不改原值', async () => {
      const useStore = await loadUseStore()
      const store = useStore()
      const before = store.data.value.systemParams.startMonth

      expect(store.setStartMonth(2026)).toBe(false)
      expect(store.data.value.systemParams.startMonth).toBe(before)
    })

    it('作用于当前激活方案', async () => {
      const useStore = await loadUseStore()
      const store = useStore()
      const other = store.addScenario()           // 新建并激活新方案
      await nextTick()
      const previousActive = store.workspace.value.scenarios[0]

      store.setStartMonth(202709)

      expect(store.data.value.systemParams.startMonth).toBe(202709)           // 当前激活方案已写入
      expect(other.plan.systemParams.startMonth).toBe(202709)                 // other 即激活方案
      expect(previousActive.plan.systemParams.startMonth).not.toBe(202709)    // 非激活方案不受影响
    })
  })
})
