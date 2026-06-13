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
})
