import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addMonths } from '../../src/utils/month'

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

    expect(store.data.value.version).toBe(3)
    expect(store.data.value.columns).toEqual([])
    expect(store.data.value.corrections).toEqual([])
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
      itemSets: {},
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

    expect(store.data.value.columns[0].itemSets[202601][0].amount).toBe(10000)
  })

  it('updateColumnEntry 删除 entry（value 为 null）', async () => {
    const useStore = await loadUseStore()
    const store = useStore()

    const col = store.addColumn('工资')
    store.updateColumnEntry(col.id, 202601, 10000)
    expect(store.data.value.columns[0].itemSets[202601][0].amount).toBe(10000)

    store.updateColumnEntry(col.id, 202601, null)
    expect(store.data.value.columns[0].itemSets[202601]).toBeUndefined()
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
    expect(column.itemSets[202612]).toBeUndefined()
    expect(column.yearlyMonths?.[202612]).toBeUndefined()
  })

  it('addCorrection 添加修正并自动保存', async () => {
    vi.useFakeTimers()
    const useStore = await loadUseStore()
    const store = useStore()

    store.addCorrection(202601, 100000)
    await flushAutoSave()

    expect(store.data.value.corrections).toEqual([{ month: 202601, actualSavings: 100000 }])
    expect(JSON.parse(localStorage.getItem('family-finance-plan') ?? '{}').scenarios[0].plan.corrections).toEqual([
      { month: 202601, actualSavings: 100000 },
    ])
  })

  it('addCorrection 同月更新已有修正而不是重复添加并自动保存', async () => {
    vi.useFakeTimers()
    const useStore = await loadUseStore()
    const store = useStore()

    store.addCorrection(202601, 100000)
    store.addCorrection(202601, 120000)
    await flushAutoSave()

    expect(store.data.value.corrections).toEqual([{ month: 202601, actualSavings: 120000 }])
    expect(JSON.parse(localStorage.getItem('family-finance-plan') ?? '{}').scenarios[0].plan.corrections).toEqual([
      { month: 202601, actualSavings: 120000 },
    ])
  })

  it('removeCorrection 删除修正并自动保存', async () => {
    vi.useFakeTimers()
    const useStore = await loadUseStore()
    const store = useStore()

    store.data.value.corrections = [
      { month: 202601, actualSavings: 100000 },
      { month: 202602, actualSavings: 120000 },
    ]
    store.save()

    store.removeCorrection(202601)
    await flushAutoSave()

    expect(store.data.value.corrections).toEqual([{ month: 202602, actualSavings: 120000 }])
    expect(JSON.parse(localStorage.getItem('family-finance-plan') ?? '{}').scenarios[0].plan.corrections).toEqual([
      { month: 202602, actualSavings: 120000 },
    ])
  })

  it('reset 仅重置当前方案恢复默认', async () => {
    vi.useFakeTimers()
    const useStore = await loadUseStore()
    const store = useStore()

    store.data.value.columns = [
      { id: 'col1', name: '工资', itemSets: { 202601: [{ id: "i1", name: "", amount: 10000 }] } },
    ]
    store.save()
    store.reset()
    await flushAutoSave()

    // 当前方案被重置
    expect(store.data.value.columns).toEqual([])
    expect(store.data.value.corrections).toEqual([])
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

    store.data.value.columns = [{ id: 'col1', name: '工资', itemSets: {} }]
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
    expect(store.data.value.version).toBe(3)
    expect(store.data.value.columns).toEqual([])
    expect(store.data.value.corrections).toEqual([])
    const saved = JSON.parse(localStorage.getItem('family-finance-plan') ?? '{}')
    expect(saved.version).toBe(1)
    expect(saved.scenarios).toHaveLength(1)
  })

  it('localStorage 存在合法 JSON 但缺少 PlanData 必要结构时不抛错并移除坏数据', async () => {
    localStorage.setItem('family-finance-plan', JSON.stringify({ version: 2 }))
    const useStore = await loadUseStore()

    expect(() => useStore()).not.toThrow()

    const store = useStore()
    expect(store.data.value.version).toBe(3)
    expect(store.data.value.columns).toEqual([])
    expect(store.data.value.corrections).toEqual([])
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
            // 缺少 itemSets
          },
        ],
        corrections: [{ month: 202601, actualSavings: 100000 }],
      }),
    )
    const useStore = await loadUseStore()

    expect(() => useStore()).not.toThrow()

    const store = useStore()
    expect(store.data.value.version).toBe(3)
    expect(store.data.value.columns).toEqual([])
    expect(store.data.value.corrections).toEqual([])
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

  it('自动保存回调在 localStorage 不可用时不抛错', async () => {
    vi.useFakeTimers()
    const useStore = await loadUseStore()
    const store = useStore()

    // 触发一次数据变更，启动 300ms 防抖保存
    store.data.value.systemParams.annualRate = 0.05
    await nextTick()

    // 模拟定时器触发时 localStorage 已不可用
    // （测试环境 jsdom 销毁后、隐私模式、SSR 等场景）
    vi.stubGlobal('localStorage', undefined)

    // 推进定时器：回调应静默跳过，不抛 ReferenceError / TypeError
    expect(() => vi.advanceTimersByTime(300)).not.toThrow()

    vi.unstubAllGlobals()
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
        corrections: [{ month: 202601, actualSavings: 100000 }],
      }),
    )

    const useStore = await loadUseStore()
    const store = useStore()

    // 旧格式被视为无效，返回默认 Workspace
    expect(store.data.value.version).toBe(3)
    expect(store.data.value.columns).toEqual([])
    expect(store.data.value.corrections).toEqual([])
  })

  it('旧 PlanData 格式自动迁移为 Workspace 默认方案', async () => {
    const oldPlan = {
      version: 2,
      systemParams: { startMonth: 202601, annualRate: 0.025 },
      columns: [{ id: 'col1', name: '工资', itemSets: { 202601: [{ id: "i1", name: "", amount: 10000 }] } }],
      corrections: [{ month: 202601, actualSavings: 50000 }],
    }
    localStorage.setItem('family-finance-plan', JSON.stringify(oldPlan))

    const useStore = await loadUseStore()
    const store = useStore()

    // data 仍可正常访问（指向迁移后的默认方案 plan）
    expect(store.data.value.columns).toHaveLength(1)
    expect(store.data.value.columns[0].name).toBe('工资')
    expect(store.data.value.columns[0].itemSets[202601][0].amount).toBe(10000)
    expect(store.data.value.corrections).toEqual([{ month: 202601, actualSavings: 50000 }])
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
    expect(store.data.value.corrections).toEqual([])
  })

  it('加载已有的 Workspace 格式数据', async () => {
    const workspace = {
      version: 1,
      scenarios: [
        { id: 's1', name: '买房方案', plan: { version: 2, systemParams: { startMonth: 202601, annualRate: 0.03 }, columns: [], corrections: [] } },
        { id: 's2', name: '租房方案', plan: { version: 2, systemParams: { startMonth: 202601, annualRate: 0.025 }, columns: [], corrections: [] } },
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
        { id: 's1', name: '方案A', plan: { version: 2, systemParams: { startMonth: 202601, annualRate: 0.025 }, columns: [], corrections: [] } },
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
      expect(newScenario.plan.corrections).toEqual([])
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
      store.addCorrection(202601, 50000)

      const originalId = store.workspace.value.activeId
      const duplicated = store.duplicateScenario()

      expect(store.workspace.value.scenarios).toHaveLength(2)
      expect(store.workspace.value.activeId).toBe(duplicated.id)
      expect(duplicated.id).not.toBe(originalId)
      expect(duplicated.name).toBe('')
      // 深拷贝：数据相同但不是同一引用
      expect(duplicated.plan.columns).toHaveLength(1)
      expect(duplicated.plan.columns[0].name).toBe('工资')
      expect(duplicated.plan.columns[0].itemSets[202601][0].amount).toBe(10000)
      expect(duplicated.plan.corrections).toEqual([{ month: 202601, actualSavings: 50000 }])
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
              corrections: [{ month: 202601, actualSavings: 100000 }],
              // 注意：故意不含 snapshots
            },
          },
        ],
      }),
    )
    const useStore = await loadUseStore()
    const store = useStore()
    expect(store.data.value.corrections).toEqual([{ month: 202601, actualSavings: 100000 }])
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

  it('默认方案含 endMonth = 起始月 + 59（5 年期限）', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    const start = store.data.value.systemParams.startMonth
    expect(store.data.value.systemParams.endMonth).toBe(addMonths(start, 59))
  })

  it('加载缺少 endMonth 的存量数据时补 起始月+59 且不清空数据', async () => {
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
              corrections: [{ month: 202601, actualSavings: 100000 }],
            },
          },
        ],
      }),
    )
    const useStore = await loadUseStore()
    const store = useStore()
    expect(store.data.value.systemParams.endMonth).toBe(203012)   // addMonths(202601, 59)
    expect(store.data.value.corrections).toEqual([{ month: 202601, actualSavings: 100000 }])
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
              corrections: [{ month: 202601, actualSavings: 100000 }],
            },
          },
        ],
      }),
    )
    const useStore = await loadUseStore()
    const store = useStore()
    expect(store.data.value.systemParams.initialDeposit).toBe(0)
    expect(store.data.value.corrections).toEqual([{ month: 202601, actualSavings: 100000 }])
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
      expect(column.itemSets[202612][0].amount).toBe(50000)
      expect(column.itemSets[202712][0].amount).toBe(50000)
      expect(column.itemSets[202812][0].amount).toBe(50000)
      expect(column.itemSets[202912][0].amount).toBe(50000)
      expect(column.itemSets[203012][0].amount).toBe(50000)
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
      expect(column.itemSets[202612]).toBeUndefined()
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
      expect(column.itemSets[202612][0].amount).toBe(50000)
      expect(column.itemSets[202712][0].amount).toBe(70000)
      expect(column.itemSets[202812][0].amount).toBe(50000)
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
      expect(column.itemSets[202612][0].amount).toBe(50000)
      expect(column.itemSets[202712][0].amount).toBe(60000)
      expect(column.yearlyMonths?.[202612]).toBeUndefined()
      expect(column.yearlyMonths?.[202712]).toBeUndefined()
      // 当前月及下方年份被写入 70000 并标记
      expect(column.itemSets[202812][0].amount).toBe(70000)
      expect(column.itemSets[202912][0].amount).toBe(70000)
      expect(column.itemSets[203012][0].amount).toBe(70000)
      expect(column.yearlyMonths?.[202812]).toBe(true)
      expect(column.yearlyMonths?.[202912]).toBe(true)
      expect(column.yearlyMonths?.[203012]).toBe(true)
    })

    it('同步范围跟随 endMonth：期限 10 年时同步覆盖到 2035 同月', async () => {
      const useStore = await loadUseStore()
      const store = useStore()
      store.data.value.systemParams.startMonth = 202601
      store.data.value.systemParams.endMonth = 203512   // 10 年
      const col = store.addColumn('年终奖')
      store.updateColumnEntry(col.id, 202612, 50000)

      store.syncYearly(col.id, 202612)

      const column = store.data.value.columns[0]
      // 10 年内所有 12 月都被同步（重点：原硬编码 60 只覆盖到 203012）
      expect(column.itemSets[202612][0].amount).toBe(50000)
      expect(column.itemSets[203012][0].amount).toBe(50000)
      expect(column.itemSets[203512][0].amount).toBe(50000)
      expect(column.yearlyMonths?.[203512]).toBe(true)
    })

    it('同步范围跟随 endMonth：期限 2 年时不越界写到第 3 年', async () => {
      const useStore = await loadUseStore()
      const store = useStore()
      store.data.value.systemParams.startMonth = 202601
      store.data.value.systemParams.endMonth = 202712   // 2 年
      const col = store.addColumn('年终奖')
      store.updateColumnEntry(col.id, 202612, 50000)

      store.syncYearly(col.id, 202612)

      const column = store.data.value.columns[0]
      expect(column.itemSets[202612][0].amount).toBe(50000)
      expect(column.itemSets[202712][0].amount).toBe(50000)
      expect(column.itemSets[202812]).toBeUndefined()   // 超出 2 年范围，不写
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
      expect(moved?.itemSets[202601][0].amount).toBe(5000)
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

    it('起始月晚于结束月则拒绝（保护 endMonth 不动）', async () => {
      const useStore = await loadUseStore()
      const store = useStore()
      store.setStartMonth(202601)
      store.setEndMonth(202612)
      expect(store.setStartMonth(202706)).toBe(false)   // 晚于 endMonth
      expect(store.data.value.systemParams.startMonth).toBe(202601)
    })

    it('起始月改动导致期限超过 30 年则拒绝', async () => {
      const useStore = await loadUseStore()
      const store = useStore()
      store.setStartMonth(202601)
      store.setEndMonth(203012)                          // 5 年
      expect(store.setStartMonth(199901)).toBe(false)   // 期限 ~32 年
      expect(store.data.value.systemParams.startMonth).toBe(202601)
    })
  })

  describe('setEndMonth', () => {
    it('合法且晚于起始月则写入并返回 true', async () => {
      const useStore = await loadUseStore()
      const store = useStore()
      store.setStartMonth(202601)
      expect(store.setEndMonth(202812)).toBe(true)
      expect(store.data.value.systemParams.endMonth).toBe(202812)
    })

    it('结束月早于起始月则拒绝且不改原值', async () => {
      const useStore = await loadUseStore()
      const store = useStore()
      store.setStartMonth(202606)
      const before = store.data.value.systemParams.endMonth
      expect(store.setEndMonth(202601)).toBe(false)
      expect(store.data.value.systemParams.endMonth).toBe(before)
    })

    it('期限超过 30 年（360 月）则拒绝', async () => {
      const useStore = await loadUseStore()
      const store = useStore()
      store.setStartMonth(202601)
      expect(store.setEndMonth(205701)).toBe(false)   // 31 年
    })

    it('越界月份进位后写入规范化值', async () => {
      const useStore = await loadUseStore()
      const store = useStore()
      store.setStartMonth(202601)
      expect(store.setEndMonth(202813)).toBe(true)
      expect(store.data.value.systemParams.endMonth).toBe(202901)
    })

    it('位数不足返回 false', async () => {
      const useStore = await loadUseStore()
      const store = useStore()
      expect(store.setEndMonth(2026)).toBe(false)
    })

    it('作用于当前激活方案', async () => {
      const useStore = await loadUseStore()
      const store = useStore()
      const other = store.addScenario()
      store.setStartMonth(202601)
      store.setEndMonth(202812)
      expect(store.data.value.systemParams.endMonth).toBe(202812)
      expect(other.plan.systemParams.endMonth).toBe(202812)
    })
  })

  describe('setColumnEnabled', () => {
    it('禁用列后 enabled=false，启用后恢复', async () => {
      const useStore = await loadUseStore()
      const store = useStore()
      const col = store.addColumn('旅游')

      store.setColumnEnabled(col.id, false)
      expect(store.data.value.columns[0].enabled).toBe(false)

      store.setColumnEnabled(col.id, true)
      expect(store.data.value.columns[0].enabled).toBe(true)
    })

    it('addColumn 新列默认无 enabled 字段（视为启用）', async () => {
      const useStore = await loadUseStore()
      const store = useStore()
      const col = store.addColumn('工资')
      expect(store.data.value.columns[0].enabled).toBeUndefined()
    })

    it('不存在的 id 无操作', async () => {
      const useStore = await loadUseStore()
      const store = useStore()
      store.setColumnEnabled('not-exist', false)
      expect(store.data.value.columns).toEqual([])
    })

    it('保存后重新加载保留 enabled 状态', async () => {
      let useStore = await loadUseStore()
      const store1 = useStore()
      const col = store1.addColumn('旅游')
      store1.setColumnEnabled(col.id, false)
      store1.save()

      vi.resetModules()
      useStore = await loadUseStore()
      const store2 = useStore()
      expect(store2.data.value.columns[0].enabled).toBe(false)
    })

    it('旧数据（无 enabled 字段）加载后视为启用', async () => {
      localStorage.setItem(
        'family-finance-plan',
        JSON.stringify({
          version: 1,
          scenarios: [
            {
              id: 's1',
              name: '默认方案',
              plan: {
                version: 2,
                systemParams: { startMonth: 202601, annualRate: 0.025, initialDeposit: 0 },
                columns: [{ id: 'c1', name: '工资', itemSets: { 202601: [{ id: "i1", name: "", amount: 10000 }] } }],
                corrections: [],
                snapshots: [],
              },
            },
          ],
          activeId: 's1',
        }),
      )
      const useStore = await loadUseStore()
      const store = useStore()
      expect(store.data.value.columns[0].enabled).toBeUndefined()
      expect(store.data.value.columns[0].name).toBe('工资')
    })
  })

  it('默认方案的 plan 含空 events 数组', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    expect(store.data.value.events).toEqual([])
  })

  it('加载缺少 events 字段的存量数据时补 [] 且不清空其它数据', async () => {
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
              corrections: [{ month: 202601, actualSavings: 100000 }],
              // 故意不含 events
            },
          },
        ],
      }),
    )
    const useStore = await loadUseStore()
    const store = useStore()
    expect(store.data.value.events).toEqual([])
    expect(store.data.value.corrections).toEqual([{ month: 202601, actualSavings: 100000 }])
  })

  it('localStorage 中 events 含非法项时视为无效并回退默认', async () => {
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
              corrections: [],
              events: [{ id: 'e1', name: '买房' }],   // 缺 month / amount
            },
          },
        ],
      }),
    )
    const useStore = await loadUseStore()
    const store = useStore()
    expect(store.data.value.events).toEqual([])
  })

  describe('replaceMonthEvents', () => {
    it('向空月新增事件', async () => {
      const useStore = await loadUseStore()
      const store = useStore()
      store.replaceMonthEvents(202601, [{ name: '买房', amount: -2000000 }])
      expect(store.data.value.events).toHaveLength(1)
      expect(store.data.value.events[0]).toMatchObject({
        name: '买房',
        month: 202601,
        amount: -2000000,
      })
      expect(store.data.value.events[0].id).toBeDefined()
    })

    it('替换该月全部事件（旧值被覆盖）', async () => {
      const useStore = await loadUseStore()
      const store = useStore()
      store.replaceMonthEvents(202601, [{ name: '买房', amount: -2000000 }])
      store.replaceMonthEvents(202601, [
        { name: '换车', amount: -200000 },
        { name: '生育', amount: -50000 },
      ])
      expect(store.data.value.events).toHaveLength(2)
      expect(store.data.value.events.map((e) => e.name)).toEqual(['换车', '生育'])
    })

    it('只影响目标月，不动其它月', async () => {
      const useStore = await loadUseStore()
      const store = useStore()
      store.replaceMonthEvents(202601, [{ name: '买房', amount: -2000000 }])
      store.replaceMonthEvents(202602, [{ name: '换车', amount: -200000 }])
      store.replaceMonthEvents(202601, [{ name: '生育', amount: -50000 }])
      const counts = store.data.value.events.reduce((map, e) => {
        map.set(e.month, (map.get(e.month) ?? 0) + 1)
        return map
      }, new Map<number, number>())
      expect(counts.get(202601)).toBe(1)
      expect(counts.get(202602)).toBe(1)
    })

    it('半空行（名称空或金额非有限）被丢弃', async () => {
      const useStore = await loadUseStore()
      const store = useStore()
      store.replaceMonthEvents(202601, [
        { name: '买房', amount: -2000000 },
        { name: '', amount: -100 },
        { name: '无效', amount: NaN },
        { name: '   ', amount: 500 },
      ])
      expect(store.data.value.events).toHaveLength(1)
      expect(store.data.value.events[0].name).toBe('买房')
    })

    it('传空数组清空该月全部事件', async () => {
      const useStore = await loadUseStore()
      const store = useStore()
      store.replaceMonthEvents(202601, [{ name: '买房', amount: -2000000 }])
      store.replaceMonthEvents(202601, [])
      expect(store.data.value.events).toEqual([])
    })
  })

  describe('moveMonthEvents', () => {
    it('把源月事件整组搬到目标月（源月清空）', async () => {
      const useStore = await loadUseStore()
      const store = useStore()
      store.replaceMonthEvents(202601, [{ name: '买房', amount: -2000000 }])

      store.moveMonthEvents(202601, 202603)

      expect(store.data.value.events.filter((e) => e.month === 202601)).toEqual([])
      expect(store.data.value.events.filter((e) => e.month === 202603).map((e) => e.name)).toEqual(['买房'])
    })

    it('目标月已有事件时合并（保留原有 + 并入）', async () => {
      const useStore = await loadUseStore()
      const store = useStore()
      store.replaceMonthEvents(202601, [{ name: '买房', amount: -2000000 }])
      store.replaceMonthEvents(202603, [{ name: '换车', amount: -200000 }])

      store.moveMonthEvents(202601, 202603)

      const names = store.data.value.events
        .filter((e) => e.month === 202603)
        .map((e) => e.name)
        .sort()
      expect(names).toEqual(['买房', '换车'])
      expect(store.data.value.events.filter((e) => e.month === 202601)).toEqual([])
    })

    it('from 等于 to 时无变化', async () => {
      const useStore = await loadUseStore()
      const store = useStore()
      store.replaceMonthEvents(202601, [{ name: '买房', amount: -2000000 }])

      store.moveMonthEvents(202601, 202601)

      expect(store.data.value.events.filter((e) => e.month === 202601)).toHaveLength(1)
    })

    it('源月无事件时无变化', async () => {
      const useStore = await loadUseStore()
      const store = useStore()
      store.replaceMonthEvents(202603, [{ name: '换车', amount: -200000 }])

      store.moveMonthEvents(202601, 202603)

      expect(store.data.value.events.filter((e) => e.month === 202601)).toEqual([])
      expect(store.data.value.events.filter((e) => e.month === 202603)).toHaveLength(1)
    })

    it('多笔事件整组一起搬到目标月，id/name/amount 完整保留', async () => {
      const useStore = await loadUseStore()
      const store = useStore()
      store.replaceMonthEvents(202601, [
        { name: '买房', amount: -2000000 },
        { name: '年终奖', amount: 100000 },
      ])

      store.moveMonthEvents(202601, 202603)

      const atTarget = store.data.value.events.filter((e) => e.month === 202603)
      expect(atTarget.map((e) => e.name).sort()).toEqual(['买房', '年终奖'])
      const bought = atTarget.find((e) => e.name === '买房')
      expect(bought?.amount).toBe(-2000000)
      expect(bought?.id).toBeDefined()
    })

    it('保存后重新加载合并结果保留', async () => {
      let useStore = await loadUseStore()
      const store1 = useStore()
      store1.replaceMonthEvents(202601, [{ name: '买房', amount: -2000000 }])
      store1.replaceMonthEvents(202603, [{ name: '换车', amount: -200000 }])
      store1.moveMonthEvents(202601, 202603)
      store1.save()

      vi.resetModules()
      useStore = await loadUseStore()
      const store2 = useStore()

      const names = store2.data.value.events
        .filter((e) => e.month === 202603)
        .map((e) => e.name)
        .sort()
      expect(names).toEqual(['买房', '换车'])
      expect(store2.data.value.events.filter((e) => e.month === 202601)).toEqual([])
    })
  })

  it('单值编辑写入一笔 name 为空的明细组', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    const col = store.addColumn('工资')
    store.updateColumnEntry(col.id, 202601, 10000)
    expect(col.itemSets[202601]).toEqual([{ id: expect.any(String), name: '', amount: 10000 }])
  })

  it('replaceColumnItems 存多笔；全空则删该月', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    const col = store.addColumn('奖金')
    store.replaceColumnItems(col.id, 202601, [{ name: '年终奖', amount: 8000 }, { name: '红包', amount: 3000 }])
    expect(col.itemSets[202601]).toHaveLength(2)
    expect(col.itemSets[202601].map(i => i.amount)).toEqual([8000, 3000])
    store.replaceColumnItems(col.id, 202601, [{ name: '', amount: 1 }])
    expect(col.itemSets[202601]).toBeUndefined()
  })

  it('setColumnMode 切换列模式', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    const col = store.addColumn('奖金')
    expect(col.mode).toBe('single')
    store.setColumnMode(col.id, 'detail')
    expect(col.mode).toBe('detail')
    store.setColumnMode(col.id, 'single')
    expect(col.mode).toBe('single')
  })

  it('旧 v2 entries 数据加载时自动迁移为 itemSets + single + version 3', async () => {
    const oldPlan = {
      version: 2,
      systemParams: { startMonth: 202601, annualRate: 0.025 },
      columns: [{ id: 'col1', name: '工资', entries: { 202601: 10000, 202602: 11000 } }],
      corrections: [], snapshots: [], events: [],
    }
    localStorage.setItem('family-finance-plan', JSON.stringify(oldPlan))

    const useStore = await loadUseStore()
    const store = useStore()
    const col = store.data.value.columns[0]
    expect(col.itemSets[202601]).toEqual([{ id: expect.any(String), name: '', amount: 10000 }])
    expect(col.itemSets[202602]).toEqual([{ id: expect.any(String), name: '', amount: 11000 }])
    expect((col as any).entries).toBeUndefined()
    expect(col.mode).toBe('single')
    expect(store.data.value.version).toBe(3)
  })

  it('脏数据（itemSets 与残留 entries 并存）迁移后 entries 被清除，itemSets 不受污染', async () => {
    const dirty = {
      version: 2,
      systemParams: { startMonth: 202601, annualRate: 0.025 },
      columns: [{ id: 'c1', name: '工资', itemSets: { 202601: [{ id: 'x', name: '', amount: 100 }] }, entries: { 202601: 999 } }],
      corrections: [], snapshots: [], events: [],
    }
    localStorage.setItem('family-finance-plan', JSON.stringify(dirty))

    const useStore = await loadUseStore()
    const store = useStore()
    const col = store.data.value.columns[0]
    expect((col as any).entries).toBeUndefined()
    expect(col.itemSets[202601][0].amount).toBe(100)
  })
})

describe('fund 校验与迁移', () => {
  // 复用文件顶部已有的 loadUseStore（动态 import + resetModules 隔离）
  beforeEach(() => {
    vi.useRealTimers()
    localStorage.clear()
    vi.resetModules()
  })

  it('旧数据（无 fund、SystemParams 无 fundRate）加载时补默认', async () => {
    const legacy = {
      version: 2,
      systemParams: { startMonth: 202601, annualRate: 0.03 },
      columns: [], corrections: [], snapshots: [], events: [],
    }
    localStorage.setItem('family-finance-plan', JSON.stringify({
      version: 1,
      scenarios: [{ id: 's1', name: '默认方案', plan: legacy }],
      activeId: 's1',
    }))
    const useStore = await loadUseStore()
    const store = useStore()
    expect(store.data.value.systemParams.fundRate).toBe(0.015)
    expect(store.data.value.systemParams.fundInterestMonth).toBe(7)
    expect(store.data.value.fund).toBeUndefined()
  })

  it('含合法 fund 的数据正常加载', async () => {
    const plan = {
      version: 2,
      systemParams: { startMonth: 202601, annualRate: 0.03, fundRate: 0.015, fundInterestMonth: 7 },
      columns: [], corrections: [], snapshots: [], events: [],
      fund: {
        mortgage: { id: 'm', name: '房贷月供', itemSets: {} },
        contribution: { id: 'c', name: '公积金缴存', itemSets: { 202601: [{ id: "i1", name: "", amount: 1000 }] } },
        monthlyOffset: { id: 'o', name: '公积金月冲', itemSets: {} },
        withdrawals: [{ id: 'w1', name: '买房', month: 202602, amount: 30000 }],
        corrections: [{ month: 202603, actualBalance: 500000 }],
      },
    }
    localStorage.setItem('family-finance-plan', JSON.stringify({
      version: 1,
      scenarios: [{ id: 's1', name: '默认方案', plan }],
      activeId: 's1',
    }))
    const useStore = await loadUseStore()
    const store = useStore()
    expect(store.data.value.fund?.contribution.itemSets[202601][0].amount).toBe(1000)
    expect(store.data.value.fund?.withdrawals).toHaveLength(1)
  })

  it('旧 v2 公积金三列 entries 迁移为 itemSets（migrateColumn 的 fund 分支）', async () => {
    const plan = {
      version: 2,
      systemParams: { startMonth: 202601, annualRate: 0.03, fundRate: 0.015, fundInterestMonth: 7 },
      columns: [], corrections: [], snapshots: [], events: [],
      fund: {
        mortgage: { id: 'm', name: '房贷月供', entries: { 202601: -5000 } },
        contribution: { id: 'c', name: '公积金缴存', entries: { 202601: 2000 } },
        monthlyOffset: { id: 'o', name: '公积金月冲', entries: { 202601: 3000 } },
        withdrawals: [], corrections: [],
      },
    }
    localStorage.setItem('family-finance-plan', JSON.stringify(plan))
    const useStore = await loadUseStore()
    const store = useStore()
    const fund = store.data.value.fund!
    expect(fund.mortgage.itemSets[202601][0].amount).toBe(-5000)
    expect(fund.contribution.itemSets[202601][0].amount).toBe(2000)
    expect(fund.monthlyOffset.itemSets[202601][0].amount).toBe(3000)
    expect((fund.mortgage as any).entries).toBeUndefined()
  })

  it('fund 内部结构非法（mortgage 非 FlowColumn）时整个 workspace 回退默认', async () => {
    const bad = {
      version: 2,
      systemParams: { startMonth: 202601, annualRate: 0.03, fundRate: 0.015, fundInterestMonth: 7 },
      columns: [], corrections: [], snapshots: [], events: [],
      fund: { mortgage: '不是列', contribution: { id: 'c', name: 'x', itemSets: {} }, monthlyOffset: { id: 'o', name: 'x', itemSets: {} }, withdrawals: [], corrections: [] },
    }
    localStorage.setItem('family-finance-plan', JSON.stringify({
      version: 1,
      scenarios: [{ id: 's1', name: '默认方案', plan: bad }],
      activeId: 's1',
    }))
    const useStore = await loadUseStore()
    const store = useStore()
    // isValidPlanData 因 fund 非法返回 false → isValidWorkspace false → loadWorkspace 回退默认
    expect(store.data.value.columns).toEqual([])
    expect(store.data.value.fund).toBeUndefined()
  })
})

describe('fund 操作函数', () => {
  beforeEach(() => {
    vi.useRealTimers()
    localStorage.clear()
    vi.resetModules()
  })

  it('enableFund 创建空 FundConfig，disableFund 移除', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    expect(store.data.value.fund).toBeUndefined()
    store.enableFund()
    expect(store.data.value.fund).toBeDefined()
    expect(store.data.value.fund?.mortgage.itemSets).toEqual({})
    expect(store.data.value.fund?.withdrawals).toEqual([])
    store.disableFund()
    expect(store.data.value.fund).toBeUndefined()
  })

  it('updateFundEntry 写入指定 fund 列的月份值', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.enableFund()
    store.updateFundEntry('contribution', 202601, 2000)
    expect(store.data.value.fund?.contribution.itemSets[202601][0].amount).toBe(2000)
  })

  it('replaceMonthWithdrawals 替换指定月提取', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.enableFund()
    store.replaceMonthWithdrawals(202602, [{ name: '买房提取', amount: 30000 }])
    expect(store.data.value.fund?.withdrawals).toHaveLength(1)
    expect(store.data.value.fund?.withdrawals[0].month).toBe(202602)
  })

  it('addFundCorrection / removeFundCorrection 维护公积金修正', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.enableFund()
    store.addFundCorrection(202603, 500000)
    expect(store.data.value.fund?.corrections).toHaveLength(1)
    store.removeFundCorrection(202603)
    expect(store.data.value.fund?.corrections).toHaveLength(0)
  })

  it('setFundRate 设置公积金年利率', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.setFundRate(0.02)
    expect(store.data.value.systemParams.fundRate).toBe(0.02)
  })

  it('setFundInterestMonth clamp 到 1-12，非有限数忽略', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.setFundInterestMonth(7)
    expect(store.data.value.systemParams.fundInterestMonth).toBe(7)
    // 越界 clamp
    store.setFundInterestMonth(99)
    expect(store.data.value.systemParams.fundInterestMonth).toBe(12)
    store.setFundInterestMonth(0)
    expect(store.data.value.systemParams.fundInterestMonth).toBe(1)
    // 小数四舍五入
    store.setFundInterestMonth(6.7)
    expect(store.data.value.systemParams.fundInterestMonth).toBe(7)
    // NaN 忽略（保持原值 7）
    store.setFundInterestMonth(NaN)
    expect(store.data.value.systemParams.fundInterestMonth).toBe(7)
  })

  it('syncFundYearly 把该月值复制到当前月及下方所有同月，并标记 yearly', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.setStartMonth(202601)
    store.enableFund()
    store.updateFundEntry('mortgage', 202603, 5000)
    store.syncFundYearly('mortgage', 202603)
    const col = store.data.value.fund!.mortgage
    // 202603 自身及下方所有 3 月都被写入 5000
    expect(col.itemSets[202603][0].amount).toBe(5000)
    expect(col.itemSets[202703][0].amount).toBe(5000)
    expect(col.itemSets[202803][0].amount).toBe(5000)
    expect(col.yearlyMonths?.[202703]).toBe(true)
    expect(col.yearlyMonths?.[202803]).toBe(true)
    // 非 3 月未被写入
    expect(col.itemSets[202601]).toBeUndefined()
    expect(col.itemSets[202602]).toBeUndefined()
  })

  it('updateFundEntry 传 null 删除 entry 并清除 yearlyMonths 标记', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.setStartMonth(202601)
    store.enableFund()
    store.updateFundEntry('contribution', 202603, 2000)
    store.syncFundYearly('contribution', 202603)   // 标记 yearly
    expect(store.data.value.fund!.contribution.yearlyMonths?.[202603]).toBe(true)
    store.updateFundEntry('contribution', 202603, null)   // 删除
    expect(store.data.value.fund!.contribution.itemSets[202603]).toBeUndefined()
    expect(store.data.value.fund!.contribution.yearlyMonths?.[202603]).toBeUndefined()
  })

  it('syncFundYearly 同步范围跟随 endMonth：期限 10 年覆盖到 2035 同月', async () => {
    const useStore = await loadUseStore()
    const store = useStore()
    store.setStartMonth(202601)
    store.data.value.systemParams.endMonth = 203512   // 10 年
    store.enableFund()
    store.updateFundEntry('mortgage', 202603, 5000)
    store.syncFundYearly('mortgage', 202603)
    const col = store.data.value.fund!.mortgage
    expect(col.itemSets[202603][0].amount).toBe(5000)
    expect(col.itemSets[203303][0].amount).toBe(5000)
    expect(col.itemSets[203503][0].amount).toBe(5000)   // 10 年内的 3 月
    expect(col.yearlyMonths?.[203503]).toBe(true)
  })
})
