import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

async function loadModules() {
  const useStore = (await import('../../src/composables/useStore')).useStore
  const useHistory = (await import('../../src/composables/useHistory')).useHistory
  return { useStore, useHistory }
}

// 推进 500ms 让捕获防抖落盘（先 nextTick 让 watch 触发并安排定时器）
async function flushCapture(ms = 500) {
  await nextTick()
  await vi.advanceTimersByTimeAsync(ms)
}

describe('useHistory', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    vi.resetModules()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('初始无可撤销/重做', async () => {
    const { useStore, useHistory } = await loadModules()
    useStore()
    const history = useHistory()

    expect(history.canUndo.value).toBe(false)
    expect(history.canRedo.value).toBe(false)
  })

  it('单次编辑后可撤销', async () => {
    const { useStore, useHistory } = await loadModules()
    const store = useStore()
    const history = useHistory()

    store.addColumn('工资')
    await flushCapture()

    expect(history.canUndo.value).toBe(true)
    expect(history.canRedo.value).toBe(false)
  })

  it('undo 还原修改的值', async () => {
    const { useStore, useHistory } = await loadModules()
    const store = useStore()
    const history = useHistory()

    store.data.value.systemParams.annualRate = 0.05
    await flushCapture()

    await history.undo()
    await nextTick()

    expect(store.data.value.systemParams.annualRate).toBe(0.025)
  })

  it('past 为空时 undo 不抛错', async () => {
    const { useStore, useHistory } = await loadModules()
    useStore()
    const history = useHistory()

    await expect(history.undo()).resolves.toBeUndefined()
  })

  it('redo 恢复已撤销的值', async () => {
    const { useStore, useHistory } = await loadModules()
    const store = useStore()
    const history = useHistory()

    store.data.value.systemParams.annualRate = 0.05
    await flushCapture()
    await history.undo()
    await nextTick()

    expect(history.canRedo.value).toBe(true)

    await history.redo()
    await nextTick()

    expect(store.data.value.systemParams.annualRate).toBe(0.05)
  })

  it('新编辑后重做栈被清空', async () => {
    const { useStore, useHistory } = await loadModules()
    const store = useStore()
    const history = useHistory()

    store.data.value.systemParams.annualRate = 0.05
    await flushCapture()
    await history.undo()
    await nextTick()

    store.addColumn('新列')
    await flushCapture()

    expect(history.canRedo.value).toBe(false)
  })

  it('resetHistory 清空撤销/重做栈', async () => {
    const { useStore, useHistory } = await loadModules()
    const store = useStore()
    const history = useHistory()

    store.addColumn('工资')
    await flushCapture()
    await history.undo()
    await nextTick()

    // undo 后：past 空、future 有
    expect(history.canUndo.value).toBe(false)
    expect(history.canRedo.value).toBe(true)

    history.resetHistory(JSON.stringify(store.workspace.value))

    expect(history.canUndo.value).toBe(false)
    expect(history.canRedo.value).toBe(false)
  })

  it('连续快速编辑合并为一步', async () => {
    const { useStore, useHistory } = await loadModules()
    const store = useStore()
    const history = useHistory()

    // 同一字段连改三次，期间不 flush（Vue 批处理 + 单一定时器 → 合并）
    store.data.value.systemParams.annualRate = 0.05
    store.data.value.systemParams.annualRate = 0.06
    store.data.value.systemParams.annualRate = 0.07
    await flushCapture()

    // 一次 undo 即回到原始 0.025（说明三次合并为一步）
    await history.undo()
    await nextTick()

    expect(store.data.value.systemParams.annualRate).toBe(0.025)
  })

  it('间隔超过防抖窗口的编辑各自独立', async () => {
    const { useStore, useHistory } = await loadModules()
    const store = useStore()
    const history = useHistory()

    store.data.value.systemParams.annualRate = 0.05
    await flushCapture()
    store.data.value.systemParams.annualRate = 0.06
    await flushCapture()

    // 一次 undo 只回到 0.05（两步）
    await history.undo()
    await nextTick()

    expect(store.data.value.systemParams.annualRate).toBe(0.05)
  })

  it('撤销跨方案切换时跳回原方案', async () => {
    const { useStore, useHistory } = await loadModules()
    const store = useStore()
    const history = useHistory()

    const aId = store.workspace.value.activeId
    store.addColumn('工资')
    await flushCapture()

    store.addScenario()   // 新增并切换到新方案（activeId 变）
    expect(store.workspace.value.activeId).not.toBe(aId)
    await flushCapture()

    await history.undo()  // 撤销切换 → activeId 随快照整体还原回 A
    await nextTick()

    expect(store.workspace.value.activeId).toBe(aId)
  })

  it('历史上限为 50 步', async () => {
    const { useStore, useHistory } = await loadModules()
    const store = useStore()
    const history = useHistory()

    // 60 次编辑，每次间隔超过防抖窗口
    for (let i = 0; i < 60; i++) {
      store.addColumn(`列${i}`)
      await flushCapture()
    }

    let undoCount = 0
    while (history.canUndo.value) {
      await history.undo()
      await nextTick()
      undoCount++
    }

    expect(undoCount).toBe(50)
  })

  it('重置后可撤销找回', async () => {
    const { useStore, useHistory } = await loadModules()
    const store = useStore()
    const history = useHistory()

    store.addColumn('工资')
    await flushCapture()
    store.reset()
    await flushCapture()

    expect(store.data.value.columns).toHaveLength(0)

    await history.undo()   // 撤销重置 → 列找回
    await nextTick()

    expect(store.data.value.columns).toHaveLength(1)
  })

  it('future 为空时 redo 不抛错', async () => {
    const { useStore, useHistory } = await loadModules()
    useStore()
    const history = useHistory()

    await expect(history.redo()).resolves.toBeUndefined()
  })
})
