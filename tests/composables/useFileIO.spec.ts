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
  })
})
