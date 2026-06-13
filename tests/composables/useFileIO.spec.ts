import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

async function loadUseFileIO() {
  return (await import('../../src/composables/useFileIO')).useFileIO
}

async function loadUseStore() {
  return (await import('../../src/composables/useStore')).useStore
}

describe('useFileIO', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('exportData', () => {
    it('生成含 exportVersion、exportTime、data 的 JSON 并触发下载', async () => {
      const useStore = await loadUseStore()
      const store = useStore()
      store.addColumn('工资')
      store.save()

      const clickSpy = vi.fn()
      const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
        node.addEventListener('click', () => clickSpy())
        return node
      })
      const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => document.createElement('a'))

      const useFileIO = await loadUseFileIO()
      const { exportData } = useFileIO()
      const result = exportData()

      expect(result.success).toBe(true)
      expect(appendChildSpy).toHaveBeenCalled()

      appendChildSpy.mockRestore()
      removeChildSpy.mockRestore()
    })

    it('导出文件名包含当前日期 YYYYMMDD', async () => {
      const useStore = await loadUseStore()
      const store = useStore()
      store.addColumn('工资')
      store.save()

      const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => document.createElement('a'))
      const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => document.createElement('a'))

      const useFileIO = await loadUseFileIO()
      const { exportData } = useFileIO()
      exportData()

      const link = appendChildSpy.mock.calls[0][0] as HTMLAnchorElement
      expect(link.download).toMatch(/^family-finance-plan-\d{8}\.json$/)

      appendChildSpy.mockRestore()
      removeChildSpy.mockRestore()
    })

    it('初次加载无 localStorage 数据时也能导出', async () => {
      // 不写入 localStorage，useStore 会创建默认 workspace
      const useStore = await loadUseStore()
      useStore() // 触发默认 workspace 创建

      const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => document.createElement('a'))
      const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => document.createElement('a'))

      const useFileIO = await loadUseFileIO()
      const { exportData } = useFileIO()
      const result = exportData()

      expect(result.success).toBe(true)

      appendChildSpy.mockRestore()
      removeChildSpy.mockRestore()
    })
  })

  describe('importData', () => {
    it('有效导出文件可成功导入并写入 localStorage', async () => {
      const useStore = await loadUseStore()
      const store = useStore()
      store.addColumn('工资')
      store.data.value.systemParams.annualRate = 0.05
      store.save()

      const workspaceRaw = localStorage.getItem('family-finance-plan')!
      const exportPayload = {
        exportVersion: 1,
        exportTime: new Date().toISOString(),
        data: JSON.parse(workspaceRaw),
      }

      localStorage.clear()
      vi.resetModules()

      const file = new File(
        [JSON.stringify(exportPayload)],
        'export.json',
        { type: 'application/json' },
      )

      const useFileIO = await loadUseFileIO()
      const { importData } = useFileIO()
      const result = await importData(file)

      expect(result.success).toBe(true)

      const saved = JSON.parse(localStorage.getItem('family-finance-plan')!)
      expect(saved.version).toBe(1)
      expect(saved.scenarios[0].plan.columns).toHaveLength(1)
      expect(saved.scenarios[0].plan.columns[0].name).toBe('工资')
      expect(saved.scenarios[0].plan.systemParams.annualRate).toBe(0.05)
    })

    it('拒绝非 JSON 文件（内容不是合法 JSON）', async () => {
      const file = new File(['not json content'], 'bad.txt', { type: 'text/plain' })

      const useFileIO = await loadUseFileIO()
      const { importData } = useFileIO()
      const result = await importData(file)

      expect(result.success).toBe(false)
      expect(result.error).toContain('无法解析')
    })

    it('拒绝缺少 exportVersion 的 JSON', async () => {
      const file = new File(
        [JSON.stringify({ data: { version: 1, scenarios: [], activeId: 'x' } })],
        'bad.json',
        { type: 'application/json' },
      )

      const useFileIO = await loadUseFileIO()
      const { importData } = useFileIO()
      const result = await importData(file)

      expect(result.success).toBe(false)
      expect(result.error).toContain('格式不正确')
    })

    it('拒绝缺少 data 字段的 JSON', async () => {
      const file = new File(
        [JSON.stringify({ exportVersion: 1 })],
        'bad.json',
        { type: 'application/json' },
      )

      const useFileIO = await loadUseFileIO()
      const { importData } = useFileIO()
      const result = await importData(file)

      expect(result.success).toBe(false)
      expect(result.error).toContain('格式不正确')
    })

    it('拒绝 data 内部 Workspace 结构不完整的文件', async () => {
      const file = new File(
        [JSON.stringify({ exportVersion: 1, exportTime: '...', data: { version: 1 } })],
        'bad.json',
        { type: 'application/json' },
      )

      const useFileIO = await loadUseFileIO()
      const { importData } = useFileIO()
      const result = await importData(file)

      expect(result.success).toBe(false)
      expect(result.error).toContain('数据结构')
    })

    it('接受合法的最小化 workspace', async () => {
      const useStore = await loadUseStore()
      const store = useStore()
      store.save()

      const workspaceRaw = localStorage.getItem('family-finance-plan')!
      const exportPayload = {
        exportVersion: 1,
        exportTime: new Date().toISOString(),
        data: JSON.parse(workspaceRaw),
      }

      localStorage.clear()
      vi.resetModules()

      const file = new File(
        [JSON.stringify(exportPayload)],
        'export.json',
        { type: 'application/json' },
      )

      const useFileIO = await loadUseFileIO()
      const { importData } = useFileIO()
      const result = await importData(file)

      expect(result.success).toBe(true)
      const saved = JSON.parse(localStorage.getItem('family-finance-plan')!)
      expect(saved.version).toBe(1)
      expect(saved.scenarios).toHaveLength(1)
    })

    // 接线测试：模拟 ToolsMenu 导入成功路径（importData → reloadWorkspace → resetHistory），
    // 验证导入后撤销栈被重置（canUndo 为 false），即 Ctrl+Z 不会撤销整个导入。
    it('导入成功并调用 resetHistory 后撤销栈被重置（canUndo 为 false）', async () => {
      const { nextTick } = await import('vue')

      // 1) 先准备一份「有可撤销历史」的内存态：加载 store/history，做一次编辑并让捕获落盘
      const useStore = await loadUseStore()
      const useHistory = (await import('../../src/composables/useHistory')).useHistory
      const store = useStore()
      const history = useHistory()

      // 用假定时器推进捕获防抖；结束前恢复，避免影响 importData 内的 FileReader
      vi.useFakeTimers()
      try {
        store.addColumn('工资')
        await nextTick()
        await vi.advanceTimersByTimeAsync(500)
      } finally {
        vi.useRealTimers()
      }
      // 前提：此时已存在可撤销历史
      expect(history.canUndo.value).toBe(true)

      // 2) 构造合法导出文件（基于当前内存 workspace 落盘的快照）
      store.save()
      const workspaceRaw = localStorage.getItem('family-finance-plan')!
      const exportPayload = {
        exportVersion: 1,
        exportTime: new Date().toISOString(),
        data: JSON.parse(workspaceRaw),
      }
      const file = new File([JSON.stringify(exportPayload)], 'export.json', {
        type: 'application/json',
      })

      // 3) 执行导入成功路径：importData 写入 localStorage
      const useFileIO = await loadUseFileIO()
      const { importData } = useFileIO()
      const result = await importData(file)
      expect(result.success).toBe(true)

      // 4) 模拟 ToolsMenu：reloadWorkspace 后同步调 resetHistory(JSON.stringify(workspace.value))
      //    —— 此时 workspace.value 已是新数据；resetHistory 清掉捕获定时器并把 lastSnapshot 设为导入态
      store.reloadWorkspace()
      history.resetHistory(JSON.stringify(store.workspace.value))

      // 5) 即使再推进捕获定时器，也不应重新产生可撤销历史
      vi.useFakeTimers()
      try {
        await nextTick()
        await vi.advanceTimersByTimeAsync(500)
        expect(history.canUndo.value).toBe(false)
        expect(history.canRedo.value).toBe(false)
      } finally {
        vi.useRealTimers()
      }
    })
  })
})
